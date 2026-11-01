# ADR-0003 — Standard pricing model and payment terms

- **Status:** accepted
- **Date:** 2026-03-08
- **Decided by:** you

## Context

Quoting differently for every job is slow, invites discounting-by-guilt, and makes cash flow lumpy and
unpredictable. Late payment is the single biggest cash-flow killer for a solo operator. I want a default
pricing model and a default set of payment terms so that most jobs need no fresh decision — and so the
terms protect cash flow rather than hoping clients pay on time. (Prices and terms here are *placeholders*;
set your own.)

## Options

- **A — Hourly billing:** Pros: feels fair, easy to start. Cons: penalises efficiency, caps income, clients fear open-ended bills, hard to forecast.
- **B — Fixed-price by package/scope:** Pros: predictable for client and me, rewards efficiency, easy to quote from a menu. Cons: needs clear scope; scope creep must be managed.
- **C — Pure retainer:** Pros: smoothest cash flow. Cons: not every client suits it; commitment can deter new clients.

## Decision

**Option B as the default, with C offered to ongoing clients.** Most work is quoted as a **fixed price
against a written scope**, from a small menu of standard packages, so I rarely quote from scratch.
Ongoing relationships are offered a **monthly retainer**. Payment terms default to:

- **Deposit:** [X]% (or a set fee) due before work starts.
- **Terms:** the balance due within [N] days of invoice (e.g. 7 or 14), stated on every invoice.
- **Out-of-scope work:** quoted separately as a written variation before it's done — never absorbed silently.

I am explicitly **not** defaulting to hourly billing, and **not** starting substantive work before the
deposit clears.

## Consequences

- I maintain a short price menu and a scope template; quoting becomes fast and consistent.
- Cash flow steadies (deposit up front, clear terms, retainers smoothing the rest).
- `SOP-monthly-finance-close` enforces chasing anything past terms.
- Scope discipline matters more — every job needs a written scope so "fixed price" is honest.
- Revisit annually, or sooner if a class of jobs keeps blowing scope.

> Numbers in square brackets are placeholders. Set rates and terms appropriate to your market, costs and
> obligations. This is a business decision template, not pricing, financial or legal advice.
