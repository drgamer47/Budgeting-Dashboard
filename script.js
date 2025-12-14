/************************************************************
  STATE + PROFILE SYSTEM + HELPERS
************************************************************/

// Default categories for new profiles
const DEFAULT_CATEGORIES = [
  { id: "rent", name: "Rent", color: "#f87171", monthlyBudget: 1200 },
  { id: "groceries", name: "Groceries", color: "#4ade80", monthlyBudget: 300 },
  { id: "transport", name: "Transport", color: "#60a5fa", monthlyBudget: 150 },
  { id: "fun", name: "Fun", color: "#c084fc", monthlyBudget: 200 },
  { id: "bills", name: "Bills", color: "#facc15", monthlyBudget: 250 },
  { id: "other", name: "Other", color: "#94a3b8", monthlyBudget: 0 }
];

// Master state with full profile isolation
let state = {
  profiles: [
    { id: "p_default", name: "Default" }
  ],
  activeProfileId: "p_default",
  dataByProfile: {
    p_default: {
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      transactions: [],
      savingsGoals: [],
      lastImportBatchIds: [],
      recurringTransactions: [],
      debts: [],
      financialGoals: []
    }
  }
};

/* ---------- Load / Save ---------- */

function saveState() {
  localStorage.setItem("budgetDashboardState_v2_profiles", JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem("budgetDashboardState_v2_profiles");
  if (!raw) {
    saveState();
    return;
  }
  try {
    state = JSON.parse(raw);

    // Ensure structural integrity
    if (!state.dataByProfile) state.dataByProfile = {};
    if (!state.profiles) state.profiles = [{ id: "p_default", name: "Default" }];
    if (!state.activeProfileId) state.activeProfileId = state.profiles[0].id;

    // Ensure each profile has all sections
    for (let p of state.profiles) {
      if (!state.dataByProfile[p.id]) {
        state.dataByProfile[p.id] = {
          categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
          transactions: [],
          savingsGoals: [],
          lastImportBatchIds: [],
          recurringTransactions: [],
          debts: [],
          financialGoals: []
        };
      }
    }

  } catch (e) {
    console.error("State load failed, resetting:", e);
    state = {
      profiles: [{ id: "p_default", name: "Default" }],
      activeProfileId: "p_default",
      dataByProfile: {
        p_default: {
          categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
          transactions: [],
          savingsGoals: [],
          lastImportBatchIds: [],
          recurringTransactions: [],
          debts: [],
          financialGoals: []
        }
      }
    };
    saveState();
  }
}

loadState();

/* ---------- Profile Helper Accessors ---------- */

function getActiveProfileId() {
  return state.activeProfileId;
}

function getActiveData() {
  return state.dataByProfile[getActiveProfileId()];
}

function setActiveData(data) {
  state.dataByProfile[getActiveProfileId()] = data;
  saveState();
}

function switchProfile(profileId) {
  state.activeProfileId = profileId;
  saveState();
  renderAll();
}

function createNewProfile(name = "New Profile") {
  const newId = "p_" + Math.random().toString(36).slice(2);
  state.profiles.push({ id: newId, name });

  state.dataByProfile[newId] = {
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    transactions: [],
    savingsGoals: [],
    lastImportBatchIds: [],
    recurringTransactions: [],
    debts: [],
    financialGoals: []
  };

  state.activeProfileId = newId;
  saveState();
  renderAll();
}

/* ---------- Utility Helpers ---------- */

function showToast(message, title = "") {
  const box = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = (title ? title + ": " : "") + message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = 0;
    setTimeout(() => box.removeChild(el), 500);
  }, 3000);
}

function formatMoney(n) {
  const symbol = settings?.currencySymbol || '$';
  return symbol + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Parse YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr; // Return as-is if not in expected format
  
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  const format = settings?.dateFormat || 'YYYY-MM-DD';
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
    default:
      return dateStr;
  }
}

function currentMonthISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

let viewedMonth = currentMonthISO(new Date());
let showAllMonths = false;

// Table sorting state
let sortColumn = 'date';
let sortDirection = 'desc'; // 'asc' or 'desc'

/* ---------- Render Month Label ---------- */

function updateMonthLabel() {
  const [year, month] = viewedMonth.split("-");
  const d = new Date(year, month - 1, 1);
  const str = d.toLocaleString("default", { month: "long", year: "numeric" });
  document.getElementById("currentMonthLabel").textContent = str;
}

/* ---------- Navigation ---------- */

function nextMonth() {
  const [y, m] = viewedMonth.split("-");
  let year = parseInt(y, 10);
  let month = parseInt(m, 10);
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
  viewedMonth = `${year}-${month.toString().padStart(2, "0")}`;
  renderAll();
}

function prevMonth() {
  const [y, m] = viewedMonth.split("-");
  let year = parseInt(y, 10);
  let month = parseInt(m, 10);
  month--;
  if (month < 1) {
    month = 12;
    year--;
  }
  viewedMonth = `${year}-${month.toString().padStart(2, "0")}`;
  renderAll();
}

/* ---------- Filter UI ---------- */

function getFilteredTransactions() {
  const data = getActiveData();
  let tx = data.transactions.slice();

  if (!showAllMonths) {
    tx = tx.filter(t => t.date.startsWith(viewedMonth));
  }

  const search = document.getElementById("searchBox").value.toLowerCase().trim();
  if (search) {
    tx = tx.filter(t => t.description.toLowerCase().includes(search));
  }

  const typeFilter = document.getElementById("filterType").value;
  if (typeFilter) {
    tx = tx.filter(t => t.type === typeFilter);
  }

  const catFilter = document.getElementById("filterCategory").value;
  if (catFilter) {
    tx = tx.filter(t => t.categoryId === catFilter);
  }

  // Apply sorting
  tx.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortColumn) {
      case 'date':
        aVal = a.date;
        bVal = b.date;
        break;
      case 'description':
        aVal = a.description.toLowerCase();
        bVal = b.description.toLowerCase();
        break;
      case 'type':
        aVal = a.type;
        bVal = b.type;
        break;
      case 'category':
        const catA = data.categories.find(c => c.id === a.categoryId);
        const catB = data.categories.find(c => c.id === b.categoryId);
        aVal = catA ? catA.name.toLowerCase() : '';
        bVal = catB ? catB.name.toLowerCase() : '';
        break;
      case 'amount':
        aVal = a.amount;
        bVal = b.amount;
        break;
      default:
        aVal = a.date;
        bVal = b.date;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return tx;
}

function sortTable(column) {
  // If clicking the same column, toggle direction
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  renderTransactionsTable();
  updateSortIndicators();
}

function updateSortIndicators() {
  // Remove all sort indicators
  document.querySelectorAll('.sort-indicator').forEach(ind => {
    ind.textContent = '';
    ind.className = 'sort-indicator';
  });
  
  // Add indicator to active column
  const activeHeader = document.querySelector(`th[data-sort="${sortColumn}"]`);
  if (activeHeader) {
    const indicator = activeHeader.querySelector('.sort-indicator');
    if (indicator) {
      indicator.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      indicator.className = 'sort-indicator active';
    }
  }
}

/************************************************************
  RENDERING + CHARTS + DRAWER + PROFILES
************************************************************/

