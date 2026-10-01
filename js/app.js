/* =============================================================================
   js/app.js — Expense & Budget Visualizer
   Single JavaScript file for all application logic.
   Module sections:
     1. StorageService  — localStorage read/write/availability
     2. Validation      — pure input validation functions
     3. Formatters      — pure currency and percent formatting
     4. CategoryManager — custom category add/delete/persist
     5. ChartManager    — Chart.js pie chart create/update
     6. Renderer        — DOM rendering (list, balance, errors, banner)
     7. SortManager     — sort state and sorted-list helper
     8. ThemeManager    — dark/light mode toggle + persistence
     9. EventHandlers   — form submit and delete click handlers
    10. App             — bootstrap / init
   ============================================================================= */

'use strict';

/* =============================================================================
   In-memory application state (never serialised directly to localStorage)
   ============================================================================= */

const appState = {
  transactions: [],       // Transaction[]  — source of truth
  storageAvailable: true, // boolean — set false if localStorage test fails
  bannerShown: false,     // prevents duplicate storage-unavailable banner
};

/* =============================================================================
   1. StorageService
   ============================================================================= */

const StorageService = {
  KEY:       'expense_visualizer_transactions',
  CAT_KEY:   'expense_visualizer_categories',
  THEME_KEY: 'expense_visualizer_theme',

  /**
   * isAvailable()
   * Perform a test write/read/delete to confirm localStorage is accessible.
   * Returns true if available, false on SecurityError / QuotaExceededError.
   */
  isAvailable() {
    const testKey = '__exp_vis_test__';
    try {
      localStorage.setItem(testKey, '1');
      const read = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return read === '1';
    } catch (_e) {
      return false;
    }
  },

  /**
   * load()
   * Read the transaction array from localStorage.
   * Returns { transactions: Transaction[], corrupt: boolean }
   */
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw === null) return { transactions: [], corrupt: false };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { transactions: [], corrupt: true };
      return { transactions: parsed, corrupt: false };
    } catch (_e) {
      return { transactions: [], corrupt: true };
    }
  },

  /**
   * save(transactions)
   * Serialise and write to localStorage.
   */
  save(transactions) {
    if (!appState.storageAvailable) return false;
    try {
      localStorage.setItem(this.KEY, JSON.stringify(transactions));
      return true;
    } catch (_e) {
      return false;
    }
  },

  /** loadCategories() — returns string[] of category names, or null on failure */
  loadCategories() {
    try {
      const raw = localStorage.getItem(this.CAT_KEY);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  },

  /** saveCategories(categories) */
  saveCategories(categories) {
    if (!appState.storageAvailable) return false;
    try {
      localStorage.setItem(this.CAT_KEY, JSON.stringify(categories));
      return true;
    } catch (_e) {
      return false;
    }
  },

  /** loadTheme() — returns 'dark' | 'light' | null */
  loadTheme() {
    try {
      return localStorage.getItem(this.THEME_KEY);
    } catch (_e) {
      return null;
    }
  },

  /** saveTheme(theme) */
  saveTheme(theme) {
    if (!appState.storageAvailable) return false;
    try {
      localStorage.setItem(this.THEME_KEY, theme);
      return true;
    } catch (_e) {
      return false;
    }
  },
};

/* =============================================================================
   2. Validation
   ============================================================================= */

const Validation = {
  /** Kept in sync with CategoryManager.getAll() at validation time */
  isValidAmount(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) && n >= 0.01 && n <= 999999.99;
  },

  validateTransaction({ name, amount, category }) {
    const errors = {};
    const trimmedName = (name || '').trim();

    if (!trimmedName) {
      errors.name = 'Item name is required.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Item name must be 100 characters or fewer.';
    }

    if (amount === '' || amount === null || amount === undefined) {
      errors.amount = 'Amount is required.';
    } else if (!this.isValidAmount(amount)) {
      errors.amount = 'Enter a valid amount between $0.01 and $999,999.99.';
    }

    const validCategories = CategoryManager.getAll();
    if (!category || !validCategories.includes(category)) {
      errors.category = 'Please select a category.';
    }

    if (Object.keys(errors).length > 0) return { valid: false, errors };
    return { valid: true };
  },
};

/* =============================================================================
   3. Formatters
   ============================================================================= */

