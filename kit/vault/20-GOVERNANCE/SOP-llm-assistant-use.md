# SOP — Using an AI assistant safely (BYO-LLM, under your rules)

- **When to run this:** every time you point an AI assistant at your vault, and once up-front when you first wire one in.
- **Owner:** you
- **Last reviewed:** YYYY-MM-DD

## Purpose

Spine OS is BYO-LLM by design: you choose the model, you hold the key, and the data it sees is governed by *your* terms, not a vendor's. This SOP is the day-to-day discipline that keeps an assistant useful without letting it leak, invent, or overwrite. It pairs with your AI-governance ADR (the *decision*); this is the *procedure*.

## Inputs

- Your own model account and key (kept in your local config, never committed or shared).
- The specific task and the minimum vault files it needs.

## Outputs

- Work drafted with an assistant, reviewed by you, filed on disk.
- No client-identifying data exposed beyond what you deliberately chose to share.

## Steps

1. **Use your own key.** The assistant runs on your account, which you can revoke at any time. Keep the key in `_config` (or your tool's settings), out of version control and out of screenshots.
2. **Default to least data.** Don't hand the assistant your whole `30-CLIENTS/` folder. Give it only the files the task needs. Client-identifying records are opt-in, per task — not a standing grant.
3. **De-identify when you can.** If the assistant only needs the shape of a problem, not the person, strip names and identifiers first.
4. **Treat output as a draft, always.** Everything an assistant produces goes through the document SOP: ground the facts, human-review every word, then file. Never send straight from the chat.
5. **Watch for confident errors.** Numbers, names, dates, quotes and legal/clinical-sounding claims are where models err most. Check each against your vault.
6. **Keep decisions human.** The assistant can propose; you decide. ADRs are written by you, not the model.
7. **Removing means moving.** Your assistant archives or trashes; it never deletes for good without the three steps in [`SOP-removing-files.md`](SOP-removing-files.md), even with full access.
8. **Know what your tool logs.** Understand whether your chosen model provider retains or trains on your inputs, and choose settings/tiers consistent with the sensitivity of your data.

## Done when

Every assistant session used your key, exposed only the minimum data you chose, produced drafts you personally reviewed before anything left the business, and left the decisions in your hands.

## Worked example

A bookkeeper wants help drafting a client-friendly explanation of a BAS variance.

1. Uses her own key in her assistant.
2. Shares only the figures and the question — not the client's name or file.
3. Output uses placeholder "[client]"; she fills the name herself afterwards.
4. Reviews the explanation, corrects one figure the model transposed.
5. Files it to the client folder, sends from there.
6. The "should we change our BAS process" question she answers herself, in an ADR — not the assistant.

> An assistant is a tool you govern, not a colleague you trust blindly. You remain responsible for
> everything it helps produce. This is operating guidance, not legal or professional advice.