/* ---------- Render Profile Selector ---------- */
function renderProfileSelector() {
  const sel = document.getElementById("profileSelect");
  sel.innerHTML = "";
  state.profiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === state.activeProfileId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ---------- Render Categories Dropdowns ---------- */
function renderCategoryFilters() {
  const data = getActiveData();
  const catSel = document.getElementById("filterCategory");
  const drawerCat = document.getElementById("drawerCategory");

  catSel.innerHTML = `<option value="">Category: All</option>`;
  drawerCat.innerHTML = "";

  data.categories.forEach(c => {
    const o1 = document.createElement("option");
    o1.value = c.id;
    o1.textContent = c.name;
    catSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = c.id;
    o2.textContent = c.name;
    drawerCat.appendChild(o2);
  });
}

/* ---------- Render KPIs ---------- */
function renderKpis() {
  const tx = getFilteredTransactions();

  let income = 0, expense = 0;

  tx.forEach(t => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });

  const net = income - expense;

  document.getElementById("kpiIncome").textContent = formatMoney(income);
  document.getElementById("kpiExpenses").textContent = formatMoney(expense);
  document.getElementById("kpiNet").textContent = formatMoney(net);

  // Savings = sum of all goals current stored amount
  const goals = getActiveData().savingsGoals || [];
  const totalSaved = goals.reduce((s, g) => s + (g.current || 0), 0);
  document.getElementById("kpiSavings").textContent = formatMoney(totalSaved);
}

/* ---------- Render Transactions Table ---------- */
function renderTransactionsTable() {
  const body = document.getElementById("transactionsTableBody");
  body.innerHTML = "";

  const tx = getFilteredTransactions();
  const categories = getActiveData().categories;

  tx.forEach(t => {
    const tr = document.createElement("tr");

    const cat = categories.find(c => c.id === t.categoryId);

    tr.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${t.description}${t.merchant ? `<span class="merchant-badge">${t.merchant}</span>` : ''}</td>
      <td><span class="badge-${t.type}">${t.type}</span></td>
      <td>${cat ? cat.name : "—"}</td>
      <td>${formatMoney(t.amount)}</td>
      <td>
        <button data-id="${t.id}" class="editBtn">✎</button>
        <button data-id="${t.id}" class="deleteBtn">🗑</button>
      </td>
    `;

    body.appendChild(tr);
  });

  // Add button listeners
  body.querySelectorAll(".editBtn").forEach(b => {
    b.addEventListener("click", () => openDrawerForEdit(b.dataset.id));
  });

  body.querySelectorAll(".deleteBtn").forEach(b => {
    b.addEventListener("click", () => deleteTransaction(b.dataset.id));
  });
  
  // Update sort indicators
  updateSortIndicators();
}

/* ---------- Render Savings Goals ---------- */
function renderGoals() {
  const list = document.getElementById("goalsList");
  list.innerHTML = "";

  const goals = getActiveData().savingsGoals;

  goals.forEach(g => {
    const percent = Math.min(100, (g.current / g.target) * 100);

    const div = document.createElement("div");
    div.className = "goal-item";
    div.innerHTML = `
      <div class="goal-label"><b>${g.name}</b> — ${formatMoney(g.current)} / ${formatMoney(g.target)}</div>
      <div class="goal-bar"><div class="goal-fill" style="width:${percent}%"></div></div>
      <button data-id="${g.id}" class="addToSavingsBtn" style="margin-top:6px; background:var(--success); color:var(--text-primary);">Add to Savings</button>
      <button data-id="${g.id}" class="editGoalBtn" style="margin-left:6px;">Edit</button>
      <button data-id="${g.id}" class="deleteGoalBtn" style="margin-left:6px;">Delete</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".addToSavingsBtn").forEach(btn => {
    btn.addEventListener("click", () => addToSavings(btn.dataset.id));
  });
  list.querySelectorAll(".editGoalBtn").forEach(btn => {
    btn.addEventListener("click", () => editGoal(btn.dataset.id));
  });
  list.querySelectorAll(".deleteGoalBtn").forEach(btn => {
    btn.addEventListener("click", () => deleteGoal(btn.dataset.id));
  });
}

/* ---------- Charts ---------- */

let categoryChart = null;
let monthlyChart = null;

function renderCategoryChart() {
  const ctx = document.getElementById("categoryChart");
  const tx = getFilteredTransactions();
  const cats = getActiveData().categories;

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

  if (categoryChart) categoryChart.destroy();

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

function renderMonthlyChart() {
  const ctx = document.getElementById("monthlyChart");

  const data = getActiveData().transactions;

  // group last 6 months income/expenses
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = currentMonthISO(d);
    months.push(key);
  }

  const incomeArr = months.map(m => {
    return data.filter(t => t.date.startsWith(m) && t.type === "income")
               .reduce((s, t) => s + t.amount, 0);
  });
  const expenseArr = months.map(m => {
    return data.filter(t => t.date.startsWith(m) && t.type === "expense")
               .reduce((s, t) => s + t.amount, 0);
  });

  if (monthlyChart) monthlyChart.destroy();

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

/* ---------- Drawer Logic ---------- */

let editTransactionId = null;

function openDrawerForAdd() {
  editTransactionId = null;
  document.getElementById("drawerTitle").textContent = "Add Transaction";
  document.getElementById("drawerDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("drawerDesc").value = "";
  document.getElementById("drawerAmount").value = "";
  document.getElementById("drawerType").value = "expense";

  const cats = getActiveData().categories;
  document.getElementById("drawerCategory").value = cats.length ? cats[0].id : "";
  document.getElementById("drawerMerchant").value = "";
  document.getElementById("drawerNote").value = "";

  document.getElementById("drawer").classList.add("open");
}

function openDrawerForEdit(id) {
  editTransactionId = id;
  const data = getActiveData();
  const t = data.transactions.find(x => x.id === id);

  if (!t) return;

  document.getElementById("drawerTitle").textContent = "Edit Transaction";
  document.getElementById("drawerDate").value = t.date;
  document.getElementById("drawerDesc").value = t.description;
  document.getElementById("drawerAmount").value = t.amount;
  document.getElementById("drawerType").value = t.type;
  document.getElementById("drawerCategory").value = t.categoryId;
  document.getElementById("drawerMerchant").value = t.merchant || "";
  document.getElementById("drawerNote").value = t.note || "";

  document.getElementById("drawer").classList.add("open");
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
}

/* ---------- Save Transaction ---------- */
function saveTransactionFromDrawer() {
  const date = document.getElementById("drawerDate").value;
  const desc = document.getElementById("drawerDesc").value.trim();
  const amt = parseFloat(document.getElementById("drawerAmount").value);
  const type = document.getElementById("drawerType").value;
  const cat = document.getElementById("drawerCategory").value;
  const merchant = document.getElementById("drawerMerchant").value.trim();
  const note = document.getElementById("drawerNote").value.trim();

  if (!date || !desc || !amt) {
    showToast("Missing fields", "Error");
    return;
  }

  const data = getActiveData();

  if (editTransactionId) {
    // Edit existing
    const t = data.transactions.find(x => x.id === editTransactionId);
    t.date = date;
    t.description = desc;
    t.amount = amt;
    t.type = type;
    t.categoryId = cat;
    t.merchant = merchant;
    t.note = note;

    showToast("Transaction updated");
  } else {
    // Create new
    data.transactions.push({
      id: "tx_" + Math.random().toString(36).slice(2),
      date,
      description: desc,
      amount: amt,
      type,
      categoryId: cat,
      merchant: merchant || undefined,
      note
    });
    showToast("Transaction added");
  }

  saveState();
  closeDrawer();
  renderAll();
}

/* ---------- Delete Transaction ---------- */
function deleteTransaction(id) {
  const data = getActiveData();
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
  showToast("Transaction deleted");
}

/************************************************************
  SAVINGS GOALS + CSV IMPORT + JSON IMPORT/EXPORT +
  ALL-MONTHS TOGGLE + EVENT HANDLERS
************************************************************/

/* ---------- Savings Goals Logic ---------- */

function addGoal() {
  const name = prompt("Goal name:");
  if (!name) return;

  const target = parseFloat(prompt("Target amount:") || "");
  if (!target || target <= 0) {
    showToast("Invalid goal target", "Error");
    return;
  }

  const current = parseFloat(prompt("Current saved amount:") || "0");
  if (isNaN(current) || current < 0) {
    showToast("Invalid saved amount", "Error");
    return;
  }

  const data = getActiveData();
  data.savingsGoals.push({
    id: "goal_" + Math.random().toString(36).slice(2),
    name,
    target,
    current
  });

  saveState();
  renderAll();
  showToast("Goal added");
}

function editGoal(id) {
  const goals = getActiveData().savingsGoals;
  const g = goals.find(x => x.id === id);
  if (!g) return;

  const name = prompt("Goal name:", g.name);
  if (!name) return;

  const target = parseFloat(prompt("Target amount:", g.target) || "");
  if (!target || target <= 0) {
    showToast("Invalid target", "Error");
    return;
  }

  const current = parseFloat(prompt("Current saved:", g.current) || "");
  if (isNaN(current) || current < 0) {
    showToast("Invalid saved", "Error");
    return;
  }

  g.name = name;
  g.target = target;
  g.current = current;

  saveState();
  renderAll();
  showToast("Goal updated");
}

function deleteGoal(id) {
  let goals = getActiveData().savingsGoals;
  goals = goals.filter(g => g.id !== id);
  getActiveData().savingsGoals = goals;
  saveState();
  renderAll();
  showToast("Goal deleted");
}

function addToSavings(goalId) {
  const goals = getActiveData().savingsGoals;
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  const amountStr = prompt(`Add to "${goal.name}" savings:\n\nCurrent: ${formatMoney(goal.current)}\nTarget: ${formatMoney(goal.target)}`, "");
  if (!amountStr) return;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    showToast("Invalid amount", "Error");
    return;
  }

  const data = getActiveData();
  
  // Update the goal's current amount
  goal.current = (goal.current || 0) + amount;
  
  // Create an expense transaction for the savings transfer
  // Find or use "other" category for savings transfers
  const savingsCat = data.categories.find(c => c.name.toLowerCase().includes("savings")) || 
                     data.categories.find(c => c.id === "other") || 
                     data.categories[0];
  
  const today = new Date().toISOString().slice(0, 10);
  data.transactions.push({
    id: "tx_" + Math.random().toString(36).slice(2),
    date: today,
    description: `Savings Transfer - ${goal.name}`,
    amount: amount,
    type: "expense",
    categoryId: savingsCat.id,
    note: `Added to savings goal: ${goal.name}`
  });

  saveState();
  renderAll();
  showToast(`Added ${formatMoney(amount)} to ${goal.name}`, "Savings Updated");
}

/* ---------- JSON Export / Import ---------- */

function exportJson() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "budget-data.json";
  a.click();

  URL.revokeObjectURL(url);
  showToast("JSON exported");
}

function importJson() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";

  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);

        // Must contain our profile-based structure
        if (!obj.profiles || !obj.dataByProfile) {
          showToast("Invalid JSON structure", "Error");
          return;
        }

        state = obj;
        saveState();
        renderAll();
        showToast("JSON imported");
      } catch (err) {
        showToast("Failed to parse JSON", "Error");
      }
    };

    reader.readAsText(file);
  };

  inp.click();
}

