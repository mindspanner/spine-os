---
name: whats-due
description: List overdue, today and next-7-days reminders and offer calendar files. Use when the person asks what's due, what's on, remind me, or add a reminder.
---

# What's due

1. Read `vault/REMINDERS.md`. If it does not exist, offer to create it from the reminders layout.
2. Reply in three short groups: overdue · today · next 7 days. One line each.
3. "Remind me to X on DATE" → add a row. Repeating items: add the next one when marked done.
4. On request, write a calendar file in `vault/00-INBOX/` named `YYYY-MM-DD reminder <what>.ics`
   (VCALENDAR 2.0, one VEVENT, DTSTART as a date, SUMMARY with the client code not a name, VALARM
   1 day before). Tell the person: double-click it to add it to their calendar.
5. Never contact anyone yourself.
