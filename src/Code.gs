/** LedgerLit backend. See docs/ARCHITECTURE.md */

var SCHEMA = {
  Transactions: ['id','date','type','amount','categoryId','accountId','toAccountId','note','createdAt'],
  Categories:   ['id','name','icon','color','type','monthlyBudget','archived'],
  Accounts:     ['id','name','kind','openingBalance','color','archived','startDate'],
  People:       ['id','name','note'],
  Debts:        ['id','personId','direction','amount','date','dueDate','note','status'],
  DebtPayments: ['id','debtId','date','amount','note'],
  Settings:     ['key','value']
};

var DEFAULT_CATEGORIES = [
  { id: 'cat_food', name: 'Food & Dining', icon: '🍔', color: '#F59E0B', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_transport', name: 'Transportation', icon: '🚗', color: '#3B82F6', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_bills', name: 'Bills & Utilities', icon: '💡', color: '#EF4444', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_school', name: 'School & Education', icon: '📚', color: '#8B5CF6', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_health', name: 'Health & Medical', icon: '💊', color: '#10B981', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_fun', name: 'Entertainment & Fun', icon: '🎮', color: '#EC4899', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_savings', name: 'Savings & Investments', icon: '💰', color: '#14B8A6', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_other', name: 'Other', icon: '📦', color: '#6B7280', type: 'expense', monthlyBudget: 0, archived: false },
  { id: 'cat_income', name: 'Salary & Income', icon: '💵', color: '#22C55E', type: 'income', monthlyBudget: 0, archived: false }
];

var DEFAULT_ACCOUNTS = [
  { id: 'acc_cash', name: 'Cash', kind: 'cash', openingBalance: 0, color: '#10B981', archived: false, startDate: '' },
  { id: 'acc_gcash', name: 'GCash', kind: 'ewallet', openingBalance: 0, color: '#007DFE', archived: false, startDate: '' },
  { id: 'acc_bank', name: 'Bank', kind: 'bank', openingBalance: 0, color: '#6366F1', archived: false, startDate: '' }
];

var DEFAULT_SETTINGS = [
  { key: 'currency', value: 'PHP' },
  { key: 'soundOn', value: 'true' },
  { key: 'theme', value: 'system' },
  { key: 'xp', value: '0' },
  { key: 'freezes', value: '0' }
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('LedgerLit')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Get active spreadsheet or open by ID from Script Properties */
function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (prop) return SpreadsheetApp.openById(prop);
  throw new Error('No active spreadsheet found. If running as a standalone script, set SPREADSHEET_ID in Script Properties.');
}

/** Run once from the editor to create tabs, headers, and seed defaults. Idempotent. */
function setupSheets() {
  var ss = getSpreadsheet();

  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    var currentLastCol = sh.getLastColumn();
    var currentLastRow = sh.getLastRow();

    // Set or refresh header row
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);

    // Populate defaults if sheet has no data rows
    if (currentLastRow <= 1) {
      if (name === 'Categories' && DEFAULT_CATEGORIES.length > 0) {
        var catRows = DEFAULT_CATEGORIES.map(function (c) {
          return [c.id, c.name, c.icon, c.color, c.type, c.monthlyBudget, c.archived];
        });
        sh.getRange(2, 1, catRows.length, headers.length).setValues(catRows);
      } else if (name === 'Accounts' && DEFAULT_ACCOUNTS.length > 0) {
        var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
        var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
        var accRows = DEFAULT_ACCOUNTS.map(function (a) {
          return [a.id, a.name, a.kind, a.openingBalance, a.color, a.archived, a.startDate || todayStr];
        });
        sh.getRange(2, 1, accRows.length, headers.length).setValues(accRows);
      } else if (name === 'Settings' && DEFAULT_SETTINGS.length > 0) {
        var setRows = DEFAULT_SETTINGS.map(function (s) {
          return [s.key, s.value];
        });
        sh.getRange(2, 1, setRows.length, headers.length).setValues(setRows);
      }
    }
  });

  return { success: true, message: 'Sheets initialized successfully.' };
}