/* ---------- CSV Import ---------- */

function importCsv() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".csv,text/csv";

  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {

      const text = reader.result;
      const lines = text.split(/\r?\n/).filter(x => x.trim());

      const data = getActiveData();
      const defaultCat = data.categories[0]?.id || "other";

      const imported = [];

      function normalizeDate(raw) {
        raw = raw.replace(/^"|"$/g, "").trim();

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // MM/DD/YYYY → YYYY-MM-DD
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
          const [mm, dd, yyyy] = raw.split("/");
          return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
        }

        return null;
      }

      function normalizeAmount(raw) {
        raw = raw.replace(/^"|"$/g, "").trim();
        raw = raw.replace(/[^0-9.\-]/g, ""); // remove junk
        if (!raw) return null;
        const n = parseFloat(raw);
        return isNaN(n) ? null : n;
      }

      for (let line of lines) {

        // Smart split that respects quotes
        let cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        if (!cols || cols.length < 3) continue;

        // Trim and strip quotes
        cols = cols.map(c => c.trim().replace(/^"|"$/g, ""));

        const rawDate = cols[0];
        const rawAmount = cols[1];
        const rawDesc = cols[2];
        const rawCategory = cols[3] ? cols[3].trim().toLowerCase() : null;

        const date = normalizeDate(rawDate);
        const amount = normalizeAmount(rawAmount);
        const desc = rawDesc.trim();

        if (!date || amount === null || !desc) continue;

        const type = amount >= 0 ? "income" : "expense";

        // Match category from CSV or use default
        let categoryId = defaultCat;
        if (rawCategory) {
          // Try to find matching category by id or name
          const matchedCat = data.categories.find(c => 
            c.id.toLowerCase() === rawCategory || 
            c.name.toLowerCase() === rawCategory
          );
          if (matchedCat) {
            categoryId = matchedCat.id;
          }
        }

        imported.push({
          id: "tx_" + Math.random().toString(36).slice(2),
          date,
          description: desc,
          amount: Math.abs(amount),
          type,
          categoryId: categoryId,
          note: ""
        });
      }

      if (!imported.length) {
        showToast("No valid CSV rows found", "CSV Import");
        return;
      }

      imported.forEach(t => data.transactions.push(t));
      data.lastImportBatchIds = imported.map(x => x.id);

      saveState();
      renderAll();
      showToast(`Imported ${imported.length} rows`, "CSV Import");
    };

    reader.readAsText(file);
  };

  inp.click();
}

/* ---------- Undo CSV Import ---------- */

function undoImport() {
  const data = getActiveData();
  const ids = data.lastImportBatchIds || [];

  if (!ids.length) {
    showToast("Nothing to undo");
    return;
  }

  data.transactions = data.transactions.filter(t => !ids.includes(t.id));
  data.lastImportBatchIds = [];

  saveState();
  renderAll();
  showToast("Last import undone");
}

/* ---------- Toggle All Months ---------- */

function toggleAllMonths() {
  showAllMonths = !showAllMonths;
  document.getElementById("toggleAllMonthsBtn").textContent = showAllMonths ? "All ✓" : "All";
  document.getElementById("toggleAllMonthsBtn").title = showAllMonths ? "Showing all months" : "Show all months";
  renderAll();
}

/* ---------- Bank Integration (Plaid) ---------- */

let plaidLink = null;
const API_BASE_URL = 'http://localhost:3000/api';

