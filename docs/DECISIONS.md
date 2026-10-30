# Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-19 | Google Apps Script + Google Sheet | Free, multi-device, data owned in own Google account |
| 2026-10-19 | Vanilla JS, no framework | Apps Script serves plain HTML; no build step |
| 2026-10-19 | Default currency PHP (₱) | Owner is in the Philippines; configurable in Settings |
| 2026-10-19 | 2-decimal amounts in Sheets | Natural formatting in Google Sheets while avoiding float accumulation in JS |
| 2026-10-19 | Default Income category added | Pre-populates 'Salary & Income' alongside the 8 expense categories |
| 2026-10-19 | LockService on writes | Protects concurrent addTransactions calls against race conditions |
| 2026-10-19 | Optimistic UI with rollback | Instant UI update with temporary client ID and graceful rollback on network error |
| 2026-10-19 | Bulk Add mode | Multi-row batch entry for fast multi-date logging |
| 2026-10-19 | Chart.js via jsDelivr CDN | Lightweight visual donuts for money distribution and category spending |
| 2026-10-19 | Auto-settle on full payment | Automatically transitions debt status to 'settled' when payments reach total |
| 2026-10-19 | Web Audio API tones | Zero external audio asset dependencies; instant subtle feedback |
| 2026-10-19 | Client-side CSV & Keep parser | Fast export and import without round-trips to external services |
| 2026-10-30 | Account Editing & Deletion API | Enabled editing account details and backend `deleteAccount(id)` with `LockService` |
| 2026-10-30 | Account Starting Date Protection | Each account tracks `startDate`; transactions prior to this date do not alter current balance or savings |
| 2026-10-30 | Automated Zero-Spend XP | Replaced manual "No Spend Today" button with automated detection of past 0-expense days (+10 XP) |
| 2026-10-30 | Critical Action Confirmations | Added custom in-app confirmation modal for destructive/critical actions (account/tx delete, settle, import) |
| 2026-10-30 | Rich Monthly & Daily Charts | Added 7-day spending trend on Home, 6-month Income vs Expense bar chart, and Month Daily Spending chart |
| 2026-10-30 | Fix Streak & Account Start Date Isolation | Fixed tautological 365 streak loop to only count contiguous active logged days; added auto-header schema migration and dynamic today-based startDate so past history does not deduct from current funds |
| 2026-10-30 | Project Rebrand to kwartracker & Public Release Prep | Renamed project to kwartracker (inspired by personal data sovereignty, zero logins, zero paywalls, 100% free stack with Google Apps Script + Sheets). Added comprehensive README, MIT License, and LinkedIn outreach assets |
| 2026-10-30 | Rebrand to LedgerLit ("Track smarter. Streak harder") | Finalized brand identity as LedgerLit. Added private asset exclusion (.agent/, docs/LINKEDIN_POST.md, AGENTS.md) in .gitignore for public GitHub release to https://github.com/jjoosseepphh11/LedgetLit.git |
