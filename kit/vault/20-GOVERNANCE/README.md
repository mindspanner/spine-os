# Governance — the rules the system runs by

This lane holds the two artefacts that make Spine OS **legible**: anyone (including future-you, or an
assistant) can read how your decisions get made and how your work gets done.

- **SOPs (Standard Operating Procedures)** — *how* to do a recurring task. Use one for anything you do
  more than twice. Short enough to actually follow; short enough for an assistant to run for you.
- **ADRs (Architecture / Any Decision Records)** — *what* you decided, and why, for any non-trivial,
  hard-to-reverse choice. Never edit a decided ADR; supersede it with a new one. The value is the trail.

## What's in here

### SOPs (start with these)

| SOP | Use it when |
|---|---|
| [`SOP-client-intake.md`](SOP-client-intake.md) | A new client says yes |
| [`SOP-weekly-review.md`](SOP-weekly-review.md) | Once a week, to keep the system honest |
| [`SOP-monthly-finance-close.md`](SOP-monthly-finance-close.md) | First days of each month |
| [`SOP-data-backup-3-2-1.md`](SOP-data-backup-3-2-1.md) | Set up once; then weekly + quarterly |
| [`SOP-document-generation.md`](SOP-document-generation.md) | Anything that goes out under your name |
| [`SOP-incident-record.md`](SOP-incident-record.md) | When something goes wrong |
| [`SOP-record-retention-AU.md`](SOP-record-retention-AU.md) | Setting your keep/destroy rules |
| [`SOP-llm-assistant-use.md`](SOP-llm-assistant-use.md) | Every time you use an AI assistant |
| [`SOP-naming-and-filing.md`](SOP-naming-and-filing.md) | Every time you save something |
| [`SOP-keeping-current.md`](SOP-keeping-current.md) | When a new SPINE-OS version comes out |
| [`SOP-removing-files.md`](SOP-removing-files.md) | Before anything is removed or deleted |
| [`SECURITY-BASELINE.md`](SECURITY-BASELINE.md) | Once, on day one: the 10 things to have on |
| [`SOP-template.md`](SOP-template.md) | Writing your own SOP |

### Decisions (ADRs)

In [`decisions/`](decisions/): an [ADR template](decisions/ADR-template.md), three worked example ADRs
(where data lives · which AI assistant · pricing & terms), and a [`decisions.jsonl`](decisions/decisions.jsonl)
one-line log.

### Privacy

[`Australian-Privacy-starter-note.md`](Australian-Privacy-starter-note.md) — plain-English APP awareness
for a small business. General information, **not** legal advice.

## A good starting set (if you do nothing else)

1. Run the **weekly review** SOP from week one.
2. Set up **backups** today.
3. Write your first ADR: where your client data is allowed to live.
4. Fill in your **record-retention** table with real periods.

> Reminder: nothing in this lane is legal, clinical, financial or compliance advice. If you handle
> sensitive information, align these documents with the obligations that apply to you.
