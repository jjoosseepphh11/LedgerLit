# Architecture

## Stack
Google Apps Script (V8) web app. `doGet()` serves `index.html` via `HtmlService`. Frontend calls backend with `google.script.run`. Google Sheet is the database.

## Sheet schema (one tab each; row 1 = headers)
| Tab | Columns |
|---|---|
| Transactions | id, date, type (expense/income/transfer), amount, categoryId, accountId, toAccountId, note, createdAt |
| Categories | id, name, icon, color, type (expense/income), monthlyBudget, archived |
| Accounts | id, name, kind (cash/ewallet/bank/savings), openingBalance, color, archived, startDate |
| People | id, name, note |
| Debts | id, personId, direction (owed_to_me/i_owe), amount, date, dueDate, note, status (open/settled) |
| DebtPayments | id, debtId, date, amount, note |
| Settings | key, value (currency, soundOn, xp, freezes, theme) |

Rules: ids are UUIDs (`Utilities.getUuid()`); dates are `yyyy-MM-dd` strings; streaks, balances and totals are derived, never stored.

## Backend API (Code.gs)
- `setupSheets()` — create tabs/headers and default categories/accounts (run once)
- `getBootstrap()` — one call returning categories, accounts, people, settings, recent transactions, debts
- `addTransactions(list)` — validate and batch-append
- `updateTransaction(t)`, `deleteTransaction(id)`
- `getDashboard(range)` — totals, category breakdown, budget status, streak, level
- `saveCategory`, `saveAccount`, `deleteAccount`, `savePerson`
- `addDebt(d)`, `addDebtPayment(p)`, `settleDebt(id)`
- `saveSetting(key, value)`

## Performance
- Load everything with one `getBootstrap()` call, then keep state in memory.
- Optimistic UI: update screen first, save in the background, roll back on failure.
- Cache bootstrap data with `CacheService` (short TTL) and in the browser; use `LockService` on writes.
- Batch reads/writes (`getValues`/`setValues`), never per-cell calls in loops.

## Frontend
Single-page app in `index.html`: bottom tab bar (Home, Add, Debts, Accounts, Stats). Charts via Chart.js from cdnjs. Audio via small Web Audio API tones (no remote files). Audio starts only after the first user tap.

## Security
Web app deployed as: execute as me, access only myself. No API keys in the repo. `.clasp.json` is git-ignored.