async function connectBank() {
  try {
    // Get link token from backend
    const response = await fetch(`${API_BASE_URL}/create_link_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getActiveProfileId() })
    });

    if (!response.ok) {
      throw new Error('Failed to create link token. Make sure the server is running.');
    }

    const { link_token } = await response.json();

    // Initialize Plaid Link
    if (plaidLink) {
      plaidLink.destroy();
    }

    plaidLink = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        // Exchange public token for access token
        const exchangeResponse = await fetch(`${API_BASE_URL}/exchange_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token })
        });

        const { access_token, item_id } = await exchangeResponse.json();
        
        // Store access token (in a real app, you'd want to encrypt this)
        const data = getActiveData();
        if (!data.bankConnections) data.bankConnections = [];
        data.bankConnections.push({
          item_id,
          access_token,
          institution: metadata.institution?.name || 'Unknown',
          accounts: metadata.accounts
        });
        saveState();

        // Fetch and import transactions
        await importBankTransactions(access_token);
        
        showToast(`Connected to ${metadata.institution?.name || 'bank'}`, "Bank Connected");
      },
      onExit: (err, metadata) => {
        if (err) {
          console.error('Plaid Link error:', err);
          console.error('Plaid Link metadata:', metadata);
          showToast(`Connection error: ${err.error_message || err.display_message || 'Unknown error'}`, "Connection Error");
        } else {
          showToast("Bank connection cancelled", "Info");
        }
      },
      onEvent: (eventName, metadata) => {
        console.log('Plaid Link event:', eventName, metadata);
        if (eventName === 'ERROR' && metadata) {
          console.error('Plaid Link error event:', metadata);
        }
      },
    });

    plaidLink.open();
  } catch (error) {
    console.error('Bank connection error:', error);
    showToast(`Error: ${error.message}. Make sure the server is running on port 3000.`, "Connection Error");
  }
}

async function importBankTransactions(access_token) {
  try {
    // Get last 30 days of transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log('Fetching bank transactions...', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    });

    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const responseData = await response.json();
    const transactions = responseData.transactions || [];
    
    console.log(`Received ${transactions.length} transactions from server`);
    
    if (!transactions || transactions.length === 0) {
      showToast("No transactions found in the last 30 days. Try connecting to a different test account.", "Info");
      return;
    }

    const data = getActiveData();
    const defaultCat = data.categories[0]?.id || "other";
    
    // Add transactions, avoiding duplicates
    const existingIds = new Set(data.transactions.map(t => t.plaid_id).filter(Boolean));
    let added = 0;

    transactions.forEach(tx => {
      if (!existingIds.has(tx.plaid_id)) {
        tx.categoryId = tx.categoryId || defaultCat;
        data.transactions.push(tx);
        added++;
      }
    });

    saveState();
    renderAll();
    showToast(`Imported ${added} transactions from bank`, "Bank Import");
  } catch (error) {
    console.error('Error importing transactions:', error);
    showToast("Error importing transactions", "Error");
  }
}

/* ---------- Clear Data ---------- */

function clearData() {
  const confirmMessage = "Are you sure you want to clear ALL data for the current profile?\n\nThis will delete:\n- All transactions\n- All savings goals\n- Category data will be reset to defaults\n\nThis action cannot be undone!";
  
  if (!confirm(confirmMessage)) {
    return;
  }

  // Double confirmation for safety
  if (!confirm("This is your last chance! Click OK to permanently delete all data for this profile.")) {
    return;
  }

  const data = getActiveData();
  
  // Clear transactions
  data.transactions = [];
  
  // Clear savings goals
  data.savingsGoals = [];
  
  // Reset categories to defaults
  data.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  
  // Clear import batch IDs
  data.lastImportBatchIds = [];
  
  // Clear bank connections
  data.bankConnections = [];
  
  saveState();
  renderAll();
  showToast("All data cleared for this profile", "Data Cleared");
}

/* ---------- Sankey Diagram ---------- */

