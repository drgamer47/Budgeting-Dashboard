/**
 * UI Renderers Module
 * Orchestrates all DOM rendering functions and chart management
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, formatDate, currentMonthISO } from './utils.js';
import { MOBILE_BREAKPOINT, STORAGE_KEYS, RESIZE_DEBOUNCE, CHART_COLORS, CHART_CONFIG, BILL_REMINDER_DAYS, BILL_REMINDER_URGENT_DAYS, PERCENTAGE_THRESHOLDS } from './constants.js';

// Import render functions from feature modules
import { 
  renderTransactionsTable, 
  getFilteredTransactions,
  getViewedMonth,
  getShowAllMonths
} from './transactions.js';

import { renderCategoryFilters } from './categories.js';
import { renderSavingsGoals, renderFinancialGoals } from './goals.js';
import { renderDebts } from './debts.js';
import { renderRecurringTransactions } from './recurring.js';

// Chart instances (need to persist across renders)
let categoryChart = null;
let monthlyChart = null;
let sankeyChartDiv = null;
let resizeTimeout = null;

/**
 * Initialize UI renderers
 * Sets up chart resize handlers and prepares renderer module
 * @returns {void}
 */
export function initRenderers() {
  // Setup chart resize handler
  setupChartResizeHandler();
}

/**
 * Update current date display in header
 * Formats and displays the current date in a human-readable format
 * @returns {void}
 */
export function updateCurrentDate() {
  const dateDisplay = document.getElementById('currentDateDisplay');
  if (dateDisplay) {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString('en-US', options);
  }
}

/**
 * Render KPIs (Key Performance Indicators)
 * Calculates and displays income, expenses, net amount, and total savings
 * @returns {void}
 */
export function renderKpis() {
  const tx = getFilteredTransactions();

  let income = 0, expense = 0;

  tx.forEach(t => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });

  const net = income - expense;

  const kpiIncome = document.getElementById("kpiIncome");
  const kpiExpenses = document.getElementById("kpiExpenses");
  const kpiNet = document.getElementById("kpiNet");
  const kpiSavings = document.getElementById("kpiSavings");
  
  if (kpiIncome) kpiIncome.textContent = formatMoney(income);
  if (kpiExpenses) kpiExpenses.textContent = formatMoney(expense);
  if (kpiNet) kpiNet.textContent = formatMoney(net);

  // Savings = sum of all goals current stored amount
  const data = stateManager.getActiveData();
  const goals = Array.isArray(data.savingsGoals) ? data.savingsGoals : [];
  const totalSaved = goals.reduce((s, g) => s + (g.current || 0), 0);
  if (kpiSavings) kpiSavings.textContent = formatMoney(totalSaved);
}

/**
 * Render profile selector dropdown
 * Updates the profile name display and populates the profile list dropdown
 * @returns {void}
 */
export function renderProfileSelector() {
  const state = stateManager.getState();
  const activeProfile = state.profiles.find(p => p.id === state.activeProfileId);
  if (!activeProfile) return;

  const profileName = document.getElementById("currentProfileName");
  if (profileName) {
    profileName.textContent = activeProfile.name;
  }

  const profileInitial = document.getElementById("profileInitial");
  if (profileInitial) {
    profileInitial.textContent = activeProfile.name.charAt(0).toUpperCase();
  }

  const profileList = document.getElementById("profileList");
  if (!profileList) return;

  profileList.innerHTML = "";
  state.profiles.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "profile-item" + (p.id === state.activeProfileId ? " active" : "");
    btn.innerHTML = `
      <span>${p.name}</span>
      ${p.id === state.activeProfileId ? '<span class="profile-item-check">✓</span>' : ''}
    `;
    btn.addEventListener("click", () => {
      stateManager.switchProfile(p.id);
      closeProfileMenu();
      renderAll();
    });
    profileList.appendChild(btn);
  });
}