const Formatters = {
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  formatPercent(value) {
    return `${Math.round(value * 10) / 10}%`;
  },
};

/* =============================================================================
   4. CategoryManager
   ============================================================================= */

const CategoryManager = {
  DEFAULT_CATEGORIES: ['Food', 'Transport', 'Fun'],

  // Palette of colours assigned in round-robin to categories
  COLOR_PALETTE: [
    '#f97316', '#3b82f6', '#a855f7',
    '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#84cc16',
  ],

  _categories: [], // string[]

  /** init() — loads from storage or falls back to defaults */
  init() {
    const stored = StorageService.loadCategories();
    this._categories = (stored && stored.length > 0)
      ? stored
      : [...this.DEFAULT_CATEGORIES];
  },

  /** getAll() — returns a shallow copy */
  getAll() {
    return [...this._categories];
  },

  /**
   * add(name)
   * Returns { success: boolean, error?: string }
   */
  add(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, error: 'Category name cannot be empty.' };
    if (trimmed.length > 40) return { success: false, error: 'Category name must be 40 characters or fewer.' };
    if (this._categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: `"${trimmed}" already exists.` };
    }
    this._categories.push(trimmed);
    StorageService.saveCategories(this._categories);
    return { success: true };
  },

  /**
   * remove(name)
   * Prevents deletion of categories that still have transactions.
   */
  remove(name, transactions) {
    const inUse = transactions.some(t => t.category === name);
    if (inUse) {
      return { success: false, error: `"${name}" is used by existing transactions.` };
    }
    const idx = this._categories.indexOf(name);
    if (idx === -1) return { success: false, error: 'Category not found.' };
    this._categories.splice(idx, 1);
    StorageService.saveCategories(this._categories);
    return { success: true };
  },

  /** colorFor(name) — deterministic colour from the palette */
  colorFor(name) {
    const idx = this._categories.indexOf(name);
    return this.COLOR_PALETTE[idx % this.COLOR_PALETTE.length] || '#9ca3af';
  },

  /**
   * badgeStyleFor(name)
   * Returns an inline-style string for dynamic categories.
   */
  badgeStyleFor(name) {
    const color = this.colorFor(name);
    // Convert hex to a light background tint
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `background-color:rgba(${r},${g},${b},0.18);color:${color};`;
  },
};

/* =============================================================================
   5. ChartManager
   ============================================================================= */

const ChartManager = {
  _instance: null,
  PLACEHOLDER_COLOR: '#d1d5db',

  init(canvas) {
    if (typeof Chart === 'undefined') {
      const section = document.getElementById('chart-section');
      if (section) {
        const msg = document.createElement('p');
        msg.className = 'chart-fallback';
        msg.textContent = 'Chart unavailable — please check your internet connection.';
        canvas.replaceWith(msg);
      }
      return;
    }

    const categories = CategoryManager.getAll();
    const colors = categories.map(c => CategoryManager.colorFor(c));

    this._instance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: [...categories],
        datasets: [{
          data: new Array(categories.length).fill(0),
          backgroundColor: colors,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                if (total === 0) return ctx.label;
                const pct = (ctx.parsed / total) * 100;
                return `${ctx.label}: ${Formatters.formatPercent(pct)}`;
              },
            },
          },
        },
      },
    });
  },

  update(transactions) {
    if (!this._instance) return;

    const categories = CategoryManager.getAll();
    const totals = computeCategoryTotals(transactions, categories);
    const allZero = categories.every(c => (totals[c] || 0) === 0);

    if (allZero) {
      this.showPlaceholder();
      return;
    }

    this._instance.data.labels = [...categories];
    this._instance.data.datasets[0].data = categories.map(c => totals[c] || 0);
    this._instance.data.datasets[0].backgroundColor = categories.map(c => CategoryManager.colorFor(c));
    this._instance.update();
  },

  showPlaceholder() {
    if (!this._instance) return;
    this._instance.data.labels = ['No data'];
    this._instance.data.datasets[0].data = [1];
    this._instance.data.datasets[0].backgroundColor = [this.PLACEHOLDER_COLOR];
    this._instance.update();
  },
};

/* =============================================================================
   Pure helper functions
   ============================================================================= */