/** Ensures sheet headers match SCHEMA so new columns like startDate are always recognized. */
function ensureSheetHeaders(ss) {
  var sheetNames = ['Transactions', 'Categories', 'Accounts', 'People', 'Debts', 'DebtPayments', 'Settings'];
  sheetNames.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var headers = SCHEMA[name];
    var lastCol = sh.getLastColumn();
    if (lastCol < headers.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    } else {
      var row1 = sh.getRange(1, 1, 1, headers.length).getValues()[0];
      var needsUpdate = false;
      for (var k = 0; k < headers.length; k++) {
        if (row1[k] !== headers[k]) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      }
    }
  });
}

/** Migrates legacy or missing startDate on accounts to the current date so historical entries don't deduct. */
function migrateAccountsStartDate(ss) {
  var sh = ss.getSheetByName('Accounts');
  if (!sh) return;
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return;

  for (var i = 1; i < data.length; i++) {
    var val = data[i][6];
    if (!val || val === '2026-01-01' || String(val).indexOf('2026-01-01') === 0) {
      sh.getRange(i + 1, 7).setValue(todayStr);
    }
  }
}

/** Reads a sheet into an array of objects using its header row. Batched read. */
function getSheetRowsAsObjects(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var rowData = data[i];
    var obj = {};
    var hasContent = false;
    for (var j = 0; j < headers.length; j++) {
      var val = rowData[j];
      var key = headers[j];
      if (val !== '' && val !== null && val !== undefined) {
        hasContent = true;
      }
      // Format dates consistently as yyyy-MM-dd if Google Sheet returned a Date object
      if (val instanceof Date) {
        val = Utilities.formatDate(val, ss.getSpreadsheetTimeZone() || 'Asia/Manila', 'yyyy-MM-dd');
      }
      obj[key] = val;
    }
    if (hasContent && obj.id !== '') {
      rows.push(obj);
    }
  }
  return rows;
}

/**
 * Bootstrap API: returns all critical state in one call.
 * Returns: { categories, accounts, people, settings, transactions, debts }
 */
function getBootstrap() {
  var ss = getSpreadsheet();
  ensureSheetHeaders(ss);
  migrateAccountsStartDate(ss);

  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var categories = getSheetRowsAsObjects(ss, 'Categories');
  var accounts = getSheetRowsAsObjects(ss, 'Accounts');
  accounts.forEach(function (a) {
    if (!a.startDate || a.startDate === '2026-01-01') a.startDate = todayStr;
  });
  var people = getSheetRowsAsObjects(ss, 'People');
  var debts = getSheetRowsAsObjects(ss, 'Debts');
  var debtPayments = getSheetRowsAsObjects(ss, 'DebtPayments');
  var rawSettings = getSheetRowsAsObjects(ss, 'Settings');
  var allTransactions = getSheetRowsAsObjects(ss, 'Transactions');

  // Convert settings list to key-value dictionary
  var settingsMap = {};
  rawSettings.forEach(function (s) {
    if (s.key) settingsMap[s.key] = s.value;
  });

  // Ensure default fallback settings if missing
  if (!settingsMap.currency) settingsMap.currency = 'PHP';
  if (!settingsMap.soundOn) settingsMap.soundOn = 'true';
  if (!settingsMap.theme) settingsMap.theme = 'system';
  if (!settingsMap.xp) settingsMap.xp = '0';
  if (!settingsMap.freezes) settingsMap.freezes = '0';

  // Sort transactions descending by date and createdAt, limit to most recent 100 for fast payload
  allTransactions.sort(function (a, b) {
    var dateA = String(a.date || '') + String(a.createdAt || '');
    var dateB = String(b.date || '') + String(b.createdAt || '');
    return dateB.localeCompare(dateA);
  });
  var recentTransactions = allTransactions.slice(0, 100);

  return {
    categories: categories,
    accounts: accounts,
    people: people,
    debts: debts,
    debtPayments: debtPayments,
    settings: settingsMap,
    transactions: recentTransactions
  };
}