function renderSankeyChart() {
  const tx = getFilteredTransactions();
  const data = getActiveData();
  const categories = data.categories;

  // Calculate income by source (group by description or use "Paychecks" as default)
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

  // Check if we have any data to display
  if (totalIncome === 0 && totalExpenses === 0) {
    // Show empty state
    document.getElementById("sankeyChart").innerHTML = 
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
      Object.keys(incomeSources).forEach((sourceName) => {
        const incomeIndex = labels.length;
        incomeIndices[sourceName] = incomeIndex;
        labels.push(sourceName);
        nodeColors.push("rgba(96, 165, 250, 0.7)"); // Slightly transparent blue
      });

      // Add combined income node (middle layer)
      const combinedIncomeIndex = labels.length;
      labels.push("Income");
      nodeColors.push("rgba(56, 189, 248, 0.7)"); // Slightly transparent cyan

      // Link income sources to combined income
      Object.keys(incomeIndices).forEach(sourceName => {
        source.push(incomeIndices[sourceName]);
        target.push(combinedIncomeIndex);
        value.push(incomeSources[sourceName]);
        linkColors.push("rgba(96, 165, 250, 0.4)"); // More transparent links
      });

    // Group expenses by category, then by description/company
    const expenseGroups = {};
    tx.forEach(t => {
      if (t.type === "expense") {
        const cat = categories.find(c => c.id === t.categoryId);
        if (!cat) return;
        
        const categoryName = cat.name;
        const description = t.description || "Other";
        
        // Create key for category + description
        const key = `${categoryName}|${description}`;
        
        if (!expenseGroups[key]) {
          expenseGroups[key] = {
            categoryName: categoryName,
            description: description,
            amount: 0,
            color: cat.color
          };
        }
        expenseGroups[key].amount += t.amount;
      }
    });

    // Add expense nodes grouped by category and description
    // Sort by amount descending to help with layout
    const sortedExpenses = Object.values(expenseGroups).sort((a, b) => b.amount - a.amount);
    
    sortedExpenses.forEach(expense => {
      const expenseIndex = labels.length;
      const pct = ((expense.amount / totalIncome) * 100).toFixed(1);
      // Include percentage in label
      labels.push(`${expense.description}<br>${formatMoney(expense.amount)} (${pct}%)`);
      
      // Convert hex color to rgba for transparency
      const hex = expense.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      nodeColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`); // Slightly transparent nodes

      // Link FROM combined income TO expense (expense flow)
      source.push(combinedIncomeIndex);
      target.push(expenseIndex);
      value.push(expense.amount);
      linkColors.push(`rgba(${r}, ${g}, ${b}, 0.5)`); // More transparent links
    });
  } else if (totalExpenses > 0) {
    // If no income but we have expenses, show expenses only
    categories.forEach(c => {
      if (categoryTotals[c.id].amount > 0) {
        const catIndex = labels.length;
        labels.push(c.name);
        // Convert hex color to rgba for transparency
        const hex = c.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        nodeColors.push(`rgba(${r}, ${g}, ${b}, 0.7)`); // Slightly transparent nodes
      }
    });
  }

  // Only render if we have data
  if (labels.length === 0 || source.length === 0) {
    document.getElementById("sankeyChart").innerHTML = 
      '<div style="text-align:center; padding:50px; color:var(--text-secondary);">No data to display</div>';
    return;
  }

  const sankeyData = {
    type: "sankey",
    orientation: "h",
    node: {
      pad: 25,
      thickness: 25,
      line: {
        color: "#334155",
        width: 0.5
      },
      label: labels,
      color: nodeColors
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
      size: 11
    },
    margin: {
      l: window.innerWidth <= 768 ? 20 : 50,
      r: window.innerWidth <= 768 ? 20 : 50,
      t: window.innerWidth <= 768 ? 10 : 20,
      b: window.innerWidth <= 768 ? 10 : 20
    }
  };

  const config = {
    displayModeBar: false,
    responsive: true
  };

  // Clear any existing plot before rendering
  const chartDiv = document.getElementById("sankeyChart");
  if (!chartDiv) return;
  
  sankeyChartDiv = chartDiv;
  
  // Always create new plot to ensure proper sizing
  chartDiv.innerHTML = "";
  Plotly.newPlot("sankeyChart", [sankeyData], layout, config).then(() => {
    // After plot is created, resize it to fit container
    setTimeout(() => {
      Plotly.Plots.resize(chartDiv);
    }, 100);
  });
}

// Store reference to Sankey chart for resize handling
let sankeyChartDiv = null;

// Handle window resize for all charts
let resizeTimeout;
function handleChartsResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Resize Sankey chart
    if (sankeyChartDiv && sankeyChartDiv.data) {
      Plotly.Plots.resize(sankeyChartDiv);
    }
    
    // Resize Chart.js charts
    if (categoryChart) {
      categoryChart.resize();
    }
    if (monthlyChart) {
      monthlyChart.resize();
    }
  }, 250);
}

// Add window resize listener
window.addEventListener('resize', handleChartsResize);

/* ---------- CENTRAL RENDER ---------- */

/* ---------- THEME TOGGLE ---------- */
function initTheme() {
  const savedTheme = localStorage.getItem('budgetDashboardTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) return;
  
  const newTheme = themeSelect.value;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('budgetDashboardTheme', newTheme);
  renderAll(); // Re-render charts with new theme
}

/* ---------- RECURRING TRANSACTIONS ---------- */
function renderRecurringTransactions() {
  const container = document.getElementById('recurringList');
  if (!container) return;
  
  const recurring = getActiveData().recurringTransactions || [];
  container.innerHTML = '';
  
  if (recurring.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No recurring transactions yet.</p>';
    return;
  }
  
  recurring.forEach(r => {
    const div = document.createElement('div');
    div.className = 'recurring-item';
    const nextDate = new Date(r.nextDate);
    const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
    div.innerHTML = `
      <div>
        <strong>${r.description}</strong> - ${formatMoney(r.amount)}
        <span class="recurring-badge">${r.frequency}</span>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
          Next: ${formatDate(r.nextDate)} (${daysUntil} days)
        </div>
      </div>
      <div>
        <button class="editRecurringBtn" data-id="${r.id}" style="margin-right: 6px;">Edit</button>
        <button class="deleteRecurringBtn" data-id="${r.id}">Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editRecurringBtn').forEach(btn => {
    btn.addEventListener('click', () => editRecurring(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteRecurringBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteRecurring(btn.dataset.id));
  });
}

function addRecurring() {
  document.getElementById('recurringModalTitle').textContent = 'Add Recurring Transaction';
  document.getElementById('recurringDescInput').value = '';
  document.getElementById('recurringAmountInput').value = '';
  document.getElementById('recurringTypeInput').value = 'expense';
  document.getElementById('recurringFrequencyInput').value = 'monthly';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('recurringNextDateInput').value = tomorrow.toISOString().slice(0, 10);
  
  const cats = getActiveData().categories;
  const catSelect = document.getElementById('recurringCategoryInput');
  catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (cats.length) catSelect.value = cats[0].id;
  
  document.getElementById('deleteRecurringBtn').style.display = 'none';
  document.getElementById('recurringModal').classList.add('show');
  editingRecurringId = null;
}

let editingRecurringId = null;

function editRecurring(id) {
  const recurring = getActiveData().recurringTransactions || [];
  const r = recurring.find(x => x.id === id);
  if (!r) return;
  
  editingRecurringId = id;
  document.getElementById('recurringModalTitle').textContent = 'Edit Recurring Transaction';
  document.getElementById('recurringDescInput').value = r.description;
  document.getElementById('recurringAmountInput').value = r.amount;
  document.getElementById('recurringTypeInput').value = r.type;
  document.getElementById('recurringFrequencyInput').value = r.frequency;
  document.getElementById('recurringNextDateInput').value = r.nextDate;
  
  const cats = getActiveData().categories;
  const catSelect = document.getElementById('recurringCategoryInput');
  catSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  catSelect.value = r.categoryId;
  
  document.getElementById('deleteRecurringBtn').style.display = 'block';
  document.getElementById('recurringModal').classList.add('show');
}

function saveRecurring() {
  const desc = document.getElementById('recurringDescInput').value.trim();
  const amount = parseFloat(document.getElementById('recurringAmountInput').value);
  const type = document.getElementById('recurringTypeInput').value;
  const categoryId = document.getElementById('recurringCategoryInput').value;
  const frequency = document.getElementById('recurringFrequencyInput').value;
  const nextDate = document.getElementById('recurringNextDateInput').value;
  
  if (!desc || !amount || !nextDate) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  const data = getActiveData();
  if (!data.recurringTransactions) data.recurringTransactions = [];
  
  if (editingRecurringId) {
    const r = data.recurringTransactions.find(x => x.id === editingRecurringId);
    if (r) {
      r.description = desc;
      r.amount = amount;
      r.type = type;
      r.categoryId = categoryId;
      r.frequency = frequency;
      r.nextDate = nextDate;
    }
    showToast('Recurring transaction updated');
  } else {
    data.recurringTransactions.push({
      id: 'recur_' + Math.random().toString(36).slice(2),
      description: desc,
      amount,
      type,
      categoryId,
      frequency,
      nextDate
    });
    showToast('Recurring transaction added');
  }
  
  saveState();
  closeRecurringModal();
  renderAll();
}

function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;
  const data = getActiveData();
  if (data.recurringTransactions) {
    data.recurringTransactions = data.recurringTransactions.filter(r => r.id !== id);
  }
  saveState();
  renderAll();
  showToast('Recurring transaction deleted');
}

function closeRecurringModal() {
  document.getElementById('recurringModal').classList.remove('show');
  editingRecurringId = null;
}

/* ---------- DEBT TRACKING ---------- */
function renderDebts() {
  const container = document.getElementById('debtList');
  if (!container) return;
  
  const debts = getActiveData().debts || [];
  container.innerHTML = '';
  
  if (debts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No debts tracked yet.</p>';
    return;
  }
  
  debts.forEach(d => {
    const div = document.createElement('div');
    div.className = 'debt-item';
    const percentPaid = d.originalBalance ? ((d.originalBalance - d.currentBalance) / d.originalBalance * 100) : 0;
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            Balance: ${formatMoney(d.currentBalance)} | Interest: ${d.interestRate}% | Min Payment: ${formatMoney(d.minPayment)}
          </div>
        </div>
        <div>
          <button class="editDebtBtn" data-id="${d.id}" style="margin-right: 6px;">Edit</button>
          <button class="deleteDebtBtn" data-id="${d.id}">Delete</button>
        </div>
      </div>
      <div class="debt-progress">
        <div class="debt-progress-fill" style="width: ${Math.min(100, percentPaid)}%"></div>
      </div>
      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
        ${percentPaid.toFixed(1)}% paid off
      </div>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editDebtBtn').forEach(btn => {
    btn.addEventListener('click', () => editDebt(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteDebtBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteDebt(btn.dataset.id));
  });
}

let editingDebtId = null;

function addDebt() {
  document.getElementById('debtModalTitle').textContent = 'Add Debt';
  document.getElementById('debtNameInput').value = '';
  document.getElementById('debtBalanceInput').value = '';
  document.getElementById('debtInterestInput').value = '';
  document.getElementById('debtMinPaymentInput').value = '';
  document.getElementById('debtTargetDateInput').value = '';
  document.getElementById('deleteDebtBtn').style.display = 'none';
  document.getElementById('debtModal').classList.add('show');
  editingDebtId = null;
}

function editDebt(id) {
  const debts = getActiveData().debts || [];
  const d = debts.find(x => x.id === id);
  if (!d) return;
  
  editingDebtId = id;
  document.getElementById('debtModalTitle').textContent = 'Edit Debt';
  document.getElementById('debtNameInput').value = d.name;
  document.getElementById('debtBalanceInput').value = d.currentBalance;
  document.getElementById('debtInterestInput').value = d.interestRate || 0;
  document.getElementById('debtMinPaymentInput').value = d.minPayment || 0;
  document.getElementById('debtTargetDateInput').value = d.targetDate || '';
  document.getElementById('deleteDebtBtn').style.display = 'block';
  document.getElementById('debtModal').classList.add('show');
}

function saveDebt() {
  const name = document.getElementById('debtNameInput').value.trim();
  const balance = parseFloat(document.getElementById('debtBalanceInput').value);
  const interest = parseFloat(document.getElementById('debtInterestInput').value) || 0;
  const minPayment = parseFloat(document.getElementById('debtMinPaymentInput').value) || 0;
  const targetDate = document.getElementById('debtTargetDateInput').value;
  
  if (!name || isNaN(balance) || balance <= 0) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  const data = getActiveData();
  if (!data.debts) data.debts = [];
  
  if (editingDebtId) {
    const d = data.debts.find(x => x.id === editingDebtId);
    if (d) {
      d.name = name;
      d.currentBalance = balance;
      d.interestRate = interest;
      d.minPayment = minPayment;
      d.targetDate = targetDate || undefined;
      if (!d.originalBalance) d.originalBalance = balance;
    }
    showToast('Debt updated');
  } else {
    data.debts.push({
      id: 'debt_' + Math.random().toString(36).slice(2),
      name,
      currentBalance: balance,
      originalBalance: balance,
      interestRate: interest,
      minPayment,
      targetDate: targetDate || undefined
    });
    showToast('Debt added');
  }
  
  saveState();
  closeDebtModal();
  renderAll();
}

function deleteDebt(id) {
  if (!confirm('Delete this debt?')) return;
  const data = getActiveData();
  if (data.debts) {
    data.debts = data.debts.filter(d => d.id !== id);
  }
  saveState();
  renderAll();
  showToast('Debt deleted');
}

function closeDebtModal() {
  document.getElementById('debtModal').classList.remove('show');
  editingDebtId = null;
}

/* ---------- FINANCIAL GOALS ---------- */
function renderFinancialGoals() {
  const container = document.getElementById('financialGoalsList');
  if (!container) return;
  
  const goals = getActiveData().financialGoals || [];
  container.innerHTML = '';
  
  if (goals.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No financial goals yet.</p>';
    return;
  }
  
  goals.forEach(g => {
    const div = document.createElement('div');
    div.className = 'goal-item';
    const percent = Math.min(100, (g.current / g.target) * 100);
    div.innerHTML = `
      <div class="goal-label">
        <b>${g.name}</b> (${g.type}) — ${formatMoney(g.current)} / ${formatMoney(g.target)}
        ${g.targetDate ? `<div style="font-size: 12px; color: var(--text-secondary);">Target: ${formatDate(g.targetDate)}</div>` : ''}
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${percent}%"></div></div>
      <button class="editFinancialGoalBtn" data-id="${g.id}" style="margin-top:6px;">Edit</button>
      <button class="deleteFinancialGoalBtn" data-id="${g.id}" style="margin-left:6px;">Delete</button>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editFinancialGoalBtn').forEach(btn => {
    btn.addEventListener('click', () => editFinancialGoal(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteFinancialGoalBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteFinancialGoal(btn.dataset.id));
  });
}

let editingFinancialGoalId = null;

function addFinancialGoal() {
  document.getElementById('financialGoalModalTitle').textContent = 'Add Financial Goal';
  document.getElementById('financialGoalNameInput').value = '';
  document.getElementById('financialGoalTypeInput').value = 'savings';
  document.getElementById('financialGoalTargetInput').value = '';
  document.getElementById('financialGoalCurrentInput').value = '0';
  document.getElementById('financialGoalDateInput').value = '';
  document.getElementById('deleteFinancialGoalBtn').style.display = 'none';
  document.getElementById('financialGoalModal').classList.add('show');
  editingFinancialGoalId = null;
}

function editFinancialGoal(id) {
  const goals = getActiveData().financialGoals || [];
  const g = goals.find(x => x.id === id);
  if (!g) return;
  
  editingFinancialGoalId = id;
  document.getElementById('financialGoalModalTitle').textContent = 'Edit Financial Goal';
  document.getElementById('financialGoalNameInput').value = g.name;
  document.getElementById('financialGoalTypeInput').value = g.type;
  document.getElementById('financialGoalTargetInput').value = g.target;
  document.getElementById('financialGoalCurrentInput').value = g.current;
  document.getElementById('financialGoalDateInput').value = g.targetDate || '';
  document.getElementById('deleteFinancialGoalBtn').style.display = 'block';
  document.getElementById('financialGoalModal').classList.add('show');
}

function saveFinancialGoal() {
  const name = document.getElementById('financialGoalNameInput').value.trim();
  const type = document.getElementById('financialGoalTypeInput').value;
  const target = parseFloat(document.getElementById('financialGoalTargetInput').value);
  const current = parseFloat(document.getElementById('financialGoalCurrentInput').value) || 0;
  const targetDate = document.getElementById('financialGoalDateInput').value;
  
  if (!name || !target || target <= 0) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  const data = getActiveData();
  if (!data.financialGoals) data.financialGoals = [];
  
  if (editingFinancialGoalId) {
    const g = data.financialGoals.find(x => x.id === editingFinancialGoalId);
    if (g) {
      g.name = name;
      g.type = type;
      g.target = target;
      g.current = current;
      g.targetDate = targetDate || undefined;
    }
    showToast('Financial goal updated');
  } else {
    data.financialGoals.push({
      id: 'fgoal_' + Math.random().toString(36).slice(2),
      name,
      type,
      target,
      current,
      targetDate: targetDate || undefined
    });
    showToast('Financial goal added');
  }
  
  saveState();
  closeFinancialGoalModal();
  renderAll();
}

function deleteFinancialGoal(id) {
  if (!confirm('Delete this financial goal?')) return;
  const data = getActiveData();
  if (data.financialGoals) {
    data.financialGoals = data.financialGoals.filter(g => g.id !== id);
  }
  saveState();
  renderAll();
  showToast('Financial goal deleted');
}

function closeFinancialGoalModal() {
  document.getElementById('financialGoalModal').classList.remove('show');
  editingFinancialGoalId = null;
}

/* ---------- BILL REMINDERS ---------- */
function renderBillReminders() {
  const container = document.getElementById('remindersList');
  if (!container) return;
  
  const recurring = getActiveData().recurringTransactions || [];
  const reminders = [];
  
  recurring.forEach(r => {
    if (r.type === 'expense') {
      const nextDate = new Date(r.nextDate);
      const today = new Date();
      const daysUntil = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil <= 7) {
        reminders.push({ ...r, daysUntil });
      }
    }
  });
  
  reminders.sort((a, b) => a.daysUntil - b.daysUntil);
  
  container.innerHTML = '';
  
  if (reminders.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No upcoming bills in the next 7 days.</p>';
    return;
  }
  
  reminders.forEach(rem => {
    const div = document.createElement('div');
    div.className = `reminder-item ${rem.daysUntil <= 3 ? 'urgent' : ''}`;
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${rem.description}</strong>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            ${formatMoney(rem.amount)} due ${formatDate(rem.nextDate)} (${rem.daysUntil} ${rem.daysUntil === 1 ? 'day' : 'days'})
          </div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- SPENDING REPORTS & ANALYTICS ---------- */
function renderReports() {
  const container = document.getElementById('reportsContent');
  if (!container) return;
  
  const data = getActiveData();
  const transactions = data.transactions || [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  // Current month stats
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const currentIncome = currentMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const currentExpenses = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // Last month stats
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonthStr));
  const lastIncome = lastMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const lastExpenses = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  // Category breakdown
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

/* ---------- SPENDING INSIGHTS ---------- */
function renderInsights() {
  const container = document.getElementById('insightsContent');
  if (!container) return;
  
  const data = getActiveData();
  const transactions = data.transactions || [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonthStr));
  
  // Category comparison
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
  
  // Compare categories
  Object.keys(currentCategoryTotals).forEach(catId => {
    const current = currentCategoryTotals[catId];
    const last = lastCategoryTotals[catId] || 0;
    if (last > 0) {
      const change = ((current - last) / last) * 100;
      if (Math.abs(change) >= 20) {
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
  
  // Total spending comparison
  const currentTotal = currentMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const lastTotal = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  if (lastTotal > 0) {
    const change = ((currentTotal - lastTotal) / lastTotal) * 100;
    if (Math.abs(change) >= 10) {
      insights.push({
        type: change > 0 ? 'danger' : 'positive',
        message: `Your total spending is ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'higher' : 'lower'} than last month.`
      });
    }
  }
  
  // Budget warnings
  data.categories.forEach(cat => {
    if (cat.monthlyBudget > 0) {
      const spent = currentCategoryTotals[cat.id] || 0;
      const percentage = (spent / cat.monthlyBudget) * 100;
      if (percentage >= 90) {
        insights.push({
          type: percentage >= 100 ? 'danger' : 'warning',
          message: `${cat.name} budget: ${percentage.toFixed(0)}% used (${formatMoney(spent)} / ${formatMoney(cat.monthlyBudget)})`
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

/* ---------- CENTRAL RENDER ---------- */

function renderAll() {
  renderProfileSelector();
  updateMonthLabel();
  renderCategoryFilters();
  renderKpis();
  renderTransactionsTable();
  renderGoals();
  renderCategoryChart();
  renderMonthlyChart();
  renderSankeyChart();
  renderRecurringTransactions();
  renderDebts();
  renderFinancialGoals();
  renderBillReminders();
  renderReports();
  renderInsights();
}

/* ---------- SETTINGS PANEL ---------- */

let editingCategoryId = null;
let settings = {
  budgetAlertsEnabled: true,
  budgetAlertThreshold: 80,
  currencySymbol: '$',
  dateFormat: 'YYYY-MM-DD'
};

function loadSettings() {
  const saved = localStorage.getItem('budgetDashboardSettings');
  if (saved) {
    settings = { ...settings, ...JSON.parse(saved) };
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem('budgetDashboardSettings', JSON.stringify(settings));
  applySettings();
}

function applySettings() {
  // Update UI elements
  if (document.getElementById('budgetAlertsEnabled')) {
    document.getElementById('budgetAlertsEnabled').checked = settings.budgetAlertsEnabled;
  }
  if (document.getElementById('budgetAlertThreshold')) {
    document.getElementById('budgetAlertThreshold').value = settings.budgetAlertThreshold;
  }
  if (document.getElementById('currencySymbol')) {
    document.getElementById('currencySymbol').value = settings.currencySymbol;
  }
  if (document.getElementById('dateFormat')) {
    document.getElementById('dateFormat').value = settings.dateFormat;
  }
}

function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  modal.classList.add('show');
  renderCategoriesList();
  applySettings();
  
  // Set current theme in dropdown
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = currentTheme;
  }
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function renderCategoriesList() {
  const container = document.getElementById('categoriesList');
  const categories = getActiveData().categories;
  
  container.innerHTML = categories.map(cat => {
    const budget = cat.monthlyBudget || 0;
    return `
      <div class="category-item">
        <div class="category-color" style="background: ${cat.color}"></div>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-budget">Budget: ${formatMoney(budget)}</div>
        </div>
        <button onclick="editCategory('${cat.id}')" class="btn-primary" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Edit</button>
      </div>
    `;
  }).join('');
}

function editCategory(categoryId) {
  const categories = getActiveData().categories;
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;
  
  editingCategoryId = categoryId;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('categoryNameInput').value = cat.name;
  document.getElementById('categoryColorInput').value = cat.color;
  document.getElementById('categoryBudgetInput').value = cat.monthlyBudget || 0;
  document.getElementById('deleteCategoryBtn').style.display = 'block';
  document.getElementById('categoryModal').classList.add('show');
}

function openAddCategory() {
  editingCategoryId = null;
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('categoryNameInput').value = '';
  document.getElementById('categoryColorInput').value = '#60a5fa';
  document.getElementById('categoryBudgetInput').value = '';
  document.getElementById('deleteCategoryBtn').style.display = 'none';
  document.getElementById('categoryModal').classList.add('show');
}

function saveCategory() {
  const name = document.getElementById('categoryNameInput').value.trim();
  const color = document.getElementById('categoryColorInput').value;
  const budget = parseFloat(document.getElementById('categoryBudgetInput').value) || 0;
  
  if (!name) {
    showToast('Category name is required', 'Error');
    return;
  }
  
  const categories = getActiveData().categories;
  
  if (editingCategoryId) {
    // Edit existing
    const cat = categories.find(c => c.id === editingCategoryId);
    if (cat) {
      cat.name = name;
      cat.color = color;
      cat.monthlyBudget = budget;
    }
  } else {
    // Add new
    const newId = name.toLowerCase().replace(/\s+/g, '_');
    if (categories.find(c => c.id === newId)) {
      showToast('Category with this name already exists', 'Error');
      return;
    }
    categories.push({
      id: newId,
      name: name,
      color: color,
      monthlyBudget: budget
    });
  }
  
  saveState();
  renderAll();
  renderCategoriesList();
  closeCategoryModal();
  showToast(editingCategoryId ? 'Category updated' : 'Category added');
}

function deleteCategory() {
  if (!editingCategoryId) return;
  
  const categories = getActiveData().categories;
  if (categories.length <= 1) {
    showToast('Cannot delete the last category', 'Error');
    return;
  }
  
  if (!confirm(`Delete category "${categories.find(c => c.id === editingCategoryId)?.name}"? This will move all transactions to "Other".`)) {
    return;
  }
  
  const otherCat = categories.find(c => c.id === 'other') || categories[0];
  const transactions = getActiveData().transactions;
  
  // Move transactions to "other"
  transactions.forEach(t => {
    if (t.categoryId === editingCategoryId) {
      t.categoryId = otherCat.id;
    }
  });
  
  // Remove category
  const index = categories.findIndex(c => c.id === editingCategoryId);
  if (index > -1) {
    categories.splice(index, 1);
  }
  
  saveState();
  renderAll();
  renderCategoriesList();
  closeCategoryModal();
  showToast('Category deleted');
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('show');
  editingCategoryId = null;
}

// Budget tracking with warnings
function checkBudgetWarnings() {
  if (!settings.budgetAlertsEnabled) return;
  
  const data = getActiveData();
  const tx = getFilteredTransactions();
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  data.categories.forEach(cat => {
    if (!cat.monthlyBudget || cat.monthlyBudget === 0) return;
    
    const monthExpenses = tx
      .filter(t => t.type === 'expense' && 
                   t.categoryId === cat.id && 
                   t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const percentage = (monthExpenses / cat.monthlyBudget) * 100;
    
    if (percentage >= settings.budgetAlertThreshold) {
      const message = percentage >= 100 
        ? `⚠️ Over budget: ${cat.name} (${formatMoney(monthExpenses)} / ${formatMoney(cat.monthlyBudget)})`
        : `⚠️ Approaching budget: ${cat.name} (${percentage.toFixed(0)}%)`;
      showToast(message, percentage >= 100 ? 'Warning' : 'Info');
    }
  });
}

// Export functions (basic implementations)
function exportToPdf() {
  showToast('PDF export coming soon! For now, use Export JSON and convert it.', 'Info');
}

function exportToExcel() {
  const data = getActiveData();
  const tx = getFilteredTransactions();
  
  // Create CSV content
  let csv = 'Date,Description,Type,Category,Amount\n';
  tx.forEach(t => {
    const cat = data.categories.find(c => c.id === t.categoryId);
    csv += `${t.date},"${t.description}",${t.type},${cat?.name || 'Other'},${t.amount}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Exported to CSV (Excel-compatible)');
}

function backupAllData() {
  const backup = {
    state: state,
    settings: settings,
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Backup created');
}

// Make functions global for onclick handlers
window.editCategory = editCategory;

/* ---------- Event Listeners ---------- */

document.getElementById("prevMonthBtn").addEventListener("click", prevMonth);
document.getElementById("nextMonthBtn").addEventListener("click", nextMonth);
document.getElementById("toggleAllMonthsBtn").addEventListener("click", toggleAllMonths);

document.getElementById("addTransactionBtn").addEventListener("click", openDrawerForAdd);
document.getElementById("drawerCancelBtn").addEventListener("click", closeDrawer);
document.getElementById("drawerSaveBtn").addEventListener("click", saveTransactionFromDrawer);

document.getElementById("importJsonBtn").addEventListener("click", importJson);
document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
document.getElementById("importCsvBtn").addEventListener("click", importCsv);
document.getElementById("undoImportBtn").addEventListener("click", undoImport);

document.getElementById("clearDataBtn").addEventListener("click", clearData);

document.getElementById("connectBankBtn").addEventListener("click", connectBank);

document.getElementById("addGoalBtn").addEventListener("click", addGoal);

document.getElementById("profileSelect").addEventListener("change", e => {
  switchProfile(e.target.value);
});

document.getElementById("createProfileBtn").addEventListener("click", () => {
  const name = prompt("Profile name:");
  if (name) createNewProfile(name);
});

document.getElementById("searchBox").addEventListener("input", renderAll);
document.getElementById("filterType").addEventListener("change", renderAll);
document.getElementById("filterCategory").addEventListener("change", renderAll);

// Table sorting - wait for DOM to be ready
setTimeout(() => {
  document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      sortTable(column);
    });
  });
  // Initialize sort indicators
  updateSortIndicators();
}, 100);