/**
 * Update month/year selectors in header
 * Populates month and year dropdowns and sets current values based on viewed month
 * @returns {void}
 */
export function updateMonthYearSelectors() {
  const viewedMonth = getViewedMonth();
  const [year, month] = viewedMonth.split("-");
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  
  if (monthSelect) {
    monthSelect.value = month;
  }
  
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear - CHART_CONFIG.YEAR_RANGE; y <= currentYear + CHART_CONFIG.YEAR_RANGE; y++) {
      const option = document.createElement('option');
      option.value = y;
      option.textContent = y;
      yearSelect.appendChild(option);
    }
    yearSelect.value = year;
  }
}

/**
 * Close profile menu dropdown
 * Hides the profile selector dropdown menu
 * @returns {void}
 */
export function closeProfileMenu() {
  const menu = document.querySelector(".profile-menu");
  if (menu) {
    menu.classList.remove("active");
  }
}

/**
 * Render category spending chart
 * Creates or updates a pie/doughnut chart showing spending by category
 * Uses Chart.js for rendering
 * @returns {void}
 */
export function renderCategoryChart() {
  const ctx = document.getElementById("categoryChart");
  if (!ctx) return;
  
  const tx = getFilteredTransactions();
  const data = stateManager.getActiveData();
  const cats = data.categories || [];

  const totals = {};
  cats.forEach(c => totals[c.id] = 0);

  tx.forEach(t => {
    if (t.type === "expense") {
      if (totals[t.categoryId] == null) totals[t.categoryId] = 0;
      totals[t.categoryId] += t.amount;
    }
  });

  const labels = [];
  const values = [];
  const colors = [];

  cats.forEach(c => {
    labels.push(c.name);
    values.push(totals[c.id] || 0);
    colors.push(c.color);
  });

  if (categoryChart) {
    categoryChart.destroy();
  }

  if (typeof Chart !== 'undefined') {
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { 
          legend: { 
            labels: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e2e8f0'
            } 
          } 
        }
      }
    });
  }
}

/**
 * Render monthly income/expense chart
 * Creates or updates a line chart showing income and expenses over time
 * Uses Chart.js for rendering
 * @returns {void}
 */
export function renderMonthlyChart() {
  const ctx = document.getElementById("monthlyChart");
  if (!ctx) return;

  const data = stateManager.getActiveData();
  const transactions = data.transactions || [];

  // Group last 6 months income/expenses
  const now = new Date();
  const months = [];

  for (let i = CHART_CONFIG.MONTHS_TO_SHOW; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = currentMonthISO(d);
    months.push(key);
  }

  const incomeArr = months.map(m => {
    return transactions.filter(t => t.date.startsWith(m) && t.type === "income")
               .reduce((s, t) => s + t.amount, 0);
  });
  const expenseArr = months.map(m => {
    return transactions.filter(t => t.date.startsWith(m) && t.type === "expense")
               .reduce((s, t) => s + t.amount, 0);
  });

  if (monthlyChart) {
    monthlyChart.destroy();
  }

  if (typeof Chart !== 'undefined') {
    monthlyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Income", data: incomeArr, backgroundColor: "#4ade80" },
          { label: "Expenses", data: expenseArr, backgroundColor: "#f87171" }
        ]
      },
      options: {
        plugins: { 
          legend: { 
            labels: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e2e8f0'
            } 
          } 
        },
        scales: {
          x: { 
            ticks: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e2e8f0'
            } 
          },
          y: { 
            ticks: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e2e8f0'
            } 
          }
        }
      }
    });
  }
}

/**
 * Render Sankey flow diagram
 * Creates a flow diagram showing money flow from income sources to categories
 * Uses Plotly.js for rendering
 * @returns {void}
 */