/**
 * Batch append transactions with validation, UUID generation, and concurrency locking.
 * @param {Array|Object} list - Single transaction object or array of transaction objects
 */
function addTransactions(list) {
  if (!list) throw new Error('Transaction data is required.');
  var items = Array.isArray(list) ? list : [list];
  if (items.length === 0) return { success: true, transactions: [] };

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('Transactions sheet not found. Run setupSheets() first.');

  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var nowIso = new Date().toISOString();

  // Validate and normalize all items
  var validTransactions = [];
  var rowsToAppend = [];

  for (var i = 0; i < items.length; i++) {
    var t = items[i];

    // Validate type
    var type = String(t.type || 'expense').toLowerCase().trim();
    if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
      throw new Error('Invalid transaction type at index ' + i + ': ' + t.type);
    }

    // Validate amount
    var numAmount = parseFloat(t.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount at index ' + i + ': ' + t.amount + '. Amount must be greater than zero.');
    }
    // Fixed 2-decimal number
    var cleanAmount = Math.round(numAmount * 100) / 100;

    // Validate date format yyyy-MM-dd
    var dateStr = String(t.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateStr = todayStr;
    }

    // Validate accounts
    var accountId = String(t.accountId || '').trim();
    if (!accountId) {
      throw new Error('Account ID is required at index ' + i);
    }

    var toAccountId = '';
    if (type === 'transfer') {
      toAccountId = String(t.toAccountId || '').trim();
      if (!toAccountId) {
        throw new Error('Destination account (toAccountId) is required for transfers at index ' + i);
      }
      if (toAccountId === accountId) {
        throw new Error('Source and destination accounts cannot be identical for transfers.');
      }
    }

    // Category (required for expense/income, optional for transfer)
    var categoryId = String(t.categoryId || '').trim();
    if (type !== 'transfer' && !categoryId) {
      categoryId = 'cat_other';
    }

    var id = t.id && String(t.id).trim() ? String(t.id).trim() : Utilities.getUuid();
    var note = t.note !== undefined && t.note !== null ? String(t.note).trim() : '';
    var createdAt = t.createdAt || nowIso;

    var normalized = {
      id: id,
      date: dateStr,
      type: type,
      amount: cleanAmount,
      categoryId: categoryId,
      accountId: accountId,
      toAccountId: toAccountId,
      note: note,
      createdAt: createdAt
    };

    validTransactions.push(normalized);

    // Schema order: id, date, type, amount, categoryId, accountId, toAccountId, note, createdAt
    rowsToAppend.push([
      normalized.id,
      normalized.date,
      normalized.type,
      normalized.amount,
      normalized.categoryId,
      normalized.accountId,
      normalized.toAccountId,
      normalized.note,
      normalized.createdAt
    ]);
  }

  // Acquire lock to prevent race conditions during write
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds for concurrent writes
  } catch (e) {
    throw new Error('Could not obtain lock to save transactions. Please try again. ' + e.message);
  }

  try {
    var startRow = sh.getLastRow() + 1;
    sh.getRange(startRow, 1, rowsToAppend.length, SCHEMA.Transactions.length).setValues(rowsToAppend);
  } finally {
    lock.releaseLock();
  }

  return {
    success: true,
    count: validTransactions.length,
    transactions: validTransactions
  };
}

/**
 * Update an existing transaction by ID.
 * @param {Object} t - Transaction object with ID and updated fields
 */
