# Design and UX

## Feel
Calm, fast, rewarding. Big tap targets, one primary action per screen, minimal typing.

## Layout
- Bottom tab bar: Home · Add (center, prominent) · Debts · Accounts · Stats
- Home: today's date, balance card, spent today/week/month, streak flame, budget indicators, recent entries.
- Add: amount first, then category chips (recent first), account, date (default today), note last.

## Visual
- Light and dark themes via CSS variables; one accent color; rounded cards; generous spacing.
- Category colors consistent across charts and chips.
- Green / yellow / red only for budget status.
- Typography: one clean sans-serif (system stack or one Google Font with fallback).

## Motion and sound
- 150–250ms transitions; count-up on totals; confetti-light on milestones only.
- Sounds: save (soft tick), streak milestone, level up. Mute toggle in settings. Respect browser autoplay rules.

## Gamification rules
- Streak: a day counts if at least one entry is logged (or "no spend" is tapped).
- Freeze days: earn 1 per 7-day streak, max 2; auto-used on a missed day.
- XP: log entry +5, full day under budget +10, debt payment +10, settle debt +25. Level thresholds grow gradually.
- Never shame; use encouraging copy.

## Empty/error states
Every screen has a friendly empty state and a retry on failure.