// More Menu
const moreMenuBtn = document.getElementById("moreMenuBtn");
const moreMenu = document.querySelector(".more-menu");
const moreMenuDropdown = document.getElementById("moreMenuDropdown");

moreMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  moreMenu.classList.toggle("active");
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (!moreMenu.contains(e.target)) {
    moreMenu.classList.remove("active");
  }
});

// Close menu when clicking a menu item
document.querySelectorAll(".more-menu-dropdown .menu-item").forEach(item => {
  item.addEventListener("click", () => {
    moreMenu.classList.remove("active");
  });
});

// Settings panel
document.getElementById("settingsBtn").addEventListener("click", openSettings);
document.getElementById("closeSettingsBtn").addEventListener("click", closeSettings);
document.getElementById("addCategoryBtn").addEventListener("click", openAddCategory);
document.getElementById("saveCategoryBtn").addEventListener("click", saveCategory);
document.getElementById("cancelCategoryBtn").addEventListener("click", closeCategoryModal);
document.getElementById("deleteCategoryBtn").addEventListener("click", deleteCategory);

// Settings controls
document.getElementById("budgetAlertsEnabled").addEventListener("change", e => {
  settings.budgetAlertsEnabled = e.target.checked;
  saveSettings();
});
document.getElementById("budgetAlertThreshold").addEventListener("change", e => {
  settings.budgetAlertThreshold = parseInt(e.target.value) || 80;
  saveSettings();
});
document.getElementById("currencySymbol").addEventListener("change", e => {
  settings.currencySymbol = e.target.value || '$';
  saveSettings();
  renderAll();
});
document.getElementById("dateFormat").addEventListener("change", e => {
  settings.dateFormat = e.target.value;
  saveSettings();
  renderAll(); // Re-render to apply new date format
});

