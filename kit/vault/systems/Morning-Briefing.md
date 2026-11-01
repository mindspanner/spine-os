# System — Morning Briefing

> A runnable playbook. Follow it yourself in five minutes, or hand it to your AI assistant and let it
> produce the briefing for you from your vault. Pairs with `20-GOVERNANCE/SOP-llm-assistant-use.md`.

**What it does:** turns "I open the laptop and stare at chaos" into a one-screen picture of the day — what's due, what's overdue, the single most important thing, and anything that needs a decision.

**When to run:** first thing each working day, before email.

**Time:** 5 minutes solo, ~1 minute if your assistant drafts it.

---

## Run it yourself (manual)

1. **Open three lanes.** `10-PROJECTS/`, `30-CLIENTS/`, and your calendar.
2. **Today's commitments.** Note anything on the calendar (meetings, deadlines, deliverables due today).
3. **Overdue / at risk.** Scan project and client files for next actions that should already be done, and any invoice past terms.
4. **Pick the One Thing.** The single task that, done today, makes today a win. Write it first.
5. **Spot decisions.** Anything stuck waiting on a *choice* you've been avoiding? Name it.
6. **Write the briefing.** Six lines, into `00-INBOX/briefing-<date>.md` or wherever you'll see it.

## Run it with your assistant (BYO-LLM)

Point your assistant at the vault and give it a prompt like:

> "Read `10-PROJECTS/` and `30-CLIENTS/`. Produce a Morning Briefing for today (<date>) with these
> sections: **Due today**, **Overdue / at risk**, **The One Thing**, **Decisions needed**. Keep it to
> one screen. Use only what's in the files — flag anything you're unsure about. Do not invent dates or
> figures."

Then **review it** (the human gate) before you act on it. The assistant drafts; you decide.

## Checklist

- [ ] Looked at projects, clients, and calendar
- [ ] Listed what's due today
- [ ] Caught anything overdue or at risk (including money)
- [ ] Named exactly one "One Thing"
- [ ] Surfaced any decision you've been dodging
- [ ] Wrote it down somewhere you'll actually see it

## Sample filled example

```
# Morning Briefing — 2026-03-17

Due today
- 11:00 call with Riverside Cafe (monthly review)
- Send Q1 report to Acme (drafted, needs my read-through)

Overdue / at risk
- Invoice #214 (Bakery) — 12 days past terms → chase today
- "Website copy" project next action unchanged for 9 days

The One Thing
- Finish and send the Acme Q1 report. Everything else can wait.

Decisions needed
- Bakery wants weekend turnaround. Hold the line on weekday-only, or
  add a rush fee? → decide before replying (candidate ADR).
```

> The whole point: you start the day pointed at the right thing, not at your inbox.
