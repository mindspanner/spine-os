# Governance starter

The point of Spine OS is that the system is **legible** — anyone (including a future you, or an
assistant) can read how decisions get made and how work gets done. Two artefacts carry that:

## ADR — Architecture / Any Decision Record

Use an ADR whenever you make a non-trivial, hard-to-reverse choice. Copy
`vault/20-GOVERNANCE/ADR-template.md`, number it, and fill it in. Never edit a decided ADR — supersede
it with a new one. The value is the trail, not the tidiness.

## SOP — Standard Operating Procedure

Use an SOP for anything you do more than twice. Copy `vault/20-GOVERNANCE/SOP-template.md`. Keep them
short enough that you'll actually follow them. An SOP an assistant can read is an SOP an assistant can
run for you.

## Suggested starting set

- SOP: intake → file a new client
- SOP: weekly review (clear the Inbox, update Project statuses)
- ADR: where client data is allowed to live (local-only vs. specific tools)
- ADR: which LLM(s) you permit, and on what data

> Reminder: this starter does not constitute legal, clinical, or compliance advice. If you handle
> client, patient, or otherwise sensitive information, align these documents with the privacy and
> professional-standards obligations that apply to you.