// Export buttons
document.getElementById("exportPdfBtn").addEventListener("click", exportToPdf);
document.getElementById("exportExcelBtn").addEventListener("click", exportToExcel);
document.getElementById("backupDataBtn").addEventListener("click", backupAllData);

// Theme toggle in settings (handled by themeSelect change event above)

// Recurring transactions
document.getElementById("addRecurringBtn").addEventListener("click", addRecurring);
document.getElementById("saveRecurringBtn").addEventListener("click", saveRecurring);
document.getElementById("cancelRecurringBtn").addEventListener("click", closeRecurringModal);
document.getElementById("deleteRecurringBtn").addEventListener("click", () => {
  if (editingRecurringId) deleteRecurring(editingRecurringId);
});

// Debt tracking
document.getElementById("addDebtBtn").addEventListener("click", addDebt);
document.getElementById("saveDebtBtn").addEventListener("click", saveDebt);
document.getElementById("cancelDebtBtn").addEventListener("click", closeDebtModal);
document.getElementById("deleteDebtBtn").addEventListener("click", () => {
  if (editingDebtId) deleteDebt(editingDebtId);
});

// Financial goals
document.getElementById("addFinancialGoalBtn").addEventListener("click", addFinancialGoal);
document.getElementById("saveFinancialGoalBtn").addEventListener("click", saveFinancialGoal);
document.getElementById("cancelFinancialGoalBtn").addEventListener("click", closeFinancialGoalModal);
document.getElementById("deleteFinancialGoalBtn").addEventListener("click", () => {
  if (editingFinancialGoalId) deleteFinancialGoal(editingFinancialGoalId);
});

// Close modals when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
});

/* ---------- TAB NAVIGATION ---------- */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Remove active class from all buttons and panes
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked button and corresponding pane
      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      
      // Save to localStorage
      localStorage.setItem('budgetDashboardActiveTab', targetTab);
      
      // Scroll tabs nav if needed (for mobile)
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
  
  // Set initial active tab from localStorage or default to overview
  const savedTab = localStorage.getItem('budgetDashboardActiveTab') || 'overview';
  const savedBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
  if (savedBtn) {
    // Manually trigger the tab switch without clicking
    const targetTab = savedBtn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    savedBtn.classList.add('active');
    const targetPane = document.getElementById(`tab-${targetTab}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }
}

// Save active tab to localStorage when switching (integrated into initTabs)

/* ---------- Initial Render ---------- */
loadSettings();
initTheme();
initTabs();
// Initialize toggle button text
document.getElementById("toggleAllMonthsBtn").textContent = showAllMonths ? "All ✓" : "All";
renderAll();
// Check budget warnings after a short delay
setTimeout(checkBudgetWarnings, 1000);
