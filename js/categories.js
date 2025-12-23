/**
 * Categories Module
 * Handles category CRUD operations, default categories, and rendering
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, showToast, deepClone } from './utils.js';
import { DEFAULT_CATEGORIES } from './constants.js';

// Module-level state
let editingCategoryId = null;

// External dependencies (will be injected)
let categoryService = null;
let transactionService = null;
let currentBudget = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Initialize categories module with dependencies
 * @param {Object} deps - Dependencies object
 */
export function initCategories(deps) {
  categoryService = deps.categoryService;
  transactionService = deps.transactionService;
  currentBudget = deps.currentBudget;
  useSupabase = deps.useSupabase;
  loadDataFromSupabase = deps.loadDataFromSupabase;
  renderAll = deps.renderAll;
  
  // Update when dependencies change
  if (deps.onUpdate) {
    deps.onUpdate(() => {
      currentBudget = deps.currentBudget;
      useSupabase = deps.useSupabase;
    });
  }
}

/**
 * Get default categories
 * @returns {Array} Default categories array
 */
export function getDefaultCategories() {
  return deepClone(DEFAULT_CATEGORIES);
}

/**
 * Ensure default categories exist (for localStorage mode)
 * @param {Object} data - Profile data
 */
export function ensureDefaultCategories(data) {
  if (!data.categories || data.categories.length === 0) {
    data.categories = deepClone(DEFAULT_CATEGORIES);
  }
}

/**
 * Render category filters in dropdowns
 */
