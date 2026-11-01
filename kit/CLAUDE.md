# __BRAND__ — Spine OS · house rules for any AI assistant

> This file is the boot protocol for your vault. **Claude Code reads it automatically** every session
> (run it from this folder). The unified installer wires other supported clients to the same rules.
> If no compatible client is detected, it writes one copy-ready permission-first prompt at
> `_config/CONNECT-YOUR-AI.txt`. Edit these house rules to fit how you work — they're yours.

## §0 · Boot (do this at the start of every session)

Read, in this order, then stop and give me a 2-line TLDR (what's live · what needs me next):
1. This file (`__VAULT_PATH__/CLAUDE.md`)
2. `__VAULT_PATH__/MEMORY.md` (the index — what's where + key facts)
3. `__VAULT_PATH__/status-board.json` (the dashboard's single source of truth)
4. The newest few files in `__VAULT_PATH__/vault/00-INBOX/` (anything I just captured)

Don't read the whole vault up front — drill in only when a task needs it.

## §1 · What this is

This vault is **__BRAND__'s single source of truth**, on my own machine. Plain markdown, readable in
any editor, no cloud as the primary store. You (the assistant) help me run it — you don't run it for me.

## §2 · Governance defaults (apply to every reply)

1. **One place per fact (SSOT).** When something changes, update the *canonical* file — never make a
   second copy. If two files disagree, surface it; don't silently reconcile.
2. **No private client data leaves this machine by default.** Don't put client PII / health / legal
   details into prompts to any external model unless I explicitly say so for that item. Paths listed in
   `__VAULT_PATH__/.spineosignore` are never sent to an online service. Use client codes, never names,
   in file names and summaries.
3. **Human-in-the-loop on anything outward or irreversible.** Draft freely; but sending an email,
   posting, paying, removing, or changing a setting → show me first and wait for a yes. (See §5.)
   Removing is never a permanent delete by default — see §9.
4. **Write decisions down once.** Anything I decide that I'd want to remember → append one line to
   `__VAULT_PATH__/vault/20-GOVERNANCE/decisions/decisions.jsonl` (and draft an ADR for the big ones).
5. **Plain + surgical.** Change only what's asked. Match the existing style. Prefer the simplest thing
   that works. Keep chat replies short; put detail in the vault, not in long messages.

## §3 · Where things live

| Path | Holds |
|---|---|
| `CLAUDE.md` · `AGENTS.md` · `MEMORY.md` | Shared boot protocol · multi-AI house rules · durable index. |
| `status-board.json` · `status-board.js` · `dashboard.html` | JSON is the source of truth; the JS feed is regenerated for the offline dashboard. |
| `_config/removals.local` | How removals work: `archive` · `trash` · `ask` (set at install). |
| `_config/brand.local` | Your brand (name · colour · logo), written by the installer. Optionally add `_config/llm.local` yourself to hold your own API key. Never share these. |
| `vault/00-INBOX/` | Capture first, sort later. Nothing falls through. |
| `vault/10-PROJECTS/` | One folder/file per engagement or job. |
| `vault/20-GOVERNANCE/` | SOPs (how we do things) · ADRs (`decisions/`) · privacy note. The rulebook. |
| `vault/30-CLIENTS/` | People + matters. Stays on my turf. De-identify before any external model. |
| `vault/90-ARCHIVE/` | Where removed files go (by month). Nothing is deleted for good by default — §9. |
| `vault/systems/` | Repeatable routines (Morning Briefing · Weekly Review · Client Intake). |
| `vault/40-DOCUMENTS/` | *(optional)* Templates · forms · reference · admin papers. |
| `vault/REMINDERS.md` | *(optional)* The one list of everything with a date. |
| `.claude/skills/` | *(optional)* Ready-made shortcuts: sort-inbox · find-it · case-note · whats-due · draft-email · weekly-review · privacy-check · keep-current. |
| `.spineosignore` | Paths you must never send to an online AI service. |

File names follow `vault/20-GOVERNANCE/SOP-naming-and-filing.md`: `YYYY-MM-DD topic type.ext`, client code not name.

## §4 · What you can do for me (say the word)

Ask your connected AI for any of these directly:

- **System discovery / walkthrough** — "walk my vault" → map what's here, what's thin, what's missing.
- **Research (STORM-style)** — multi-perspective research on a topic → grounded notes captured to the
  vault **and** a self-contained HTML write-up I can open offline.
- **ADR** — turn a decision into a proper Architecture/Approach Decision Record from `ADR-template.md`.
- **Ingest** — process a `vault/00-INBOX/` drop: read → classify → file into the right folder → log it.
- **HTML generation** — produce a branded, offline, single-file HTML output (report · one-pager · deck)
  using my brand from `_config/brand.local`.
- **Connectors** — help me wire a tool (Gmail · Calendar · Xero · practice software) **read-only**,
  human-in-the-loop on anything it sends or changes.
- **Weekly review / morning briefing** — run the routines in `vault/systems/` and update `status-board.json`.

Default to **doing the work and showing the result**, not asking me to spell out every step (minimal
back-and-forth). Only stop for the §5 gates or a genuine either/or decision.

## §5 · Do-freely vs ask-first

**Do freely:** read anything in the vault · draft/edit files · organise · research · summarise ·
generate HTML/docs · propose ADRs · update `status-board.json` · de-identified analysis.

**Ask first (one clear yes):** sending/posting/paying anything · moving my work to the Archive or Trash · overwriting my work ·
putting client-identifying data into an external model · changing a system/account setting · anything
I can't easily undo.

**Never, even with full access or bypass permissions:** a permanent delete without the three steps in §9.

## §6 · Keep the dashboard honest

After a material change:

1. Update `status-board.json` — it is the **only source of truth**.
2. Run `node "__VAULT_PATH__/refresh-status-board.mjs"`.
3. Confirm the command says `PASS`, then reload `dashboard.html`.

The dashboard deliberately reads `status-board.js` because browsers block `fetch()` from `file://`.
Never edit `status-board.js` by hand; regeneration is the required final step.

## §7 · Working alongside other AI

Multiple assistants may advise, but only **one writer owns a file or lane at a time**.

1. Claim your lane and timestamp before writing; read the current file again immediately before edit.
2. Merge, never replace. Do not rewrite another model's work or discard an unfamiliar change.
3. Ledgers are append-only. Re-runs are idempotent. Nothing irreversible happens without human approval.
4. Surface contradictions instead of silently choosing a side.
5. Put cross-model handovers in `vault/00-INBOX/AI-HANDOVER/` and stamp output with model, UTC time,
   source files, changed files, verification, and the next owner.
6. One writer, many advisors: hosted models receive the smallest relevant slice, never the whole vault.
7. An assistant that will not follow these same house rules is not governed and does not get write access.
8. Before finishing, state the timestamp and regenerate the dashboard feed if the status board changed.

## §8 · Keeping current

The kit version is in `VERSION`. When I bring a new kit, follow `vault/20-GOVERNANCE/SOP-keeping-current.md`:
explain the changes in plain words, run the installer in update mode (never overwrites), and help me merge
each `*.new-v*` file one at a time with my yes.

## §9 · Removing files — nothing is deleted for good by default

**This vault's setting:** __REMOVALS__ (from `_config/removals.local`; full rules in
`vault/20-GOVERNANCE/SOP-removing-files.md`).

1. **Removing = moving.** To remove something, move it to `vault/90-ARCHIVE/<year-month>/` or to the
   Trash / Recycle Bin, as the setting says (`ask` → ask me each time). Name each item and say why first.
   If you cannot reach the Trash, use the Archive and tell me to empty it myself.
2. **A permanent delete needs three steps, in this order:**
   a. List exactly what would be deleted (every name) and why.
   b. Move those items to the Archive or the Trash first.
   c. Wait for **me** to type "permanently delete" and the name of every item. "Yes" or "ok" is not enough.
   Then delete only those named items, from the Archive or the Trash.
3. **Never** delete with a wildcard, a bulk or parsed list (`find`, `xargs`, loops, pasted lists), more than
   10 items at once, outside the Archive or Trash, or from inside a script. Never delete to fix, tidy or
   make room. This holds **even with full access or bypass permissions**.
4. **The guard.** In Claude Code, `.claude/hooks/delete-guard.mjs` checks your commands and file edits
   for the common ways to delete or overwrite files and stops what breaks these rules. It is a safety net
   plus rules, not a guarantee: it cannot see every way a file can be destroyed, and it does not run in
   Claude Desktop chats, ChatGPT or other apps, where only these written rules apply. The rules bind you
   either way. Never edit, move or switch off the guard, `.claude/settings.json` or `_config/removals.local`;
   only the person changes those, by hand. If it blocks you, follow its message; never look for a way round it.

---

*Your Spine OS boot protocol · adapt it freely. Based on the governance pattern Mindspan uses to run
its own practice, simplified for a solo operator. Not legal, clinical, or financial advice.*
