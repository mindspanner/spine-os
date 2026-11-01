# SOP — Incident record (when something goes wrong, write it down)

- **When to run this:** as soon as you become aware of an incident — a lost or stolen device, a misdirected email containing personal information, a suspected breach, a data-loss event, a serious complaint, or a near-miss you want to learn from.
- **Owner:** you
- **Last reviewed:** YYYY-MM-DD

## Purpose

Capture what happened, what you did, and what you'll change — calmly, at the time, in one place. A written incident record protects you (it shows you acted reasonably), helps you respond well (a checklist beats panic), and turns a bad day into a process improvement instead of a recurring problem. It is an internal admin record; it does not replace any reporting obligation you may have.

## Inputs

- What you noticed, and when.
- Who/what is affected (people, data, systems, money).
- Any evidence (screenshots, emails, logs) — keep them.

## Outputs

- One dated incident file in `20-GOVERNANCE/incidents/` (create the folder on first use).
- A short follow-up action list, tracked like any other next action.
- An ADR if the fix changes how you operate.

## Steps

1. **Stop the bleeding first.** Contain before you document — disconnect the lost-able, recall the email if you can, change the password, isolate the drive. Safety and containment come before paperwork.
2. **Open the record.** Create `20-GOVERNANCE/incidents/<YYYY-MM-DD>-<short-name>.md`. Date and time it. Write while it's fresh.
3. **Record the facts, not blame.** What happened, when you noticed, how you noticed, what's affected, what you've done so far. Plain timeline. Avoid speculation; mark guesses as guesses.
4. **Assess the impact.** Who/what is affected and how badly? Is any personal or sensitive information involved? Note your honest read.
5. **Check your obligations.** Ask whether this triggers any reporting or notification duty that applies to *you* (e.g. notifying affected people, a regulator, an insurer, a professional body). This SOP does not tell you what those are — it reminds you to check, and to record that you checked.
6. **List the follow-ups.** Concrete actions with owners (you) and dates. Track them like any next action until done.
7. **Learn from it.** When resolved, write the one change that stops a repeat. If it changes how you operate, capture it as an ADR.

## Done when

The incident is contained, a dated record exists with a factual timeline and impact assessment, you've checked (and noted) any reporting obligations, and the follow-up actions are tracked to completion.

## Worked example

A consultant emails a client report to the wrong "John" in autocomplete.

1. Recalls the message (partly works); emails the wrong recipient asking them to delete it, unread.
2. Opens `incidents/2026-04-11-misdirected-report.md`, timestamps it.
3. Timeline: sent 9:14, noticed 9:16 from the bounce-back thread, recall attempted 9:17.
4. Impact: one client report with the client's name and project details went to an unintended individual; no financial data.
5. Obligations: notes she reviewed whether this is a notifiable matter for the kind of information involved, and her conclusion, with the date she checked.
6. Follow-ups: confirm deletion from recipient (done same day); enable send-delay in mail client (done).
7. Learning: turned on a 10-second send-delay; small ADR recording the change.

> This is an internal record-keeping aid, not legal advice and not a compliance determination.
> Whether an event must be reported, and to whom, depends on your circumstances — get advice if unsure.