function computeCategoryTotals(transactions, categories) {
  const totals = {};
  for (const c of (categories || CategoryManager.getAll())) totals[c] = 0;
  for (const t of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, t.category)) {
      totals[t.category] += t.amount;
    }
  }
  return totals;
}

function calculateBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/* =============================================================================
   6. Renderer
   ============================================================================= */

const Renderer = {
  renderList(transactions) {
    const ul = document.getElementById('transaction-list');
    if (!ul) return;

    ul.innerHTML = '';

    if (transactions.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'No transactions recorded yet.';
      ul.appendChild(li);
      return;
    }

    const sorted = SortManager.getSorted(transactions);

    for (const tx of sorted) {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = tx.id;

      // Support both built-in and custom categories
      const builtinBadgeClass =
        tx.category === 'Food'      ? 'category-badge--food'
        : tx.category === 'Transport' ? 'category-badge--transport'
        : tx.category === 'Fun'       ? 'category-badge--fun'
        : null;

      const badgeClass = builtinBadgeClass ? `category-badge ${builtinBadgeClass}` : 'category-badge';
      const badgeStyle = builtinBadgeClass ? '' : `style="${CategoryManager.badgeStyleFor(tx.category)}"`;

      li.innerHTML = `
        <div class="transaction-info">
          <span class="transaction-name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}</span>
          <span class="transaction-meta">
            <span class="${badgeClass}" ${badgeStyle}>${escapeHtml(tx.category)}</span>
          </span>
        </div>
        <span class="transaction-amount">${Formatters.formatCurrency(tx.amount)}</span>
        <button
          type="button"
          class="btn-delete"
          data-id="${escapeHtml(tx.id)}"
          aria-label="Delete transaction: ${escapeHtml(tx.name)}"
          title="Delete"
        >&#x2715;</button>
      `;

      ul.appendChild(li);
    }
  },

  renderBalance(transactions) {
    const el = document.getElementById('balance-display');
    if (!el) return;
    el.textContent = Formatters.formatCurrency(calculateBalance(transactions));
  },

  showFieldErrors(errors) {
    const nameEl     = document.getElementById('name-error');
    const amountEl   = document.getElementById('amount-error');
    const categoryEl = document.getElementById('category-error');
    if (nameEl)     nameEl.textContent     = errors.name     || '';
    if (amountEl)   amountEl.textContent   = errors.amount   || '';
    if (categoryEl) categoryEl.textContent = errors.category || '';
  },

  clearFieldErrors() { this.showFieldErrors({}); },

  showBanner(message, type) {
    const banner = document.getElementById('banner');
    if (!banner) return;
    banner.textContent = message;
    banner.className = type === 'error' ? 'banner--error' : 'banner--info';
    banner.removeAttribute('hidden');
  },

  clearBanner() {
    const banner = document.getElementById('banner');
    if (!banner) return;
    banner.textContent = '';
    banner.className = '';
    banner.setAttribute('hidden', '');
  },

  resetForm() {
    const form = document.getElementById('transaction-form');
    if (form) form.reset();
  },

  /** renderCategorySelect() — rebuilds the <select> options from CategoryManager */
  renderCategorySelect() {
    const select = document.getElementById('category');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Select&hellip;</option>';
    for (const cat of CategoryManager.getAll()) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === current) opt.selected = true;
      select.appendChild(opt);
    }
  },

  /** renderCategoryList() — renders the category manager chips */
  renderCategoryList() {
    const container = document.getElementById('category-chips');
    if (!container) return;
    container.innerHTML = '';

    for (const cat of CategoryManager.getAll()) {
      const chip = document.createElement('span');
      chip.className = 'cat-chip';

      // Built-in colours match existing badges
      const builtinClass =
        cat === 'Food'      ? 'cat-chip--food'
        : cat === 'Transport' ? 'cat-chip--transport'
        : cat === 'Fun'       ? 'cat-chip--fun'
        : null;

      if (builtinClass) {
        chip.classList.add(builtinClass);
      } else {
        chip.setAttribute('style', CategoryManager.badgeStyleFor(cat));
      }

      chip.innerHTML = `
        <span class="cat-chip__label">${escapeHtml(cat)}</span>
        <button
          type="button"
          class="cat-chip__delete"
          data-cat="${escapeHtml(cat)}"
          aria-label="Delete category ${escapeHtml(cat)}"
          title="Delete category"
        >&#x2715;</button>
      `;
      container.appendChild(chip);
    }
  },
};

