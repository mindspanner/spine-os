# SOP — Document generation (draft → review → approve → file)

- **When to run this:** any time you produce a document that represents the business — a proposal, a letter, an invoice cover note, a report, a published page — whether you or an AI assistant drafts it.
- **Owner:** you
- **Last reviewed:** YYYY-MM-DD

## Purpose

Make every outgoing document pass through one human gate before it leaves the business. AI assistants are fast and useful and *also* confidently wrong sometimes; this SOP keeps their speed while making sure a person — you — has read every word that goes out under your name.

## Inputs

- The request or trigger (a client asks for a proposal; a job is done and needs a report).
- Relevant facts from your vault (client note, project file, prior documents).
- Your assistant, if you use one (and your own BYO-LLM key — see your AI-governance ADR).

## Outputs

- One filed, approved document in the right project or client folder.
- A log line in your audit trail for anything significant (contracts, reports, anything binding).

## Steps

1. **Draft.** You or your assistant write a first draft *into the relevant project/client folder*, with a `-DRAFT` suffix on the filename (e.g. `Proposal-Riverside-DRAFT.md`). Drafting happens on your disk, not in a chat window that disappears.
2. **Ground it.** If an assistant drafted it, check that every fact, name, figure and date came from your vault — not from the model's imagination. Numbers and names are where AI errors bite hardest.
3. **Human review (the gate).** You read every word. This step is non-negotiable and cannot be delegated to the assistant. You are responsible for what goes out under your name.
4. **Approve.** Remove the `-DRAFT` suffix. The file is now the approved version of record.
5. **Log the significant ones.** For contracts, reports, anything binding or anything a regulator might ask about, add a line to your audit trail: date · what · who approved.
6. **Send from the filed copy.** Attach/send/publish from the approved file on disk — never copy-paste from the chat window, which may differ from what you reviewed.

## Done when

The approved document exists on disk with no `-DRAFT` suffix, you have personally read it, the significant ones are logged, and what you sent is byte-for-byte what you approved.

## Worked example

A copywriter uses an assistant to draft a client report:

1. Assistant drafts `Report-Acme-Q1-DRAFT.md` into the Acme project folder.
2. She checks the three campaign figures against the project log — one was wrong (the assistant rounded $4,820 to "about $5k" and then wrote $5,000 as fact). Fixed.
3. Reads the whole thing; tightens two sentences.
4. Renames to `Report-Acme-Q1.md`.
5. Logs: `2026-03-30 · Q1 report to Acme · approved: me`.
6. Emails the PDF exported from that file.

> An AI-assisted document is still *your* document. The human gate is the point of this SOP.
