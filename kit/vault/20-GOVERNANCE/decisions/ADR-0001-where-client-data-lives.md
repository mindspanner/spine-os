# ADR-0001 — Where client data is allowed to live

- **Status:** accepted
- **Date:** 2026-03-01
- **Decided by:** you

## Context

A small business's data is scattered by default — email, a notes app, a CRM trial, a couple of cloud
drives, the laptop. Every tool that holds the *master* copy is a tool that can lock you out, raise its
price, change its terms, suffer an outage, or quietly close. We also handle some personal information
about clients, which carries privacy obligations that get harder to meet the more places that data
lives. A decision is needed before the sprawl sets in.

## Options

- **A — Cloud-tool-of-record:** pick one SaaS product as the master. Pros: built-in features, mobile apps. Cons: vendor lock-in, recurring cost, your data governed by their terms, exit is painful.
- **B — Local-first vault as the master:** plain files on a drive you own are the source of truth; any cloud tool holds only a *copy*. Pros: you own it, plain text never expires, trivial to migrate, easy to keep tight. Cons: you own the backups; less turnkey than a SaaS.
- **C — Everything everywhere:** no single master; whatever's most recent wins. Pros: no decision needed. Cons: this is the problem, not a solution.

## Decision

**Option B.** This vault — plain markdown files on a drive I own — is the single source of truth for the
business. Cloud and SaaS tools are permitted as *copies or conveniences* (sync, sharing, mobile access)
but never hold the master record. I am explicitly **not** adopting a cloud tool as the system of record,
and **not** allowing client-identifying files to be scattered across multiple tools without a deliberate
reason recorded here.

## Consequences

- I own backups — see `SOP-data-backup-3-2-1`. This is now a standing responsibility.
- Migrating to any future tool is trivial, because everything is plain text I can read in any editor.
- New tools get evaluated as "copy or convenience", never as "the new master", unless a future ADR supersedes this.
- Revisit if the business grows past a solo/very-small team, or if a regulatory obligation requires a specific system.