export function renderSankeyChart() {
  const chartDiv = document.getElementById("sankeyChart");
  if (!chartDiv || typeof Plotly === 'undefined') return;
  
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const isSmallMobile = window.innerWidth <= 480;
  
  // Update current date display
  updateCurrentDate();

  const tx = getFilteredTransactions();
  const data = stateManager.getActiveData();
  const categories = data.categories || [];

  // Calculate income by source
  const incomeSources = {};
  let totalIncome = 0;
  tx.forEach(t => {
    if (t.type === "income") {
      const source = t.description || "Income";
      if (!incomeSources[source]) {
        incomeSources[source] = 0;
      }
      incomeSources[source] += t.amount;
      totalIncome += t.amount;
    }
  });

  // Calculate expenses by category
  const categoryTotals = {};
  let totalExpenses = 0;
  categories.forEach(c => {
    categoryTotals[c.id] = {
      name: c.name,
      amount: 0,
      color: c.color
    };
  });

  tx.forEach(t => {
    if (t.type === "expense" && categoryTotals[t.categoryId]) {
      categoryTotals[t.categoryId].amount += t.amount;
      totalExpenses += t.amount;
    }
  });

  // Check if we have any data
  if (totalIncome === 0 && totalExpenses === 0) {
    chartDiv.innerHTML = 
      '<div style="text-align:center; padding:50px; color:var(--text-secondary);">No income or expense data to display</div>';
    return;
  }

  // Build Sankey data structure
  const labels = [];
  const source = [];
  const target = [];
  const value = [];
  const linkColors = [];
  const nodeColors = [];

  // Add income source nodes
  const incomeIndices = {};
  if (totalIncome > 0) {
    const sortedIncomeSources = Object.entries(incomeSources)
      .sort((a, b) => b[1] - a[1]);
    
    sortedIncomeSources.forEach(([sourceName, amount]) => {
      const incomeIndex = labels.length;
      incomeIndices[sourceName] = incomeIndex;
      labels.push(sourceName);
      nodeColors.push(CHART_COLORS.SANKEY_NODE);
    });

    const combinedIncomeIndex = labels.length;
    labels.push("Income");
    nodeColors.push("rgba(56, 189, 248, 0.7)");

    sortedIncomeSources.forEach(([sourceName, amount]) => {
      source.push(incomeIndices[sourceName]);
      target.push(combinedIncomeIndex);
      value.push(amount);
      linkColors.push("rgba(96, 165, 250, 0.4)");
    });

    // Group expenses by category and description
    const categoryGroups = {};
    const descriptionGroups = {};
    
    tx.forEach(t => {
      if (t.type === "expense") {
        const cat = categories.find(c => c.id === t.categoryId);
        if (!cat) return;
        
        const categoryName = cat.name;
        const description = (t.description || "Other").trim();
        
        if (!categoryGroups[categoryName]) {
          categoryGroups[categoryName] = {
            categoryName: categoryName,
            amount: 0,
            color: cat.color
          };
        }
        categoryGroups[categoryName].amount += t.amount;
        
        const descKey = `${categoryName}|${description}`;
        if (!descriptionGroups[descKey]) {
          descriptionGroups[descKey] = {
            categoryName: categoryName,
            description: description,
            amount: 0,
            color: cat.color
          };
        }
        descriptionGroups[descKey].amount += t.amount;
      }
    });

    // Add category nodes
    const categoryIndices = {};
    const sortedCategories = Object.values(categoryGroups).sort((a, b) => b.amount - a.amount);
    
    sortedCategories.forEach(category => {
      const categoryIndex = labels.length;
      categoryIndices[category.categoryName] = categoryIndex;
      const pct = ((category.amount / totalIncome) * 100).toFixed(1);
      labels.push(`${category.categoryName}<br>${formatMoney(category.amount)} (${pct}%)`);
      
      const hex = category.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      nodeColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
      
      source.push(combinedIncomeIndex);
      target.push(categoryIndex);
      value.push(category.amount);
      linkColors.push(`rgba(${r}, ${g}, ${b}, 0.5)`);
    });

    // Add individual transaction description nodes
    const sortedDescriptions = Object.values(descriptionGroups).sort((a, b) => {
      if (a.categoryName !== b.categoryName) {
        const catA = categoryIndices[a.categoryName];
        const catB = categoryIndices[b.categoryName];
        return (catA || 0) - (catB || 0);
      }
      return b.amount - a.amount;
    });
    
    sortedDescriptions.forEach(expense => {
      const expenseIndex = labels.length;
      const categoryIndex = categoryIndices[expense.categoryName];
      const pct = ((expense.amount / totalIncome) * 100).toFixed(1);
      labels.push(`${expense.description}<br>${formatMoney(expense.amount)} (${pct}%)`);
      
      const hex = expense.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      nodeColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);

      source.push(categoryIndex);
      target.push(expenseIndex);
      value.push(expense.amount);
      linkColors.push(`rgba(${r}, ${g}, ${b}, 0.5)`);
    });
  } else if (totalExpenses > 0) {
    // If no income but we have expenses, show expenses only
    categories.forEach(c => {
      if (categoryTotals[c.id].amount > 0) {
        const catIndex = labels.length;
        labels.push(c.name);
        const hex = c.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        nodeColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
      }
    });
  }

  if (labels.length === 0 || source.length === 0) {
    chartDiv.innerHTML = 
      '<div style="text-align:center; padding:50px; color:var(--text-secondary);">No data to display</div>';
    return;
  }

  const nodePad = isSmallMobile ? 10 : (isMobile ? 15 : 25);
  const nodeThickness = isSmallMobile ? 18 : (isMobile ? 22 : 25);
  
  const sankeyData = {
    type: "sankey",
    orientation: "h",
    arrangement: "snap",
    node: {
      pad: nodePad,
      thickness: nodeThickness,
      line: {
        color: "#334155",
        width: isMobile ? 0.3 : 0.5
      },
      label: labels,
      color: nodeColors,
      labelfont: {
        size: isSmallMobile ? 10 : (isMobile ? 11 : 11)
      },
      labelposition: "right",
      labelside: "right"
    },
    link: {
      source: source,
      target: target,
      value: value,
      color: linkColors,
      hovertemplate: "$%{value:,.2f}<extra></extra>"
    }
  };

  const layout = {
    title: {
      text: "",
      font: {
        color: "#e2e8f0",
        size: 16
      }
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#e2e8f0',
      size: isSmallMobile ? 9 : (isMobile ? 10 : 11)
    },
    margin: {
      l: isSmallMobile ? 0 : (isMobile ? 0 : 30),
      r: isSmallMobile ? 0 : (isMobile ? 0 : 180),
      t: isSmallMobile ? 10 : (isMobile ? 15 : 20),
      b: isSmallMobile ? 10 : (isMobile ? 15 : 20),
      pad: isSmallMobile ? 8 : (isMobile ? 12 : 15)
    },
    autosize: true,
    width: null,
    height: isSmallMobile ? 600 : (isMobile ? 700 : null)
  };

  const config = {
    displayModeBar: true,
    modeBarButtonsToAdd: ['zoomIn2d', 'zoomOut2d', 'resetScale2d', 'pan2d'],
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
    responsive: true,
    autosizable: true,
    staticPlot: false,
    scrollZoom: 'cartesian',
    doubleClick: 'reset',
    dragMode: 'pan'
  };

  sankeyChartDiv = chartDiv;
  
  chartDiv.innerHTML = "";
  
  const container = chartDiv.parentElement;
  const chartBox = container?.parentElement;
  
  if (container) {
    container.style.width = '100%';
    container.style.maxWidth = '100%';
    container.style.overflow = 'hidden';
    container.style.boxSizing = 'border-box';
  }
  
  if (chartBox) {
    chartBox.style.width = '100%';
    chartBox.style.maxWidth = '100%';
    chartBox.style.overflow = 'hidden';
    chartBox.style.boxSizing = 'border-box';
  }
  
  Plotly.newPlot("sankeyChart", [sankeyData], layout, config).then(() => {
    setTimeout(() => {
      Plotly.Plots.resize(chartDiv);
      setTimeout(() => {
        Plotly.Plots.resize(chartDiv);
      }, CHART_CONFIG.PLOTLY_RESIZE_DELAY);
    }, CHART_CONFIG.PLOTLY_RESIZE_DELAY_MOBILE);
  });
}

