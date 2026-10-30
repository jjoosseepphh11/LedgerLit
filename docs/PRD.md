# Product Requirements

## Goal
Replace Google Keep notes with a fast, focused finance tracker that is pleasant enough to use every day.

## Principles
- Logging an expense takes under 5 seconds.
- Numbers are always visible and honest; no clutter.
- Free forever, runs on every device via one URL.

## Features (MVP → later)
### 1. Quick add (MVP)
- Big amount keypad, category chips, account selector, date defaulting to today, optional note.
- Types: expense, income, transfer between accounts.
- Bulk mode: add several entries across multiple dates in one go.

### 2. Dashboard (MVP)
- Today's date, balance, spent today / this week / this month.
- Category breakdown (donut, % and ₱), trend (bar/line).
- Indicators: budget bars (green/yellow/red), safe-to-spend today, month-over-month change.

### 3. Accounts and money distribution (MVP)
- Accounts: cash, e-wallet (e.g. GCash), bank, savings. Balance per account.
- Distribution donut across accounts.

### 4. Debts (MVP)
- People list (add/edit).
- Two directions: "they owe me" and "I owe them".
- Partial payments, due dates, status (open/settled), totals per person and overall.
- Reminder indicator for overdue debts.

### 5. Gamification
- Daily logging streak with flame, freeze days, longest streak.
- XP and levels (logging, staying under budget, settling debts), badges.
- Weekly recap card.

### 6. Sound and feel
- Subtle sounds on save, streak milestone, level up; mute toggle.
- Haptics via `navigator.vibrate` where supported.

### 7. Later
- Recurring entries, savings goals, Google Keep import screen, CSV export, offline queue.

## Out of scope
Bank syncing, multi-user sharing, paid services.

## Acceptance (global)
Mobile-first, dark mode, optimistic saves, works on all the owner's devices from the same URL.