export function renderCategoryFilters() {
  const data = stateManager.getActiveData();
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const catSel = document.getElementById("filterCategory");
  const drawerCat = document.getElementById("drawerCategory");

  if (!catSel || !drawerCat) return;

  catSel.innerHTML = `<option value="">Category: All</option>`;
  drawerCat.innerHTML = "";

  categories.forEach(c => {
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

/**
 * Render categories list in settings
 */
export function renderCategoriesList() {
  const container = document.getElementById('categoriesList');
  if (!container) return;
  
  const categories = stateManager.getActiveData().categories;
  
  container.innerHTML = categories.map(cat => {
    const budget = cat.monthlyBudget || cat.monthly_budget || 0;
    return `
      <div class="category-item">
        <div class="category-color" style="background: ${cat.color}"></div>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-budget">Budget: ${formatMoney(budget)}</div>
        </div>
        <button onclick="window.categoryModule.editCategory('${cat.id}')" class="btn-primary" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Edit</button>
      </div>
    `;
  }).join('');
}

/**
 * Open add category modal
 */
export function openAddCategory() {
  editingCategoryId = null;
  const modalTitle = document.getElementById('categoryModalTitle');
  const nameInput = document.getElementById('categoryNameInput');
  const colorInput = document.getElementById('categoryColorInput');
  const budgetInput = document.getElementById('categoryBudgetInput');
  const deleteBtn = document.getElementById('deleteCategoryBtn');
  const modal = document.getElementById('categoryModal');
  
  if (modalTitle) modalTitle.textContent = 'Add Category';
  if (nameInput) nameInput.value = '';
  if (colorInput) colorInput.value = '#60a5fa';
  if (budgetInput) budgetInput.value = '';
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (modal) modal.classList.add('show');
}

/**
 * Edit category
 * @param {string} categoryId - Category ID
 */
export function editCategory(categoryId) {
  const categories = stateManager.getActiveData().categories;
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;
  
  editingCategoryId = categoryId;
  const modalTitle = document.getElementById('categoryModalTitle');
  const nameInput = document.getElementById('categoryNameInput');
  const colorInput = document.getElementById('categoryColorInput');
  const budgetInput = document.getElementById('categoryBudgetInput');
  const deleteBtn = document.getElementById('deleteCategoryBtn');
  const modal = document.getElementById('categoryModal');
  
  if (modalTitle) modalTitle.textContent = 'Edit Category';
  if (nameInput) nameInput.value = cat.name;
  if (colorInput) colorInput.value = cat.color;
  if (budgetInput) budgetInput.value = cat.monthlyBudget || cat.monthly_budget || 0;
  if (deleteBtn) deleteBtn.style.display = 'block';
  if (modal) modal.classList.add('show');
}

/**
 * Save category (create or update)
 */
export async function saveCategory() {
  const nameInput = document.getElementById('categoryNameInput');
  const colorInput = document.getElementById('categoryColorInput');
  const budgetInput = document.getElementById('categoryBudgetInput');
  
  if (!nameInput || !colorInput || !budgetInput) {
    showToast('Category form elements not found', 'Error');
    return;
  }
  
  const name = nameInput.value.trim();
  const color = colorInput.value;
  const budget = parseFloat(budgetInput.value) || 0;
  
  if (!name) {
    showToast('Category name is required', 'Error');
    return;
  }
  
  if (useSupabase && currentBudget && categoryService) {
    // Use Supabase
    try {
      const categoryData = {
        name,
        color,
        monthly_budget: budget
      };
      
      if (editingCategoryId) {
        // Check for duplicate name before updating (excluding current category)
        const { data: existingCategories } = await categoryService.getCategories(currentBudget.id);
        const duplicate = existingCategories?.find(
          c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategoryId
        );
        if (duplicate) {
          showToast('A category with this name already exists. Please choose a different name.', 'Error');
          return;
        }
        
        // Update existing
        const { error } = await categoryService.updateCategory(editingCategoryId, categoryData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Category updated');
      } else {
        // Check for duplicate name before creating
        const { data: existingCategories } = await categoryService.getCategories(currentBudget.id);
        const duplicate = existingCategories?.find(
          c => c.name.toLowerCase() === name.toLowerCase()
        );
        if (duplicate) {
          showToast('A category with this name already exists. Please choose a different name.', 'Error');
          return;
        }
        
        // Create new
        const { data: newCat, error } = await categoryService.createCategory(currentBudget.id, categoryData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Category added');
      }
      
      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving category:', error);
      showToast(`Error saving category: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    const categories = data.categories || [];
    
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
    
    stateManager.setActiveData(data);
  }
  
  if (renderAll) {
    renderAll();
  }
  renderCategoriesList();
  closeCategoryModal();
}

/**
 * Delete category
 */
export async function deleteCategory() {
  if (!editingCategoryId) return;
  
  const categories = stateManager.getActiveData().categories;
  if (categories.length <= 1) {
    showToast('Cannot delete the last category', 'Error');
    return;
  }
  
  const categoryName = categories.find(c => c.id === editingCategoryId)?.name;
  if (!confirm(`Delete category "${categoryName}"? This will move all transactions to "Other".`)) {
    return;
  }
  
  if (useSupabase && currentBudget && categoryService && transactionService) {
    // Use Supabase
    try {
      // Find "other" category or first category
      const { data: allCategories } = await categoryService.getCategories(currentBudget.id);
      const fallbackCategory = allCategories?.find(c => c.name.toLowerCase() === 'other') || allCategories?.[0];
      
      if (!fallbackCategory) {
        showToast('Cannot delete category: no fallback category found', 'Error');
        return;
      }
      
      // Update all transactions using this category to use fallback
      const { data: transactions } = await transactionService.getTransactions(currentBudget.id);
      if (transactions) {
        const transactionsToUpdate = transactions.filter(t => t.category_id === editingCategoryId);
        for (const tx of transactionsToUpdate) {
          await transactionService.updateTransaction(tx.id, {
            category_id: fallbackCategory.id
          });
        }
      }
      
      // Delete the category
      const { error } = await categoryService.deleteCategory(editingCategoryId);
      if (error) {
        showToast(`Error: ${error.message}`, 'Error');
        return;
      }
      
      showToast('Category deleted');
      
      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting category:', error);
      showToast(`Error deleting category: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    const categories = data.categories || [];
    
    // Find "other" category or first category
    const fallbackCategory = categories.find(c => c.name.toLowerCase() === 'other') || categories[0];
    
    if (!fallbackCategory) {
      showToast('Cannot delete category: no fallback category found', 'Error');
      return;
    }
    
    // Update all transactions using this category
    const transactions = data.transactions || [];
    transactions.forEach(t => {
      if (t.categoryId === editingCategoryId) {
        t.categoryId = fallbackCategory.id;
      }
    });
    
    // Remove the category
    data.categories = categories.filter(c => c.id !== editingCategoryId);
    
    stateManager.setActiveData(data);
    showToast('Category deleted');
  }
  
  if (renderAll) {
    renderAll();
  }
  renderCategoriesList();
  closeCategoryModal();
}

/**
 * Close category modal
 */
export function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingCategoryId = null;
}

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @returns {Object|null} Category object or null
 */
export function getCategoryById(categoryId) {
  const categories = stateManager.getActiveData().categories || [];
  return categories.find(c => c.id === categoryId) || null;
}

/**
 * Get all categories
 * @returns {Array} Categories array
 */
export function getCategories() {
  return stateManager.getActiveData().categories || [];
}

// Export module to window for onclick handlers
if (typeof window !== 'undefined') {
  window.categoryModule = {
    editCategory
  };
}