/**
 * Render calendar heatmap
 * Creates a calendar heatmap visualization showing daily net income/expense
 * Color intensity indicates amount (green for positive, red for negative)
 * @returns {void}
 */
export function renderCalendarHeatmap() {
  const container = document.getElementById("calendarHeatmap");
  if (!container) return;
  
  const tx = getFilteredTransactions();
  const viewedMonth = getViewedMonth();
  const [year, month] = viewedMonth.split("-");
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  
  const firstDay = new Date(yearNum, monthNum - 1, 1);
  const lastDay = new Date(yearNum, monthNum, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();
  
  const netByDay = {};
  tx.forEach(t => {
    const txDate = new Date(t.date);
    if (txDate.getFullYear() === yearNum && txDate.getMonth() === monthNum - 1) {
      const day = txDate.getDate();
      if (!netByDay[day]) {
        netByDay[day] = { income: 0, expenses: 0, net: 0 };
      }
      if (t.type === "income") {
        netByDay[day].income += t.amount;
      } else if (t.type === "expense") {
        netByDay[day].expenses += t.amount;
      }
      netByDay[day].net = netByDay[day].income - netByDay[day].expenses;
    }
  });
  
  const allNets = Object.values(netByDay).map(d => Math.abs(d.net));
  const maxAbsNet = Math.max(...allNets, 0);
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let html = '<div class="calendar-grid">';
  
  dayNames.forEach(day => {
    html += `<div class="calendar-day-header">${day}</div>`;
  });
  
  for (let i = 0; i < startDayOfWeek; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = netByDay[day] || { income: 0, expenses: 0, net: 0 };
    const net = dayData.net;
    
    const intensity = maxAbsNet > 0 ? Math.min(1, Math.abs(net) / maxAbsNet) : 0;
    
    let bgColor, textColor;
    
    if (net > 0) {
      const r = Math.floor(209 - (intensity * 150));
      const g = Math.floor(CHART_COLORS.CALENDAR_HEATMAP_GREEN_BASE - (intensity * CHART_COLORS.CALENDAR_HEATMAP_GREEN_RANGE));
      const b = Math.floor(229 - (intensity * 160));
      bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0.4, 0.3 + intensity * 0.5)})`;
      textColor = intensity > 0.6 ? '#fff' : 'var(--text-primary)';
    } else if (net < 0) {
      const r = Math.floor(254 - (intensity * 30));
      const g = Math.floor(226 - (intensity * 160));
      const b = Math.floor(226 - (intensity * 160));
      bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0.4, 0.3 + intensity * 0.5)})`;
      textColor = intensity > 0.6 ? '#fff' : 'var(--text-primary)';
    } else {
      bgColor = 'rgba(148, 163, 184, 0.2)';
      textColor = 'var(--text-primary)';
    }
    
    const dateStr = `${yearNum}-${month.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateFormatted = formatDate(dateStr);
    const netFormatted = formatMoney(net);
    const incomeFormatted = formatMoney(dayData.income);
    const expensesFormatted = formatMoney(dayData.expenses);
    
    html += `
      <div class="calendar-day" 
           style="background: ${bgColor}; color: ${textColor};"
           data-date="${dateStr}"
           data-net="${net}"
           data-tooltip="${dateFormatted}: Net ${netFormatted} (Income: ${incomeFormatted}, Expenses: ${expensesFormatted})">
        ${day}
      </div>
    `;
  }
  
  html += '</div>';
  
  // Legend
  html += '<div class="calendar-legend">';
  html += '<span style="font-weight: 600; margin-right: 8px;">Net:</span>';
  html += '<span style="margin-right: 12px; color: var(--text-secondary); font-size: 11px;">Positive:</span>';
  
  const positiveSteps = [
    { label: '+$100+', value: 1 },
    { label: '+$50', value: 0.5 },
    { label: '+$25', value: 0.25 }
  ];
  
  positiveSteps.forEach(step => {
    const r = Math.floor(209 - (step.value * 150));
    const g = Math.floor(CHART_COLORS.CALENDAR_HEATMAP_GREEN_BASE - (step.value * CHART_COLORS.CALENDAR_HEATMAP_GREEN_RANGE));
    const b = Math.floor(229 - (step.value * 160));
    const bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0.4, 0.3 + step.value * 0.5)})`;
    
    html += `
      <div class="calendar-legend-item">
        <div class="calendar-legend-color" style="background: ${bgColor};"></div>
        <span>${step.label}</span>
      </div>
    `;
  });
  
  html += `
    <div class="calendar-legend-item">
      <div class="calendar-legend-color" style="background: rgba(148, 163, 184, 0.2);"></div>
      <span>$0</span>
    </div>
  `;
  
  html += '<span style="margin-left: 12px; margin-right: 12px; color: var(--text-secondary); font-size: 11px;">Negative:</span>';
  const negativeSteps = [
    { label: '-$25', value: 0.25 },
    { label: '-$50', value: 0.5 },
    { label: '-$100+', value: 1 }
  ];
  
  negativeSteps.forEach(step => {
    const r = Math.floor(254 - (step.value * 30));
    const g = Math.floor(226 - (step.value * 160));
    const b = Math.floor(226 - (step.value * 160));
    const bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0.4, 0.3 + step.value * 0.5)})`;
    
    html += `
      <div class="calendar-legend-item">
        <div class="calendar-legend-color" style="background: ${bgColor};"></div>
        <span>${step.label}</span>
      </div>
    `;
  });
  
  html += '</div>';
  
  container.innerHTML = html;
  
  // Add tooltip functionality
  const existingTooltips = document.querySelectorAll('.calendar-tooltip');
  existingTooltips.forEach(tt => tt.remove());
  
  container.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
    const tooltip = document.createElement('div');
    tooltip.className = 'calendar-tooltip';
    tooltip.textContent = day.dataset.tooltip;
    document.body.appendChild(tooltip);
    
    day.addEventListener('mouseenter', () => {
      const rect = day.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 8;
      
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top < 10) {
        top = rect.bottom + 8;
      }
      
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.classList.add('show');
    });
    
    day.addEventListener('mouseleave', () => {
      tooltip.classList.remove('show');
    });
  });
}

/**
 * Render bill reminders section
 * Displays upcoming recurring transactions (bills) with days until due date
 * @returns {void}
 */
export function renderBillReminders() {
  const container = document.getElementById('remindersList');
  if (!container) return;
  
  const recurring = stateManager.getActiveData().recurringTransactions || [];
  const reminders = [];
  
  recurring.forEach(r => {
    if (r.type === 'expense') {
      const nextDate = new Date(r.nextDate || r.next_date);
      const today = new Date();
      const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil <= BILL_REMINDER_DAYS) {
        reminders.push({ ...r, daysUntil });
      }
    }
  });
  
  reminders.sort((a, b) => a.daysUntil - b.daysUntil);
  
  container.innerHTML = '';
  
  if (reminders.length === 0) {
    container.innerHTML = `<p style="color: var(--text-secondary); font-size: 14px;">No upcoming bills in the next ${BILL_REMINDER_DAYS} days.</p>`;
    return;
  }
  
  reminders.forEach(rem => {
    const div = document.createElement('div');
    div.className = `reminder-item ${rem.daysUntil <= BILL_REMINDER_URGENT_DAYS ? 'urgent' : ''}`;
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${rem.description}</strong>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            ${formatMoney(rem.amount)} due ${formatDate(rem.nextDate || rem.next_date)} (${rem.daysUntil} ${rem.daysUntil === 1 ? 'day' : 'days'})
          </div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

/**
 * Render reports section
 * Generates and displays financial reports including spending trends and category breakdowns
 * @returns {void}
 */
export function renderReports() {
  const container = document.getElementById('reportsContent');
  if (!container) return;
  
  const data = stateManager.getActiveData();
  const transactions = data.transactions || [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const currentIncome = currentMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const currentExpenses = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonthStr));
  const lastIncome = lastMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const lastExpenses = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  const categoryTotals = {};
  currentMonthTx.forEach(t => {
    if (t.type === 'expense') {
      categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
    }
  });
  
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId, total]) => {
      const cat = data.categories.find(c => c.id === catId);
      return { name: cat ? cat.name : 'Unknown', total };
    });
  
  container.innerHTML = `
    <div class="report-section">
      <h3 style="margin-top: 0;">Monthly Comparison</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div style="font-size: 12px; color: var(--text-secondary);">This Month</div>
          <div style="font-size: 18px; font-weight: bold; margin-top: 4px;">Income: ${formatMoney(currentIncome)}</div>
          <div style="font-size: 18px; font-weight: bold;">Expenses: ${formatMoney(currentExpenses)}</div>
          <div style="font-size: 18px; font-weight: bold; color: ${currentIncome - currentExpenses >= 0 ? 'var(--success)' : 'var(--danger)'};">
            Net: ${formatMoney(currentIncome - currentExpenses)}
          </div>
        </div>
        <div>
          <div style="font-size: 12px; color: var(--text-secondary);">Last Month</div>
          <div style="font-size: 18px; font-weight: bold; margin-top: 4px;">Income: ${formatMoney(lastIncome)}</div>
          <div style="font-size: 18px; font-weight: bold;">Expenses: ${formatMoney(lastExpenses)}</div>
          <div style="font-size: 18px; font-weight: bold; color: ${lastIncome - lastExpenses >= 0 ? 'var(--success)' : 'var(--danger)'};">
            Net: ${formatMoney(lastIncome - lastExpenses)}
          </div>
        </div>
      </div>
    </div>
    <div class="report-section">
      <h3>Top Spending Categories (This Month)</h3>
      ${topCategories.length > 0 ? topCategories.map(cat => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
          <span>${cat.name}</span>
          <strong>${formatMoney(cat.total)}</strong>
        </div>
      `).join('') : '<p style="color: var(--text-secondary);">No expenses this month</p>'}
    </div>
  `;
}

/**
 * Render insights section
 * Analyzes transaction data and displays actionable financial insights
 * @returns {void}
 */
export function renderInsights() {
  const container = document.getElementById('insightsContent');
  if (!container) return;
  
  const data = stateManager.getActiveData();
  const transactions = data.transactions || [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonthStr));
  
  const currentCategoryTotals = {};
  const lastCategoryTotals = {};
  
  currentMonthTx.forEach(t => {
    if (t.type === 'expense') {
      currentCategoryTotals[t.categoryId] = (currentCategoryTotals[t.categoryId] || 0) + t.amount;
    }
  });
  
  lastMonthTx.forEach(t => {
    if (t.type === 'expense') {
      lastCategoryTotals[t.categoryId] = (lastCategoryTotals[t.categoryId] || 0) + t.amount;
    }
  });
  
  const insights = [];
  
  Object.keys(currentCategoryTotals).forEach(catId => {
    const current = currentCategoryTotals[catId];
    const last = lastCategoryTotals[catId] || 0;
    if (last > 0) {
      const change = ((current - last) / last) * 100;
      if (Math.abs(change) >= PERCENTAGE_THRESHOLDS.CATEGORY_SPENDING_CHANGE) {
        const cat = data.categories.find(c => c.id === catId);
        if (cat) {
          insights.push({
            type: change > 0 ? 'warning' : 'positive',
            message: `You spent ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'} on ${cat.name} this month compared to last month.`
          });
        }
      }
    }
  });
  
  const currentTotal = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const lastTotal = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  if (lastTotal > 0) {
    const change = ((currentTotal - lastTotal) / lastTotal) * 100;
    if (Math.abs(change) >= PERCENTAGE_THRESHOLDS.TOTAL_SPENDING_CHANGE) {
      insights.push({
        type: change > 0 ? 'danger' : 'positive',
        message: `Your total spending is ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'higher' : 'lower'} than last month.`
      });
    }
  }
  
  data.categories.forEach(cat => {
    if (cat.monthlyBudget || cat.monthly_budget) {
      const budget = cat.monthlyBudget || cat.monthly_budget;
      const spent = currentCategoryTotals[cat.id] || 0;
      const percentage = (spent / budget) * 100;
      if (percentage >= PERCENTAGE_THRESHOLDS.BUDGET_WARNING) {
        insights.push({
          type: percentage >= PERCENTAGE_THRESHOLDS.BUDGET_EXCEEDED ? 'danger' : 'warning',
          message: `${cat.name} budget: ${percentage.toFixed(0)}% used (${formatMoney(spent)} / ${formatMoney(budget)})`
        });
      }
    }
  });
  
  container.innerHTML = '';
  
  if (insights.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No insights available yet. Add more transactions to see spending patterns.</p>';
    return;
  }
  
  insights.forEach(insight => {
    const div = document.createElement('div');
    div.className = `insight-card ${insight.type}`;
    div.textContent = insight.message;
    container.appendChild(div);
  });
}