function updateTransaction(t) {
  if (!t || !t.id) throw new Error('Transaction ID is required for update.');

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('Transactions sheet not found.');

  var numAmount = parseFloat(t.amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid amount: ' + t.amount);
  }
  var cleanAmount = Math.round(numAmount * 100) / 100;

  var type = String(t.type || 'expense').toLowerCase().trim();
  if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
    throw new Error('Invalid transaction type: ' + t.type);
  }

  var dateStr = String(t.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || 'Asia/Manila', 'yyyy-MM-dd');
  }

  var accountId = String(t.accountId || '').trim();
  if (!accountId) throw new Error('Account ID is required.');

  var toAccountId = type === 'transfer' ? String(t.toAccountId || '').trim() : '';
  if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
    throw new Error('Valid distinct destination account is required for transfers.');
  }

  var categoryId = type !== 'transfer' ? (String(t.categoryId || '').trim() || 'cat_other') : '';
  var note = t.note !== undefined && t.note !== null ? String(t.note).trim() : '';

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Could not obtain lock: ' + e.message);
  }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    var createdAt = '';

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(t.id)) {
        rowIndex = i + 1; // 1-based row number
        createdAt = data[i][8] || new Date().toISOString();
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Transaction not found with ID: ' + t.id);
    }

    var updatedRow = [
      t.id,
      dateStr,
      type,
      cleanAmount,
      categoryId,
      accountId,
      toAccountId,
      note,
      createdAt
    ];

    sh.getRange(rowIndex, 1, 1, SCHEMA.Transactions.length).setValues([updatedRow]);

    return {
      success: true,
      transaction: {
        id: t.id,
        date: dateStr,
        type: type,
        amount: cleanAmount,
        categoryId: categoryId,
        accountId: accountId,
        toAccountId: toAccountId,
        note: note,
        createdAt: createdAt
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a transaction by ID.
 * @param {string} id - Transaction ID to delete
 */
function deleteTransaction(id) {
  if (!id) throw new Error('Transaction ID is required for deletion.');

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Transactions');
  if (!sh) throw new Error('Transactions sheet not found.');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Could not obtain lock: ' + e.message);
  }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        rowIndex = i + 1; // 1-based row number
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Transaction not found with ID: ' + id);
    }

    sh.deleteRow(rowIndex);
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add or update a category.
 * SCHEMA: id, name, icon, color, type, monthlyBudget, archived
 */
function saveCategory(c) {
  if (!c || !c.name) throw new Error('Category name is required.');
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Categories');
  if (!sh) throw new Error('Categories sheet not found.');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    var id = c.id && String(c.id).trim() ? String(c.id).trim() : 'cat_' + Utilities.getUuid().substr(0, 8);
    var type = String(c.type || 'expense').toLowerCase();
    var budget = parseFloat(c.monthlyBudget) || 0;
    var archived = c.archived === true || c.archived === 'true';

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    var row = [id, c.name.trim(), c.icon || '📦', c.color || '#0d9488', type, budget, archived];
    if (rowIndex !== -1) {
      sh.getRange(rowIndex, 1, 1, SCHEMA.Categories.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }

    return {
      success: true,
      category: { id: id, name: c.name.trim(), icon: c.icon || '📦', color: c.color || '#0d9488', type: type, monthlyBudget: budget, archived: archived }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add or update an account.
 * SCHEMA: id, name, kind, openingBalance, color, archived, startDate
 */
function saveAccount(a) {
  if (!a || !a.name) throw new Error('Account name is required.');
  var ss = getSpreadsheet();
  ensureSheetHeaders(ss);
  var sh = ss.getSheetByName('Accounts');
  if (!sh) throw new Error('Accounts sheet not found.');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    var id = a.id && String(a.id).trim() ? String(a.id).trim() : 'acc_' + Utilities.getUuid().substr(0, 8);
    var openingBalance = Math.round((parseFloat(a.openingBalance) || 0) * 100) / 100;
    var archived = a.archived === true || a.archived === 'true';
    var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
    var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var startDate = a.startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(a.startDate).trim()) && String(a.startDate).trim() !== '2026-01-01'
      ? String(a.startDate).trim()
      : todayStr;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    var row = [id, a.name.trim(), a.kind || 'cash', openingBalance, a.color || '#0d9488', archived, startDate];
    if (rowIndex !== -1) {
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }

    return {
      success: true,
      account: {
        id: id,
        name: a.name.trim(),
        kind: a.kind || 'cash',
        openingBalance: openingBalance,
        color: a.color || '#0d9488',
        archived: archived,
        startDate: startDate
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete an account by ID.
 * @param {string} id - Account ID to delete
 */
function deleteAccount(id) {
  if (!id) throw new Error('Account ID is required for deletion.');

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Accounts');
  if (!sh) throw new Error('Accounts sheet not found.');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Could not obtain lock: ' + e.message);
  }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        rowIndex = i + 1; // 1-based row number
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Account not found with ID: ' + id);
    }

    sh.deleteRow(rowIndex);
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add or update a person in People.
 * SCHEMA: id, name, note
 */
function savePerson(p) {
  if (!p || !p.name) throw new Error('Person name is required.');
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('People');
  if (!sh) throw new Error('People sheet not found.');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    var id = p.id && String(p.id).trim() ? String(p.id).trim() : 'per_' + Utilities.getUuid().substr(0, 8);
    var note = p.note !== undefined && p.note !== null ? String(p.note).trim() : '';

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        rowIndex = i + 1;
        break;
      }
    }

    var row = [id, p.name.trim(), note];
    if (rowIndex !== -1) {
      sh.getRange(rowIndex, 1, 1, SCHEMA.People.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }

    return {
      success: true,
      person: { id: id, name: p.name.trim(), note: note }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add a debt record.
 * SCHEMA: id, personId, direction (owed_to_me/i_owe), amount, date, dueDate, note, status (open/settled)
 */
function addDebt(d) {
  if (!d || !d.personId) throw new Error('Person is required.');
  var numAmount = parseFloat(d.amount);
  if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valid debt amount is required.');
  var cleanAmount = Math.round(numAmount * 100) / 100;

  var direction = String(d.direction || 'owed_to_me').toLowerCase().trim();
  if (direction !== 'owed_to_me' && direction !== 'i_owe') {
    throw new Error('Invalid debt direction.');
  }

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Debts');
  if (!sh) throw new Error('Debts sheet not found.');

  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var dateStr = String(d.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  }

  var dueDateStr = String(d.dueDate || '').trim();
  if (dueDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
    dueDateStr = '';
  }

  var id = d.id && String(d.id).trim() ? String(d.id).trim() : 'dbt_' + Utilities.getUuid().substr(0, 8);
  var note = d.note !== undefined && d.note !== null ? String(d.note).trim() : '';
  var status = d.status === 'settled' ? 'settled' : 'open';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var row = [id, d.personId, direction, cleanAmount, dateStr, dueDateStr, note, status];
    sh.appendRow(row);

    return {
      success: true,
      debt: {
        id: id,
        personId: d.personId,
        direction: direction,
        amount: cleanAmount,
        date: dateStr,
        dueDate: dueDateStr,
        note: note,
        status: status
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add a payment towards a debt. Automatically settles debt if total paid >= debt amount.
 * SCHEMA: id, debtId, date, amount, note
 */
function addDebtPayment(p) {
  if (!p || !p.debtId) throw new Error('Debt ID is required.');
  var numAmount = parseFloat(p.amount);
  if (isNaN(numAmount) || numAmount <= 0) throw new Error('Valid payment amount is required.');
  var cleanAmount = Math.round(numAmount * 100) / 100;

  var ss = getSpreadsheet();
  var shPayments = ss.getSheetByName('DebtPayments');
  var shDebts = ss.getSheetByName('Debts');
  if (!shPayments || !shDebts) throw new Error('Debt sheets not found.');

  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var dateStr = String(p.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  }

  var id = p.id && String(p.id).trim() ? String(p.id).trim() : 'pay_' + Utilities.getUuid().substr(0, 8);
  var note = p.note !== undefined && p.note !== null ? String(p.note).trim() : '';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    // 1. Append payment row
    shPayments.appendRow([id, p.debtId, dateStr, cleanAmount, note]);

    // 2. Check total payments for this debt
    var paymentsData = shPayments.getDataRange().getValues();
    var totalPaid = 0;
    for (var i = 1; i < paymentsData.length; i++) {
      if (String(paymentsData[i][1]) === String(p.debtId)) {
        totalPaid += (parseFloat(paymentsData[i][3]) || 0);
      }
    }

    // 3. Find original debt and check if settled
    var debtsData = shDebts.getDataRange().getValues();
    var isSettled = false;
    for (var j = 1; j < debtsData.length; j++) {
      if (String(debtsData[j][0]) === String(p.debtId)) {
        var debtAmount = parseFloat(debtsData[j][3]) || 0;
        if (totalPaid >= debtAmount) {
          shDebts.getRange(j + 1, 8).setValue('settled'); // Column 8 = status
          isSettled = true;
        }
        break;
      }
    }

    return {
      success: true,
      payment: { id: id, debtId: p.debtId, date: dateStr, amount: cleanAmount, note: note },
      totalPaid: Math.round(totalPaid * 100) / 100,
      settled: isSettled
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mark a debt as settled.
 */
function settleDebt(id) {
  if (!id) throw new Error('Debt ID is required.');
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Debts');
  if (!sh) throw new Error('Debts sheet not found.');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) throw new Error('Debt not found with ID: ' + id);

    sh.getRange(rowIndex, 8).setValue('settled'); // Column 8 = status
    return { success: true, id: id, status: 'settled' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save a configuration setting.
 */
function saveSetting(key, value) {
  if (!key) throw new Error('Setting key is required.');
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Settings');
  if (!sh) throw new Error('Settings sheet not found.');

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Lock error: ' + e.message); }

  try {
    var data = sh.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(key)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      sh.getRange(rowIndex, 2).setValue(String(value));
    } else {
      sh.appendRow([String(key), String(value)]);
    }

    return { success: true, key: key, value: String(value) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Seed realistic sample data for verification and initial testing.
 */
function seedSampleData() {
  setupSheets();
  var ss = getSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone() || 'Asia/Manila';
  var today = new Date();
  var formatDate = function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };

  var d0 = formatDate(today);
  var d1 = formatDate(new Date(today.getTime() - 86400000));
  var d2 = formatDate(new Date(today.getTime() - 2 * 86400000));
  var d3 = formatDate(new Date(today.getTime() - 5 * 86400000));

  var sampleTxs = [
    { type: 'income', amount: 25000, accountId: 'acc_bank', categoryId: 'cat_income', date: d3, note: 'Freelance payment' },
    { type: 'transfer', amount: 3000, accountId: 'acc_bank', toAccountId: 'acc_gcash', date: d2, note: 'GCash top-up' },
    { type: 'expense', amount: 180, accountId: 'acc_gcash', categoryId: 'cat_food', date: d2, note: 'Chickenjoy meal' },
    { type: 'expense', amount: 45, accountId: 'acc_cash', categoryId: 'cat_transport', date: d1, note: 'Jeepney fare' },
    { type: 'expense', amount: 1500, accountId: 'acc_bank', categoryId: 'cat_bills', date: d1, note: 'Internet fiber bill' },
    { type: 'expense', amount: 250, accountId: 'acc_gcash', categoryId: 'cat_fun', date: d0, note: 'Movie popcorn' },
    { type: 'expense', amount: 120, accountId: 'acc_cash', categoryId: 'cat_food', date: d0, note: 'Iced Coffee' }
  ];

  addTransactions(sampleTxs);

  // Seed sample person and debt
  var pRes = savePerson({ name: 'Mark Ramos', note: 'College buddy' });
  if (pRes && pRes.person) {
    addDebt({
      personId: pRes.person.id,
      direction: 'owed_to_me',
      amount: 500,
      date: d1,
      dueDate: d0,
      note: 'Lunch share'
    });
  }

  return { success: true, message: 'Sample data seeded successfully.' };
}


