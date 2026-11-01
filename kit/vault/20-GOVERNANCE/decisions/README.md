# Decisions (ADRs)

An **ADR** (Architecture / Any Decision Record) captures a non-trivial, hard-to-reverse choice: the
context, the options you weighed, what you decided, and the consequences. Together they form a trail that
explains *why your business is the way it is* — invaluable for future-you, a stand-in, or an assistant.

## The rules

- **One ADR per decision.** Number sequentially (`ADR-0001`, `ADR-0002`, …). Never reuse a number.
- **Never edit a decided ADR.** If a decision changes, write a *new* ADR and mark the old one
  `superseded by ADR-NNNN`. The history is the point.
- **Log it.** When you accept an ADR, add a one-line entry to [`decisions.jsonl`](decisions.jsonl).

## What's here

- [`ADR-template.md`](ADR-template.md) — copy this to start a new one.
- [`ADR-0001-where-client-data-lives.md`](ADR-0001-where-client-data-lives.md) — local-first; your drive is the source of truth.
- [`ADR-0002-which-llm-and-on-what-data.md`](ADR-0002-which-llm-and-on-what-data.md) — AI assistant under human-in-the-loop rules.
- [`ADR-0003-pricing-and-payment-terms.md`](ADR-0003-pricing-and-payment-terms.md) — default fixed-price quoting + payment terms.
- [`decisions.jsonl`](decisions.jsonl) — the one-line log of accepted decisions.

> ADRs 0001–0003 are **worked examples** with sample dates and placeholder numbers. Adapt or replace them
> with your own real decisions. They are decision-record templates, not legal, financial or professional advice.
