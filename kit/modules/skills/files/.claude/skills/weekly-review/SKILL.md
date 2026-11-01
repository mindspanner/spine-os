---
name: weekly-review
description: Run the weekly review and update the dashboard. Use when the person says weekly review, plan my week, or Friday review.
---

# Weekly review

Follow `vault/systems/Weekly-Review.md`. In short:
1. Inbox: count items; offer `sort-inbox`.
2. Reminders: run `whats-due` for the next 14 days.
3. Projects and cases: list anything with no next action or no contact in 30 days (codes only).
4. Backups: ask "did your backup run this week?" (see `SOP-data-backup-3-2-1.md`).
5. Update `status-board.json`, then run `node refresh-status-board.mjs` if Node is available.
6. Finish with the top 3 for next week.
