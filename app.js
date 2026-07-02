/* ===================================================================
   CatatDuit — Expense Tracker & Split Bill
   Main Application Logic
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ===== CONSTANTS =====
  const DEFAULT_CATEGORIES = ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Pendidikan', 'Kesehatan', 'Lainnya'];
  const DEFAULT_SOURCES = ['Cash', 'E-wallet', 'Rekening'];
  const CATEGORY_COLORS = [
    '#f97316', '#3b82f6', '#8b5cf6', '#ec4899',
    '#eab308', '#14b8a6', '#ef4444', '#6b7280',
    '#06b6d4', '#84cc16', '#f43f5e', '#a855f7',
    '#0ea5e9', '#d946ef', '#22c55e', '#f59e0b'
  ];
  const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // ===== STATE =====
  let editingId = null;
  let selectedDate = new Date(); // Daily picker state
  let lineChart = null;
  let donutChart = null;
  let confirmCallback = null;

  // Calculator state
  let calcTokens = [];
  let calcCurrent = '0';
  let calcJustEval = false;

  // ===== DOM REFERENCES =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Views
  const viewTransaksi = $('#view-transaksi');
  const viewRecap = $('#view-recap');
  const formOverlay = $('#formOverlay');
  const fab = $('#fab');
  const closeFormBtn = $('#closeFormBtn');

  // Form
  const expenseForm = $('#expenseForm');
  const formTitle = $('#formTitle');
  const expenseDate = $('#expenseDate');
  const expenseTime = $('#expenseTime');
  const expenseSource = $('#expenseSource');
  const expenseTitle = $('#expenseTitle');
  const expenseCategory = $('#expenseCategory');
  const expenseAmount = $('#expenseAmount');
  const expenseNotes = $('#expenseNotes');
  const splitBillToggle = $('#splitBillToggle');
  const splitBillSection = $('#splitBillSection');
  const splitDiscount = $('#splitDiscount');
  const splitExtraFees = $('#splitExtraFees');
  const splitPeople = $('#splitPeople');
  const addExtraFeeBtn = $('#addExtraFeeBtn');
  const addPersonBtn = $('#addPersonBtn');
  const saveBtn = $('#saveBtn');
  const saveBtnText = $('#saveBtnText');
  const cancelEditBtn = $('#cancelEditBtn');

  // Labels & Dynamic Content
  const transaksiDateLabel = $('#transaksiDateLabel');
  const prevDayBtn = $('#prevDayBtn');
  const nextDayBtn = $('#nextDayBtn');
  const rekapMonthLabel = $('#rekapMonthLabel');
  const transaksiTotal = $('#transaksiTotal');
  const rekapTotal = $('#rekapTotal');
  const transaksiCount = $('#transaksiCount');
  const rekapCount = $('#rekapCount');
  const categoryBreakdown = $('#categoryBreakdown');
  const categoryEmpty = $('#categoryEmpty');
  const transaksiList = $('#transaksiList');
  const transaksiEmpty = $('#transaksiEmpty');
  const transactionList = $('#transactionList');
  const transactionEmpty = $('#transactionEmpty');

  // Search & Filter controls (Global Search View)
  const searchGlobalTitle = $('#searchGlobalTitle');
  const filterGlobalCategory = $('#filterGlobalCategory');
  const filterGlobalSource = $('#filterGlobalSource');
  const searchResultsList = $('#searchResultsList');
  const searchEmpty = $('#searchEmpty');
  const searchBackBtn = $('#searchBackBtn');
  const toggleSearchBtn = $('#toggleSearchBtn');

  // Backup selectors
  const backupBtn = $('#backupBtn');
  const exportDataBtn = $('#exportDataBtn');
  const importFileInput = $('#importFileInput');
  const importDataBtn = $('#importDataBtn');

  // Budget elements
  const transaksiBudgetContainer = $('#transaksiBudgetContainer');
  const rekapBudgetContainer = $('#rekapBudgetContainer');
  const transaksiBudgetRemainingText = $('#transaksiBudgetRemainingText');
  const rekapBudgetRemainingText = $('#rekapBudgetRemainingText');
  const transaksiBudgetPercentText = $('#transaksiBudgetPercentText');
  const rekapBudgetPercentText = $('#rekapBudgetPercentText');
  const transaksiBudgetProgressBarFill = $('#transaksiBudgetProgressBarFill');
  const rekapBudgetProgressBarFill = $('#rekapBudgetProgressBarFill');
  const monthlyLimitInput = $('#monthlyLimitInput');
  const budgetForm = $('#budgetForm');

  // Calculator
  const calcExpressionEl = $('#calcExpression');
  const calcResultEl = $('#calcResult');

  // Manage modals
  const sourcesList = $('#sourcesList');
  const categoriesList = $('#categoriesList');
  const newSourceInput = $('#newSourceInput');
  const newCategoryInput = $('#newCategoryInput');

  // Confirm modal
  const confirmTitleEl = $('#confirmTitle');
  const confirmMessageEl = $('#confirmMessage');

  // Toast
  const toastEl = $('#toast');
  const toastMessage = $('#toastMessage');

  // ===== DATA LAYER =====
  function getExpenses() {
    try { return JSON.parse(localStorage.getItem('catatduit_expenses') || '[]'); }
    catch { return []; }
  }

  function setExpenses(list) {
    localStorage.setItem('catatduit_expenses', JSON.stringify(list));
  }

  function getBudget() {
    try {
      const stored = localStorage.getItem('catatduit_budget');
      return stored ? parseInt(stored) : 0;
    } catch { return 0; }
  }

  function setBudget(limit) {
    localStorage.setItem('catatduit_budget', String(limit || 0));
  }

  function getCategories() {
    try {
      const stored = localStorage.getItem('catatduit_categories');
      if (!stored) {
        setCategories(DEFAULT_CATEGORIES);
        return [...DEFAULT_CATEGORIES];
      }
      return JSON.parse(stored);
    } catch { return [...DEFAULT_CATEGORIES]; }
  }

  function setCategories(list) {
    localStorage.setItem('catatduit_categories', JSON.stringify(list));
  }

  function getSources() {
    try {
      const stored = localStorage.getItem('catatduit_sources');
      if (!stored) {
        setSources(DEFAULT_SOURCES);
        return [...DEFAULT_SOURCES];
      }
      return JSON.parse(stored);
    } catch { return [...DEFAULT_SOURCES]; }
  }

  function setSources(list) {
    localStorage.setItem('catatduit_sources', JSON.stringify(list));
  }

  // ===== UTILITIES =====
  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatFullDate(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[date.getDay()];
    const dayNum = String(date.getDate()).padStart(2, '0');
    const monthName = MONTH_NAMES[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  }

  function formatIDR(n) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(n);
  }

  function generateId() {
    return 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getCategoryColor(categoryName) {
    const categories = getCategories();
    const idx = categories.indexOf(categoryName);
    return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length];
  }

  // ===== TOAST =====
  let toastTimer = null;
  function showToast(message) {
    toastMessage.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  // ===== MODALS =====
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  // Close modals
  $$('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // ===== NAVIGATION =====
  function switchView(viewId) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    const tab = document.querySelector(`[data-view="${viewId}"]`);
    if (tab) tab.classList.add('active');

    const bNav = document.getElementById('bottomNav');

    if (viewId === 'view-transaksi') {
      renderTransaksi();
      if (bNav) bNav.classList.remove('hidden');
      fab.classList.remove('hidden');
    } else if (viewId === 'view-recap') {
      renderRecap();
      if (bNav) bNav.classList.remove('hidden');
      fab.classList.add('hidden');
    } else if (viewId === 'view-search') {
      if (bNav) bNav.classList.add('hidden');
      fab.classList.add('hidden');
      renderGlobalSearch();
    } else {
      if (bNav) bNav.classList.remove('hidden');
      fab.classList.add('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // FAB and Overlay Toggle
  fab.addEventListener('click', () => {
    resetForm();
    formOverlay.classList.add('show');
  });

  closeFormBtn.addEventListener('click', () => {
    resetForm();
  });

  // ===== FORM: INITIALIZATION =====
  function initForm() {
    const now = new Date();
    expenseDate.value = now.toISOString().split('T')[0];
    expenseTime.value = now.toTimeString().slice(0, 5);
    populateDropdowns();
  }

  function populateDropdowns() {
    const sources = getSources();
    expenseSource.innerHTML = sources.map(s =>
      `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
    ).join('');

    const categories = getCategories();
    expenseCategory.innerHTML = categories.map(c =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');

    populateFilters();
  }

  function populateFilters() {
    const currentCat = filterGlobalCategory.value;
    const currentSrc = filterGlobalSource.value;

    const categories = getCategories();
    filterGlobalCategory.innerHTML = '<option value="">Semua Kategori</option>' + categories.map(c =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ).join('');

    const sources = getSources();
    filterGlobalSource.innerHTML = '<option value="">Semua Sumber Dana</option>' + sources.map(s =>
      `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
    ).join('');

    if (categories.includes(currentCat)) filterGlobalCategory.value = currentCat;
    if (sources.includes(currentSrc)) filterGlobalSource.value = currentSrc;
  }

  function resetForm() {
    editingId = null;
    expenseForm.reset();
    formTitle.textContent = 'Tambah Pengeluaran';
    initForm();
    splitBillToggle.checked = false;
    toggleSplitBill(false);
    splitExtraFees.innerHTML = '';
    splitPeople.innerHTML = '';
    splitDiscount.value = '';
    saveBtnText.textContent = 'Simpan';
    cancelEditBtn.classList.add('hidden');
    formOverlay.classList.remove('show');
  }

  function populateForEdit(expense) {
    editingId = expense.id;
    formTitle.textContent = 'Edit Pengeluaran';
    expenseDate.value = expense.date;
    expenseTime.value = expense.time;

    // Ensure dropdown has the value
    populateDropdowns();
    expenseSource.value = expense.source;
    expenseCategory.value = expense.category;

    expenseTitle.value = expense.title;
    expenseAmount.value = expense.amount;
    expenseNotes.value = expense.notes || '';

    if (expense.hasSplitBill && expense.splitBill) {
      splitBillToggle.checked = true;
      toggleSplitBill(true);
      splitDiscount.value = expense.splitBill.discount || '';

      splitExtraFees.innerHTML = '';
      (expense.splitBill.extraFees || []).forEach(fee => {
        addExtraFeeRow(fee.name, fee.amount);
      });

      splitPeople.innerHTML = '';
      (expense.splitBill.people || []).forEach(person => {
        addPersonRow(person.name, person.subtotal);
      });
    } else {
      splitBillToggle.checked = false;
      toggleSplitBill(false);
    }

    saveBtnText.textContent = 'Perbarui';
    cancelEditBtn.classList.remove('hidden');
    formOverlay.classList.add('show');
  }

  // ===== FORM: SUBMIT =====
  expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = expenseDate.value;
    const time = expenseTime.value;
    const source = expenseSource.value;
    const title = expenseTitle.value.trim();
    const category = expenseCategory.value;
    const amount = parseFloat(expenseAmount.value);
    const notes = expenseNotes.value.trim();

    // Validation
    if (!date || !time || !source || !title || !category || isNaN(amount) || amount <= 0) {
      showToast('Mohon lengkapi semua field yang wajib');
      return;
    }

    // Split bill data
    let splitBillData = null;
    if (splitBillToggle.checked) {
      const discount = parseFloat(splitDiscount.value) || 0;

      // Collect extra fees
      const extraFees = [];
      let validFees = true;
      splitExtraFees.querySelectorAll('.dynamic-row').forEach(row => {
        const nameInput = row.querySelector('.fee-name');
        const amountInput = row.querySelector('.fee-amount');
        if (!nameInput || !amountInput) return;
        const fName = nameInput.value.trim();
        const fAmount = parseFloat(amountInput.value);
        if (!fName || isNaN(fAmount) || fAmount < 0) {
          validFees = false;
        } else {
          extraFees.push({ name: fName, amount: fAmount });
        }
      });

      if (!validFees) {
        showToast('Lengkapi semua biaya tambahan');
        return;
      }

      // Collect people
      const people = [];
      let validPeople = true;
      splitPeople.querySelectorAll('.dynamic-row').forEach(row => {
        const nameInput = row.querySelector('.person-name');
        const subInput = row.querySelector('.person-subtotal');
        if (!nameInput || !subInput) return;
        const pName = nameInput.value.trim();
        const pSub = parseFloat(subInput.value);
        if (!pName || isNaN(pSub) || pSub < 0) {
          validPeople = false;
        } else {
          people.push({ name: pName, subtotal: pSub });
        }
      });

      if (!validPeople || people.length === 0) {
        showToast('Tambahkan minimal 1 orang untuk split bill');
        return;
      }

      // Calculate proportional split
      const totalSubtotal = people.reduce((s, p) => s + p.subtotal, 0);
      const totalExtraFees = extraFees.reduce((s, f) => s + f.amount, 0);

      // Preserve isPaid if editing
      let existingPeople = [];
      if (editingId) {
        const existingExp = getExpenses().find(ex => ex.id === editingId);
        if (existingExp && existingExp.hasSplitBill && existingExp.splitBill) {
          existingPeople = existingExp.splitBill.people || [];
        }
      }

      const calculatedPeople = people.map(person => {
        const proportion = totalSubtotal > 0 ? person.subtotal / totalSubtotal : 0;
        const discountShare = discount * proportion;
        const feeShares = extraFees.map(fee => ({
          name: fee.name,
          share: fee.amount * proportion
        }));
        const totalFeeShare = feeShares.reduce((s, f) => s + f.share, 0);
        
        const match = existingPeople.find(p => p.name === person.name);
        const isPaid = match ? !!match.isPaid : false;

        return {
          name: person.name,
          subtotal: person.subtotal,
          proportion: (proportion * 100).toFixed(1),
          discountShare,
          feeShares,
          totalToPay: person.subtotal + totalFeeShare - discountShare,
          isPaid
        };
      });

      splitBillData = {
        discount,
        extraFees,
        people: calculatedPeople,
        totalSubtotal,
        totalExtraFees,
        grandTotal: totalSubtotal + totalExtraFees - discount
      };
    }

    // Build expense object
    const expense = {
      id: editingId || generateId(),
      date,
      time,
      source,
      title,
      category,
      amount,
      notes,
      hasSplitBill: splitBillToggle.checked,
      splitBill: splitBillData
    };

    // Save
    const expenses = getExpenses();
    if (editingId) {
      const idx = expenses.findIndex(e => e.id === editingId);
      if (idx >= 0) expenses[idx] = expense;
    } else {
      expenses.push(expense);
    }
    setExpenses(expenses);

    showToast(editingId ? 'Pengeluaran diperbarui!' : 'Pengeluaran tersimpan!');
    resetForm();
    renderTransaksi();
    renderRecap();
  });

  // Cancel edit
  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    showToast('Edit dibatalkan');
  });

  // ===== SPLIT BILL =====
  function toggleSplitBill(show) {
    splitBillSection.classList.toggle('hidden', !show);
    if (show && splitPeople.children.length === 0) {
      addPersonRow();
    }
  }

  splitBillToggle.addEventListener('change', () => {
    toggleSplitBill(splitBillToggle.checked);
  });

  function addExtraFeeRow(name, amount) {
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
      <input type="text" class="fee-name" placeholder="Nama biaya" value="${name != null ? escapeHtml(String(name)) : ''}">
      <input type="number" class="fee-amount" placeholder="Nominal" min="0" value="${amount != null ? amount : ''}">
      <button type="button" class="btn-remove-row" aria-label="Hapus">&times;</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
    splitExtraFees.appendChild(row);
  }

  function addPersonRow(name, subtotal) {
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
      <input type="text" class="person-name" placeholder="Nama" value="${name != null ? escapeHtml(String(name)) : ''}">
      <input type="number" class="person-subtotal" placeholder="Subtotal" min="0" value="${subtotal != null ? subtotal : ''}">
      <button type="button" class="btn-remove-row" aria-label="Hapus">&times;</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      if (splitPeople.children.length > 1) {
        row.remove();
      } else {
        showToast('Minimal 1 orang');
      }
    });
    splitPeople.appendChild(row);
  }

  addExtraFeeBtn.addEventListener('click', () => addExtraFeeRow());
  addPersonBtn.addEventListener('click', () => addPersonRow());

  // ===== CALCULATOR =====
  function calcUpdateDisplay() {
    let exprStr = calcTokens.join(' ');
    if (calcJustEval) {
      calcExpressionEl.textContent = exprStr + ' =';
    } else {
      calcExpressionEl.textContent = exprStr;
    }
    calcResultEl.textContent = calcCurrent || '0';
  }

  function calcReset() {
    calcTokens = [];
    calcCurrent = '0';
    calcJustEval = false;
    calcUpdateDisplay();
  }

  function calcHandleInput(action) {
    // Number keys
    if (/^[0-9]$/.test(action)) {
      if (calcJustEval) {
        calcTokens = [];
        calcCurrent = action;
        calcJustEval = false;
      } else if (calcCurrent === '0') {
        calcCurrent = action;
      } else {
        calcCurrent += action;
      }
      calcUpdateDisplay();
      return;
    }

    // 00
    if (action === '00') {
      if (calcJustEval) {
        calcTokens = [];
        calcCurrent = '0';
        calcJustEval = false;
      } else if (calcCurrent !== '0') {
        calcCurrent += '00';
      }
      calcUpdateDisplay();
      return;
    }

    // Operators
    if (['+', '-', '×', '÷'].includes(action)) {
      if (calcJustEval) {
        calcTokens = [calcCurrent, action];
        calcCurrent = '';
        calcJustEval = false;
      } else if (calcCurrent) {
        calcTokens.push(calcCurrent, action);
        calcCurrent = '';
      } else if (calcTokens.length > 0) {
        // Replace last operator
        calcTokens[calcTokens.length - 1] = action;
      }
      calcUpdateDisplay();
      return;
    }

    // Equals
    if (action === '=') {
      if (calcCurrent) {
        calcTokens.push(calcCurrent);
      }
      if (calcTokens.length === 0) return;

      const exprStr = calcTokens.join(' ')
        .replace(/×/g, '*')
        .replace(/÷/g, '/');

      try {
        const result = Function('"use strict"; return (' + exprStr + ')')();
        const rounded = Math.round(result);
        calcCurrent = String(isFinite(rounded) && !isNaN(rounded) ? rounded : 0);
      } catch {
        calcCurrent = 'Error';
      }
      calcJustEval = true;
      calcUpdateDisplay();
      return;
    }

    // Clear
    if (action === 'clear') {
      calcReset();
      return;
    }

    // Backspace
    if (action === 'backspace') {
      if (calcJustEval) return;
      if (calcCurrent.length > 1) {
        calcCurrent = calcCurrent.slice(0, -1);
      } else if (calcCurrent !== '0' && calcCurrent !== '') {
        calcCurrent = '0';
      } else if (calcTokens.length > 0) {
        const last = calcTokens.pop();
        if (['+', '-', '×', '÷'].includes(last) && calcTokens.length > 0) {
          calcCurrent = calcTokens.pop();
        } else {
          calcCurrent = last;
        }
      }
      calcUpdateDisplay();
      return;
    }
  }

  // Calculator events
  $('#openCalcBtn').addEventListener('click', () => {
    calcReset();
    // Pre-fill with current amount if present
    const currentVal = expenseAmount.value;
    if (currentVal && parseInt(currentVal) > 0) {
      calcCurrent = String(parseInt(currentVal));
      calcUpdateDisplay();
    }
    openModal('calcModal');
  });

  $$('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => calcHandleInput(btn.dataset.calc));
  });

  $('#useCalcResultBtn').addEventListener('click', () => {
    const val = parseInt(calcCurrent);
    if (!isNaN(val) && val > 0) {
      expenseAmount.value = val;
    }
    closeModal('calcModal');
  });

  // Keyboard support for calculator
  document.addEventListener('keydown', (e) => {
    if ($('#calcModal').classList.contains('hidden')) return;
    const keyMap = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '+': '+', '-': '-', '*': '×', '/': '÷',
      'Enter': '=', 'Backspace': 'backspace', 'Escape': 'clear', 'Delete': 'clear'
    };
    if (keyMap[e.key]) {
      e.preventDefault();
      calcHandleInput(keyMap[e.key]);
    }
  });

  // ===== TRANSAKSI PAGE =====
  function renderTransaksi() {
    const expenses = getExpenses();
    const dateStr = toISODate(selectedDate);
    
    // Filter daily expenses
    const dayExpenses = expenses.filter(e => e.date === dateStr);

    // Date label
    transaksiDateLabel.textContent = formatFullDate(selectedDate);

    // Summary (based on daily expenses)
    const dailyTotal = dayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    transaksiTotal.textContent = formatIDR(dailyTotal);
    transaksiCount.textContent = `${dayExpenses.length} transaksi`;

    // Update Budget progress (based on monthly total)
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
    });
    const monthTotal = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    updateBudgetProgress(monthTotal, 'transaksi');

    // Render list (daily)
    renderTransactionList(dayExpenses, transaksiList, transaksiEmpty);
  }

  // ===== RECAP PAGE =====
  function renderRecap() {
    const expenses = getExpenses();
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
    });

    // Month label
    rekapMonthLabel.textContent = `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

    // Summary
    const total = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    rekapTotal.textContent = formatIDR(total);
    rekapCount.textContent = `${monthExpenses.length} transaksi`;

    // Update Budget progress
    updateBudgetProgress(total, 'rekap');

    // Charts
    renderLineChart(monthExpenses);
    renderDonutChart(monthExpenses);

    // Category breakdown
    renderCategoryBreakdown(monthExpenses, total);

    // Render list (monthly)
    renderTransactionList(monthExpenses, transactionList, transactionEmpty);
  }

  // ===== GLOBAL SEARCH PAGE =====
  function renderGlobalSearch() {
    const expenses = getExpenses();
    const query = searchGlobalTitle.value.trim().toLowerCase();
    const selCat = filterGlobalCategory.value;
    const selSrc = filterGlobalSource.value;

    if (!query && !selCat && !selSrc) {
      searchResultsList.innerHTML = '';
      searchEmpty.classList.remove('hidden');
      searchEmpty.querySelector('p').textContent = 'Ketik kata kunci untuk mencari';
      return;
    }

    const filtered = expenses.filter(e => {
      const matchQuery = !query || e.title.toLowerCase().includes(query);
      const matchCat = !selCat || e.category === selCat;
      const matchSrc = !selSrc || e.source === selSrc;
      return matchQuery && matchCat && matchSrc;
    });

    if (filtered.length === 0) {
      searchResultsList.innerHTML = '';
      searchEmpty.classList.remove('hidden');
      searchEmpty.querySelector('p').textContent = 'Transaksi tidak ditemukan';
      return;
    }

    searchEmpty.classList.add('hidden');

    const sorted = [...filtered].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });

    const grouped = {};
    sorted.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
      const d = new Date(date + 'T00:00:00');
      const dayName = d.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      html += `<div class="transaction-date-group">`;
      html += `<div class="transaction-date-header">${dayName}</div>`;

      for (const item of items) {
        const splitBadge = item.hasSplitBill ? '<span class="badge-split">Split</span>' : '';
        html += `
          <div class="transaction-item" data-id="${item.id}">
            <div class="transaction-summary">
              <div class="transaction-left">
                <div class="transaction-title">${escapeHtml(item.title)}</div>
                <div class="transaction-meta">
                  ${escapeHtml(item.category)} · ${escapeHtml(item.source)}
                  ${splitBadge}
                </div>
              </div>
              <div class="transaction-right">
                <div class="transaction-amount">${formatIDR(item.amount)}</div>
                <div class="transaction-time">${item.time}</div>
              </div>
            </div>
            <div class="transaction-detail" id="detail-${item.id}">
              ${item.notes ? `<div class="detail-notes">${escapeHtml(item.notes)}</div>` : ''}
              ${item.hasSplitBill && item.splitBill ? renderSplitDetail(item.splitBill, item.id) : ''}
              <div class="detail-actions">
                <button type="button" class="btn-edit" data-edit-id="${item.id}">Edit</button>
                <button type="button" class="btn-delete" data-delete-id="${item.id}">Hapus</button>
              </div>
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

    searchResultsList.innerHTML = html;
  }

  // ===== BUDGET HELPER =====
  function updateBudgetProgress(totalSpending, viewType) {
    const container = viewType === 'transaksi' ? transaksiBudgetContainer : rekapBudgetContainer;
    const remainingText = viewType === 'transaksi' ? transaksiBudgetRemainingText : rekapBudgetRemainingText;
    const percentText = viewType === 'transaksi' ? transaksiBudgetPercentText : rekapBudgetPercentText;
    const barFill = viewType === 'transaksi' ? transaksiBudgetProgressBarFill : rekapBudgetProgressBarFill;

    const limit = getBudget();
    if (limit <= 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    const remaining = limit - totalSpending;
    const pct = Math.min(100, Math.round((totalSpending / limit) * 100));

    if (remaining >= 0) {
      remainingText.textContent = `Sisa Anggaran: ${formatIDR(remaining)} Bulan Ini`;
    } else {
      remainingText.textContent = `Melebihi Anggaran: ${formatIDR(Math.abs(remaining))} Bulan Ini`;
    }

    percentText.textContent = `${pct}%`;
    barFill.style.width = `${pct}%`;

    // Color code progress bar
    barFill.classList.toggle('exceeded', totalSpending > limit);
  }

  // Month navigation (Rekap tab)
  $$('.month-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      let month = selectedDate.getMonth();
      let year = selectedDate.getFullYear();
      if (dir === 'prev') {
        month--;
        if (month < 0) { month = 11; year--; }
      } else {
        month++;
        if (month > 11) { month = 0; year++; }
      }
      selectedDate.setFullYear(year);
      selectedDate.setMonth(month);
      selectedDate.setDate(1); // Default to 1st
      renderTransaksi();
      renderRecap();
    });
  });

  // Day navigation (Transaksi tab)
  prevDayBtn.addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() - 1);
    renderTransaksi();
    renderRecap();
  });

  nextDayBtn.addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() + 1);
    renderTransaksi();
    renderRecap();
  });

  // ===== CHARTS =====
  function renderLineChart(expenses) {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const dailyTotals = new Array(daysInMonth).fill(0);

    expenses.forEach(e => {
      const day = new Date(e.date).getDate();
      if (day >= 1 && day <= daysInMonth) {
        dailyTotals[day - 1] += e.amount || 0;
      }
    });

    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    if (lineChart) lineChart.destroy();

    const canvas = document.getElementById('lineChart');
    if (!canvas) return;

    lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Pengeluaran',
          data: dailyTotals,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => `Tanggal ${items[0].label}`,
              label: (ctx) => formatIDR(ctx.raw)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 10,
              font: { family: 'Inter', size: 11 },
              color: '#9ca3af'
            }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#9ca3af',
              callback: (v) => {
                if (v >= 1000000) return (v / 1000000).toFixed(1) + 'jt';
                if (v >= 1000) return (v / 1000) + 'k';
                return v;
              }
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  }

  function renderDonutChart(expenses) {
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
    });

    const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const data = entries.map(e => e[1]);
    const colors = labels.map(l => getCategoryColor(l));

    if (donutChart) donutChart.destroy();

    const canvas = document.getElementById('donutChart');
    if (!canvas) return;

    if (labels.length === 0) {
      donutChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Belum ada data'],
          datasets: [{ data: [1], backgroundColor: ['#e5e7eb'], borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          cutout: '68%'
        }
      });
      return;
    }

    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: 'Inter', size: 12, weight: '500' },
              color: '#374151'
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${formatIDR(ctx.raw)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // ===== CATEGORY BREAKDOWN =====
  function renderCategoryBreakdown(expenses, total) {
    const categoryTotals = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
    });

    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      categoryBreakdown.innerHTML = '';
      categoryEmpty.classList.remove('hidden');
      return;
    }

    categoryEmpty.classList.add('hidden');
    categoryBreakdown.innerHTML = sorted.map(([cat, amt]) => {
      const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0';
      const color = getCategoryColor(cat);
      return `
        <div class="category-item">
          <div class="category-info">
            <span class="category-name">${escapeHtml(cat)}</span>
            <span class="category-amount">${formatIDR(amt)}</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="category-pct">${pct}%</span>
        </div>
      `;
    }).join('');
  }

  // ===== TRANSACTION LIST =====
  function renderTransactionList(expenses, listEl, emptyEl) {
    if (expenses.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    // Sort by date desc, then time desc
    const sorted = [...expenses].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });

    // Group by date
    const grouped = {};
    sorted.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
      const d = new Date(date + 'T00:00:00');
      const dayName = d.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      html += `<div class="transaction-date-group">`;
      html += `<div class="transaction-date-header">${dayName}</div>`;

      for (const item of items) {
        const splitBadge = item.hasSplitBill ? '<span class="badge-split">Split</span>' : '';
        html += `
          <div class="transaction-item" data-id="${item.id}">
            <div class="transaction-summary">
              <div class="transaction-left">
                <div class="transaction-title">${escapeHtml(item.title)}</div>
                <div class="transaction-meta">
                  ${escapeHtml(item.category)} · ${escapeHtml(item.source)}
                  ${splitBadge}
                </div>
              </div>
              <div class="transaction-right">
                <div class="transaction-amount">${formatIDR(item.amount)}</div>
                <div class="transaction-time">${item.time}</div>
              </div>
            </div>
            <div class="transaction-detail" id="detail-${item.id}">
              ${item.notes ? `<div class="detail-notes">${escapeHtml(item.notes)}</div>` : ''}
              ${item.hasSplitBill && item.splitBill ? renderSplitDetail(item.splitBill, item.id) : ''}
              <div class="detail-actions">
                <button type="button" class="btn-edit" data-edit-id="${item.id}">Edit</button>
                <button type="button" class="btn-delete" data-delete-id="${item.id}">Hapus</button>
              </div>
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    listEl.innerHTML = html;
  }

  function renderSplitDetail(split, expenseId) {
    let html = '<div class="split-detail">';
    html += '<div class="split-detail-header">Detail Split Bill</div>';

    html += `<div class="split-detail-row"><span>Subtotal</span><span>${formatIDR(split.totalSubtotal)}</span></div>`;
    split.extraFees.forEach(fee => {
      html += `<div class="split-detail-row"><span>${escapeHtml(fee.name)}</span><span>${formatIDR(fee.amount)}</span></div>`;
    });
    if (split.discount > 0) {
      html += `<div class="split-detail-row discount"><span>Diskon</span><span>-${formatIDR(split.discount)}</span></div>`;
    }
    html += `<div class="split-detail-row total"><span>Total</span><span>${formatIDR(split.grandTotal)}</span></div>`;

    html += '<div class="split-people-header">Per Orang</div>';
    split.people.forEach((p, idx) => {
      const feeHtml = (p.feeShares || [])
        .filter(f => f.share > 0)
        .map(f => `<span>${escapeHtml(f.name)}: ${formatIDR(f.share)}</span>`)
        .join('');
      const discountHtml = p.discountShare > 0
        ? `<span class="discount">Diskon: -${formatIDR(p.discountShare)}</span>`
        : '';

      const statusClass = p.isPaid ? 'paid' : 'unpaid';
      const statusText = p.isPaid ? 'Lunas' : 'Belum Lunas';

      html += `
        <div class="split-person">
          <div class="split-person-header-row">
            <span class="split-person-name">${escapeHtml(p.name)}</span>
            <button type="button" class="btn-settle-badge ${statusClass}" data-settle-expense-id="${expenseId}" data-settle-person-idx="${idx}">
              ${statusText}
            </button>
          </div>
          <div class="split-person-details">
            <span>Subtotal: ${formatIDR(p.subtotal)}</span>
            ${feeHtml}
            ${discountHtml}
          </div>
          <div class="split-person-total">Total: ${formatIDR(p.totalToPay)}</div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // Shared transaction list click delegation handler
  function handleTransactionClick(e) {
    // Toggle detail
    const summary = e.target.closest('.transaction-summary');
    if (summary) {
      const item = summary.closest('.transaction-item');
      const detail = item.querySelector('.transaction-detail');
      if (detail) detail.classList.toggle('open');
      return;
    }

    // Settle / Lunas Toggle
    const settleBtn = e.target.closest('[data-settle-expense-id]');
    if (settleBtn) {
      const expenseId = settleBtn.dataset.settleExpenseId;
      const personIdx = parseInt(settleBtn.dataset.settlePersonIdx);

      const expenses = getExpenses();
      const expense = expenses.find(ex => ex.id === expenseId);
      if (expense && expense.hasSplitBill && expense.splitBill && expense.splitBill.people[personIdx]) {
        const person = expense.splitBill.people[personIdx];
        person.isPaid = !person.isPaid;
        setExpenses(expenses);
        renderTransaksi();
        renderRecap();
        renderGlobalSearch();

        // Keep the detail expanded
        const detailDiv = document.getElementById(`detail-${expenseId}`);
        if (detailDiv) detailDiv.classList.add('open');
      }
      return;
    }

    // Edit
    const editBtn = e.target.closest('[data-edit-id]');
    if (editBtn) {
      const id = editBtn.dataset.editId;
      const expenses = getExpenses();
      const expense = expenses.find(ex => ex.id === id);
      if (expense) populateForEdit(expense);
      return;
    }

    // Delete
    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteId;
      showConfirm('Hapus Transaksi?', 'Transaksi ini akan dihapus permanen.', () => {
        const expenses = getExpenses().filter(ex => ex.id !== id);
        setExpenses(expenses);
        renderTransaksi();
        renderRecap();
        renderGlobalSearch();
        showToast('Transaksi dihapus');
      });
      return;
    }
  }

  transaksiList.addEventListener('click', handleTransactionClick);
  transactionList.addEventListener('click', handleTransactionClick);
  searchResultsList.addEventListener('click', handleTransactionClick);

  // ===== CONFIRM MODAL =====
  function showConfirm(title, message, callback) {
    confirmTitleEl.textContent = title;
    confirmMessageEl.textContent = message;
    confirmCallback = callback;
    openModal('confirmModal');
  }

  $('#confirmOk').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
    closeModal('confirmModal');
  });

  $('#confirmCancel').addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirmModal');
  });

  // ===== MANAGE SOURCES =====
  function renderSourcesModal() {
    const sources = getSources();
    const expenses = getExpenses();

    sourcesList.innerHTML = sources.map((s, i) => {
      const inUse = expenses.some(e => e.source === s);
      return `
        <div class="manage-item" data-idx="${i}" data-type="source">
          <span class="manage-item-name">${escapeHtml(s)}</span>
          <div class="manage-item-actions">
            <button type="button" class="btn-edit-small" data-action="edit">Edit</button>
            <button type="button" class="btn-delete-small" data-action="delete" ${inUse ? 'disabled title="Masih digunakan oleh transaksi"' : ''}>Hapus</button>
          </div>
        </div>
      `;
    }).join('');
  }

  $('#manageSourcesBtn').addEventListener('click', () => {
    renderSourcesModal();
    openModal('sourcesModal');
  });

  // Sources list event delegation
  sourcesList.addEventListener('click', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx);
    const sources = getSources();

    // Edit button
    if (e.target.closest('[data-action="edit"]')) {
      const btn = e.target.closest('[data-action="edit"]');
      const nameSpan = item.querySelector('.manage-item-name');

      if (btn.textContent === 'Edit') {
        // Switch to edit mode
        const currentName = sources[idx];
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'manage-item-input';
        input.value = currentName;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        btn.textContent = 'Simpan';
        btn.className = 'btn-save-small';

        // Save on Enter
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') btn.click();
        });
      } else {
        // Save
        const input = item.querySelector('.manage-item-input');
        const newName = input ? input.value.trim() : '';
        if (newName && newName !== sources[idx]) {
          const oldName = sources[idx];
          // Check duplicate
          if (sources.includes(newName)) {
            showToast('Nama sudah ada');
            return;
          }
          sources[idx] = newName;
          setSources(sources);
          // Update expenses
          const expenses = getExpenses();
          expenses.forEach(ex => { if (ex.source === oldName) ex.source = newName; });
          setExpenses(expenses);
          populateDropdowns();
        }
        renderSourcesModal();
      }
      return;
    }

    // Delete button
    if (e.target.closest('[data-action="delete"]')) {
      const btn = e.target.closest('[data-action="delete"]');
      if (btn.disabled) return;
      sources.splice(idx, 1);
      setSources(sources);
      populateDropdowns();
      renderSourcesModal();
      return;
    }
  });

  // Add new source
  $('#addSourceBtn').addEventListener('click', () => {
    const name = newSourceInput.value.trim();
    if (!name) return;
    const sources = getSources();
    if (sources.includes(name)) {
      showToast('Sumber dana sudah ada');
      return;
    }
    sources.push(name);
    setSources(sources);
    newSourceInput.value = '';
    populateDropdowns();
    renderSourcesModal();
    showToast(`"${name}" ditambahkan`);
  });

  newSourceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#addSourceBtn').click();
    }
  });

  // ===== MANAGE CATEGORIES =====
  function renderCategoriesModal() {
    const categories = getCategories();
    const expenses = getExpenses();

    categoriesList.innerHTML = categories.map((c, i) => {
      const inUse = expenses.some(e => e.category === c);
      return `
        <div class="manage-item" data-idx="${i}" data-type="category">
          <span class="manage-item-name">${escapeHtml(c)}</span>
          <div class="manage-item-actions">
            <button type="button" class="btn-edit-small" data-action="edit">Edit</button>
            <button type="button" class="btn-delete-small" data-action="delete" ${inUse ? 'disabled title="Masih digunakan oleh transaksi"' : ''}>Hapus</button>
          </div>
        </div>
      `;
    }).join('');
  }

  $('#manageCategoriesBtn').addEventListener('click', () => {
    renderCategoriesModal();
    openModal('categoriesModal');
  });

  // Categories list event delegation
  categoriesList.addEventListener('click', (e) => {
    const item = e.target.closest('.manage-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx);
    const categories = getCategories();

    // Edit button
    if (e.target.closest('[data-action="edit"]')) {
      const btn = e.target.closest('[data-action="edit"]');
      const nameSpan = item.querySelector('.manage-item-name');

      if (btn.textContent === 'Edit') {
        const currentName = categories[idx];
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'manage-item-input';
        input.value = currentName;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        btn.textContent = 'Simpan';
        btn.className = 'btn-save-small';

        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') btn.click();
        });
      } else {
        const input = item.querySelector('.manage-item-input');
        const newName = input ? input.value.trim() : '';
        if (newName && newName !== categories[idx]) {
          const oldName = categories[idx];
          if (categories.includes(newName)) {
            showToast('Nama sudah ada');
            return;
          }
          categories[idx] = newName;
          setCategories(categories);
          const expenses = getExpenses();
          expenses.forEach(ex => { if (ex.category === oldName) ex.category = newName; });
          setExpenses(expenses);
          populateDropdowns();
        }
        renderCategoriesModal();
      }
      return;
    }

    // Delete button
    if (e.target.closest('[data-action="delete"]')) {
      const btn = e.target.closest('[data-action="delete"]');
      if (btn.disabled) return;
      categories.splice(idx, 1);
      setCategories(categories);
      populateDropdowns();
      renderCategoriesModal();
      return;
    }
  });

  // Add new category
  $('#addCategoryBtn').addEventListener('click', () => {
    const name = newCategoryInput.value.trim();
    if (!name) return;
    const categories = getCategories();
    if (categories.includes(name)) {
      showToast('Kategori sudah ada');
      return;
    }
    categories.push(name);
    setCategories(categories);
    newCategoryInput.value = '';
    populateDropdowns();
    renderCategoriesModal();
    showToast(`"${name}" ditambahkan`);
  });

  newCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#addCategoryBtn').click();
    }
  });

  // ===== BUDGET MODAL =====
  const openBudget = () => {
    const currentBudget = getBudget();
    monthlyLimitInput.value = currentBudget > 0 ? currentBudget : '';
    openModal('budgetModal');
  };

  $('#openBudgetBtn').addEventListener('click', openBudget);

  budgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const limit = parseInt(monthlyLimitInput.value) || 0;
    setBudget(limit);
    closeModal('budgetModal');
    renderTransaksi();
    renderRecap();
    showToast(limit > 0 ? 'Anggaran berhasil disimpan!' : 'Anggaran dinonaktifkan');
  });

  // ===== SEARCH & FILTER TRIGGERS (GLOBAL) =====
  searchGlobalTitle.addEventListener('input', () => {
    renderGlobalSearch();
  });

  filterGlobalCategory.addEventListener('change', () => {
    renderGlobalSearch();
  });

  filterGlobalSource.addEventListener('change', () => {
    renderGlobalSearch();
  });

  // ===== SEARCH TOGGLE & BACK LOGIC =====
  toggleSearchBtn.addEventListener('click', () => {
    switchView('view-search');
  });

  searchBackBtn.addEventListener('click', () => {
    searchGlobalTitle.value = '';
    filterGlobalCategory.value = '';
    filterGlobalSource.value = '';
    switchView('view-transaksi');
  });

  // ===== BACKUP / RESTORE LOGIC =====
  backupBtn.addEventListener('click', () => {
    openModal('backupModal');
  });

  exportDataBtn.addEventListener('click', () => {
    const backupData = {
      expenses: getExpenses(),
      categories: getCategories(),
      sources: getSources(),
      budget: getBudget()
    };
    
    try {
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `catatduit_backup_${toISODate(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Data berhasil diekspor!');
      closeModal('backupModal');
    } catch (err) {
      showToast('Gagal mengekspor data');
    }
  });

  importDataBtn.addEventListener('click', () => {
    const file = importFileInput.files[0];
    if (!file) {
      showToast('Pilih file backup terlebih dahulu');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('Invalid format');
        }

        if (parsed.expenses) setExpenses(parsed.expenses);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.sources) setSources(parsed.sources);
        if (parsed.budget !== undefined) setBudget(parsed.budget);

        showToast('Data berhasil diimpor!');
        closeModal('backupModal');
        importFileInput.value = '';
        
        populateDropdowns();
        renderTransaksi();
        renderRecap();
      } catch (err) {
        showToast('File backup tidak valid atau rusak');
      }
    };
    reader.readAsText(file);
  });

  // ===== INIT =====
  initForm();
  switchView('view-transaksi');
});
