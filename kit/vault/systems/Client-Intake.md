# System — Client Intake

> A runnable playbook that operationalises `20-GOVERNANCE/SOP-client-intake.md`. The SOP is the policy;
> this is the click-by-click you actually run the moment a new client says yes.

**What it does:** turns a brand-new "yes" from scattered emails and a phone call into one tidy, findable
client home on your disk — with a project opened if needed and the next action set — in about ten minutes.

**When to run:** the moment a client accepts, signs, or pays a deposit. Before any billable work.

**Time:** ~10 minutes.

---

## Run it yourself (manual)

1. **Copy the client template.** Duplicate `30-CLIENTS/_TEMPLATE.md` → `30-CLIENTS/<Client-Name>.md`.
2. **Fill the header.** `Since` = today; `Status: active`; `Primary contact` = name + the channel you'll actually use.
3. **Write the first matter.** One line under Matters: `<what you're doing> — active — <next action>`.
4. **File the agreement.** Save the signed quote / acceptance email / contract *into the client folder* — not your downloads.
5. **Decide data handling once.** Note where this client's info may live. Anything beyond "local only" → write an ADR.
6. **Open a project if it has an end.** Copy `10-PROJECTS/_TEMPLATE.md`; link it from the client note. (Ongoing retainers can stay as a matter.)
7. **Set the very next action.** One physical step. If you can't name it, the engagement isn't really open.
8. **Sweep up.** Anything you can't file in two minutes → `00-INBOX/` for the weekly review.

## Run it with your assistant (BYO-LLM)

Share only what's needed (not your whole client folder — see `SOP-llm-assistant-use`):

> "Here is the accepted proposal for a new client [paste / attach]. Draft a client note using the fields
> in `30-CLIENTS/_TEMPLATE.md`: Since, Status, Primary contact, first Matter line, and a single concrete
> next action. Use only the facts in the proposal; mark anything missing as [TODO]."

Review, fill the [TODO]s, save it yourself. The assistant drafts; you own the file.

## Checklist

- [ ] Client note created from template, named after who you invoice
- [ ] Header complete (since / status / primary contact + channel)
- [ ] First matter written as one line with a next action
- [ ] Signed agreement filed in the client folder
- [ ] Data-handling decided (ADR written if non-local)
- [ ] Project opened if the work has an end; linked from the note
- [ ] Exactly one next action set
- [ ] Stray emails/files sent to `00-INBOX/`

## Sample filled example

`30-CLIENTS/Riverside-Cafe.md`:

```
# Client — Riverside Cafe

- Since: 2026-03-02
- Status: active
- Primary contact: Sam Nguyen · email

## Matters
- Monthly BAS + bookkeeping — active — request March receipts

## Notes
- Engagement: signed proposal 2026-03-01 (filed in this folder).
- Data handling: local vault + my accounting software only. No files
  emailed to third parties. (Routine — no ADR needed.)
- Deposit cleared 2026-03-02; work may start.
```

Next action set: **request March receipts.** Done.

> One client, one home, one next action. That's the whole discipline.