/* =============================================================================
   7. SortManager
   ============================================================================= */

const SortManager = {
  // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category-asc'
  _current: 'date-desc',

  get() { return this._current; },

  set(value) {
    this._current = value;
    // Update the active button in the UI
    const btns = document.querySelectorAll('.sort-btn');
    btns.forEach(btn => {
      btn.classList.toggle('sort-btn--active', btn.dataset.sort === value);
      btn.setAttribute('aria-pressed', btn.dataset.sort === value ? 'true' : 'false');
    });
  },

  getSorted(transactions) {
    const arr = [...transactions];
    switch (this._current) {
      case 'date-desc':
        return arr.sort((a, b) => b.createdAt - a.createdAt);
      case 'date-asc':
        return arr.sort((a, b) => a.createdAt - b.createdAt);
      case 'amount-desc':
        return arr.sort((a, b) => b.amount - a.amount);
      case 'amount-asc':
        return arr.sort((a, b) => a.amount - b.amount);
      case 'category-asc':
        return arr.sort((a, b) => a.category.localeCompare(b.category));
      default:
        return arr;
    }
  },
};

/* =============================================================================
   8. ThemeManager
   ============================================================================= */

const ThemeManager = {
  _current: 'light', // 'light' | 'dark'

  init() {
    // Respect stored preference first, then OS preference
    const stored = StorageService.loadTheme();
    if (stored === 'dark' || stored === 'light') {
      this._current = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this._current = 'dark';
    }
    this._apply();
  },

  toggle() {
    this._current = this._current === 'light' ? 'dark' : 'light';
    this._apply();
    StorageService.saveTheme(this._current);
  },

  _apply() {
    document.documentElement.setAttribute('data-theme', this._current);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', this._current === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', this._current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.querySelector('.theme-icon').textContent = this._current === 'dark' ? '☀️' : '🌙';
      btn.querySelector('.theme-label').textContent = this._current === 'dark' ? 'Light mode' : 'Dark mode';
    }
  },
};

/* =============================================================================
   Utility: HTML escaping
   ============================================================================= */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =============================================================================
   9. EventHandlers
   ============================================================================= */

const EventHandlers = {
  onFormSubmit(event) {
    event.preventDefault();
    Renderer.clearFieldErrors();
    Renderer.clearBanner();

    const nameInput     = document.getElementById('item-name');
    const amountInput   = document.getElementById('amount');
    const categoryInput = document.getElementById('category');

    const formData = {
      name:     nameInput     ? nameInput.value     : '',
      amount:   amountInput   ? amountInput.value   : '',
      category: categoryInput ? categoryInput.value : '',
    };

    const result = Validation.validateTransaction(formData);
    if (!result.valid) {
      Renderer.showFieldErrors(result.errors);
      return;
    }

    const transaction = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(),
      name:      formData.name.trim(),
      amount:    parseFloat(formData.amount),
      category:  formData.category,
      createdAt: Date.now(),
    };

    appState.transactions.push(transaction);
    const saved = StorageService.save(appState.transactions);

    if (!saved) {
      appState.transactions.pop();
      Renderer.showBanner('Transaction could not be saved — storage is unavailable.', 'error');
      return;
    }

    Renderer.renderList(appState.transactions);
    Renderer.renderBalance(appState.transactions);
    ChartManager.update(appState.transactions);
    Renderer.resetForm();
  },

  onDeleteClick(event, id) {
    const idx = appState.transactions.findIndex(t => t.id === id);
    if (idx === -1) return;

    const removed = appState.transactions.splice(idx, 1)[0];
    const saved = StorageService.save(appState.transactions);

    if (!saved) {
      appState.transactions.splice(idx, 0, removed);
      Renderer.showBanner('Deletion could not be persisted — storage is unavailable.', 'error');
      return;
    }

    Renderer.renderList(appState.transactions);
    Renderer.renderBalance(appState.transactions);
    ChartManager.update(appState.transactions);
  },

  /** onAddCategory — handles the custom category form */
  onAddCategory(event) {
    event.preventDefault();
    const input = document.getElementById('new-category-input');
    const errorEl = document.getElementById('new-category-error');
    if (!input) return;

    const result = CategoryManager.add(input.value);

    if (!result.success) {
      if (errorEl) errorEl.textContent = result.error;
      return;
    }

    if (errorEl) errorEl.textContent = '';
    input.value = '';

    // Rebuild UI that depends on categories
    Renderer.renderCategorySelect();
    Renderer.renderCategoryList();
    ChartManager.update(appState.transactions);
  },

  /** onDeleteCategory — delegated click on the chip delete buttons */
  onDeleteCategory(event) {
    const btn = event.target.closest('.cat-chip__delete');
    if (!btn) return;

    const cat = btn.dataset.cat;
    const errorEl = document.getElementById('new-category-error');
    const result = CategoryManager.remove(cat, appState.transactions);

    if (!result.success) {
      if (errorEl) errorEl.textContent = result.error;
      return;
    }

    if (errorEl) errorEl.textContent = '';
    Renderer.renderCategorySelect();
    Renderer.renderCategoryList();
    ChartManager.update(appState.transactions);
  },

  /** onSortChange — handles sort button clicks */
  onSortChange(event) {
    const btn = event.target.closest('.sort-btn');
    if (!btn) return;
    SortManager.set(btn.dataset.sort);
    Renderer.renderList(appState.transactions);
  },
};