/**
 * Setup chart resize handler
 */
function setupChartResizeHandler() {
  function handleChartsResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Resize Sankey chart
      if (sankeyChartDiv && typeof Plotly !== 'undefined') {
        const container = sankeyChartDiv.parentElement;
        if (container) {
          container.style.width = '100%';
          container.style.maxWidth = '100%';
        }
        Plotly.Plots.resize(sankeyChartDiv);
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
          setTimeout(() => {
            Plotly.Plots.resize(sankeyChartDiv);
          }, CHART_CONFIG.PLOTLY_RESIZE_DELAY_MOBILE);
        }
      }
      
      // Resize Chart.js charts
      if (categoryChart) {
        categoryChart.resize();
      }
      if (monthlyChart) {
        monthlyChart.resize();
      }
    }, RESIZE_DEBOUNCE);
  }
  
  window.addEventListener('resize', handleChartsResize);
}

/**
 * Main render function - orchestrates all rendering
 * Calls all individual render functions to update the entire UI
 * Should be called after data changes or when switching budgets
 * @returns {void}
 */
export function renderAll() {
  updateCurrentDate();
  renderProfileSelector();
  updateMonthYearSelectors();
  renderCategoryFilters();
  renderKpis();
  renderTransactionsTable();
  renderSavingsGoals();
  renderCategoryChart();
  renderMonthlyChart();
  renderSankeyChart();
  renderCalendarHeatmap();
  renderRecurringTransactions();
  renderDebts();
  renderFinancialGoals();
  renderBillReminders();
  renderReports();
  renderInsights();
}

/**
 * Get chart instances for external access
 * Returns references to active chart instances (categoryChart, monthlyChart, sankeyChartDiv)
 * Useful for programmatic chart manipulation or cleanup
 * @returns {Object} Object containing chart instances: { categoryChart, monthlyChart, sankeyChartDiv }
 */
export function getChartInstances() {
  return {
    categoryChart,
    monthlyChart,
    sankeyChartDiv
  };
}

