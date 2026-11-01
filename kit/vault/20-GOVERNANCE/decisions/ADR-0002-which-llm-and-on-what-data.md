# ADR-0002 — Which AI assistant I permit, and on what data

- **Status:** accepted
- **Date:** 2026-03-01
- **Decided by:** you

## Context

An AI assistant makes a solo operator dramatically faster at drafting, summarising and organising. It is
also fallible: it invents facts, transposes numbers, and — if given the run of the place — can overwrite
good work or expose information it shouldn't. Before leaning on one, I need to decide *which* model I
permit, *what data* it may touch, and *what stays human*. Doing nothing means the question gets answered
by accident, badly.

## Options

- **A — No assistant:** Pros: nothing to govern. Cons: leave a large productivity gain on the table.
- **B — Full autopilot:** give an assistant broad access and let it act. Pros: fastest. Cons: errors ship unreviewed; client data over-exposed; decisions drift to the model.
- **C — Governed assistant, human-in-the-loop:** BYO key, least-data access, every output reviewed by me before it leaves the business. Pros: keeps the speed, contains the risk. Cons: slightly slower than autopilot.

## Decision

**Option C.** I will use an AI assistant under these rules:

1. **My key.** The assistant runs on my own model account, which I can revoke at any time. The key lives in local config, never in version control.
2. **Least data by default.** The assistant does **not** get standing access to client-identifying records (`30-CLIENTS/`). I opt in per task, sharing only the files that task needs, de-identified where possible.
3. **Human gate.** Anything the assistant drafts is reviewed by me, word for word, before it represents the business — per `SOP-document-generation`.
4. **Decisions stay mine.** ADRs are written by me, not the assistant.

I am explicitly **not** running full autopilot, and **not** granting blanket access to client files.

## Consequences

- Day-to-day work follows `SOP-llm-assistant-use` and `SOP-document-generation`.
- Slightly slower than unrestricted use; materially safer and auditable.
- If my chosen provider changes its data-retention or training terms, that's a trigger to revisit this ADR.
- Revisit once the workflow is trusted, to consider widening (carefully) what the assistant may do.