/* =============================================================================
   10. App — Bootstrap
   ============================================================================= */

const App = {
  init() {
    // --- Theme (apply before paint to avoid flash) ---
    ThemeManager.init();

    // --- 1. Storage availability ---
    appState.storageAvailable = StorageService.isAvailable();
    if (!appState.storageAvailable && !appState.bannerShown) {
      appState.bannerShown = true;
      Renderer.showBanner(
        'Storage is unavailable in this browser. Data will not be saved between sessions.',
        'error'
      );
    }

    // --- 2. Categories ---
    CategoryManager.init();
    Renderer.renderCategorySelect();
    Renderer.renderCategoryList();

    // --- 3. Load persisted transactions ---
    const { transactions, corrupt } = StorageService.load();
    if (corrupt) {
      appState.transactions = [];
      Renderer.showBanner('Previously saved data could not be loaded. Starting fresh.', 'info');
    } else {
      appState.transactions = transactions;
    }

    // --- 4. Initial render ---
    Renderer.renderList(appState.transactions);
    Renderer.renderBalance(appState.transactions);

    const canvas = document.getElementById('spending-chart');
    if (canvas) {
      ChartManager.init(canvas);
      ChartManager.update(appState.transactions);
    }

    // --- 5. Attach event listeners ---

    // Form submit
    const form = document.getElementById('transaction-form');
    if (form) form.addEventListener('submit', e => EventHandlers.onFormSubmit(e));

    // Delegated delete on transaction list
    const list = document.getElementById('transaction-list');
    if (list) {
      list.addEventListener('click', e => {
        const btn = e.target.closest('[data-id]');
        if (btn && btn.classList.contains('btn-delete')) {
          EventHandlers.onDeleteClick(e, btn.dataset.id);
        }
      });
    }

    // Add-category form
    const catForm = document.getElementById('add-category-form');
    if (catForm) catForm.addEventListener('submit', e => EventHandlers.onAddCategory(e));

    // Delegated delete on category chips
    const chips = document.getElementById('category-chips');
    if (chips) chips.addEventListener('click', e => EventHandlers.onDeleteCategory(e));

    // Sort buttons (delegated)
    const sortBar = document.getElementById('sort-bar');
    if (sortBar) sortBar.addEventListener('click', e => EventHandlers.onSortChange(e));

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => ThemeManager.toggle());

    // Initialise sort button active state
    SortManager.set('date-desc');
  },
};

/* =============================================================================
   Expose pure helpers on window for DevTools console verification
   ============================================================================= */
window.Validation          = Validation;
window.Formatters          = Formatters;
window.calculateBalance    = calculateBalance;
window.computeCategoryTotals = computeCategoryTotals;
window.StorageService      = StorageService;
window.CategoryManager     = CategoryManager;
window.SortManager         = SortManager;
window.ThemeManager        = ThemeManager;

/* =============================================================================
   Bootstrap
   ============================================================================= */
App.init();
