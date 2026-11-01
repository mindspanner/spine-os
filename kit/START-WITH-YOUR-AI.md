# Start with your AI — connect it to your Spine OS

Your Spine OS folder is `__VAULT_PATH__`. Everything below is copy-paste ready and already has your real
path in it. You bring your own assistant (Claude or GPT) — your files stay local; only the optional,
de-identified install-status signal leaves the device when you explicitly opt in. Your model and your
data remain governed by your terms. Governance lives in `CLAUDE.md`; these prompts make your AI *use* it.

---

## 1 · Point your AI at it (pick one)

**Claude Code (recommended — it auto-reads `CLAUDE.md` and boots governed):**
```
cd "__VAULT_PATH__"
claude
```

**Claude Desktop (Mac or Windows):** start a **Cowork** task and choose the folder `__VAULT_PATH__`
(or turn on Settings → Extensions → Filesystem and allow that folder), then paste the **Boot** prompt
below. When Claude asks "Allow …?" to read or edit files, click **Allow** for this folder only.
Optional: the AI shortcuts in `.claude/skills/` can be added in Settings → Capabilities → Skills.

**ChatGPT:** create a Project, upload the key files (`CLAUDE.md`, `MEMORY.md`, `status-board.json`, and
the folder you're working in), then paste the **Boot** prompt. Re-upload changed files as you go.

> Tip: run your AI from *inside* `__VAULT_PATH__` so it always has the whole vault in reach.

---

## 2 · Move an existing ChatGPT project into Spine OS

Use this when you already have useful work in ChatGPT and want the durable copy in your own vault:

```
We are migrating this project into my local Spine OS at __VAULT_PATH__.
Do not copy chat history wholesale. First list the durable assets worth keeping: decisions,
requirements, final outputs, open actions, sources, and unresolved contradictions. Remove secrets
and personal/client identifiers. Propose an exact destination for each item under vault/10-PROJECTS
or vault/20-GOVERNANCE. Wait for my approval before writing or replacing anything. Merge into
existing files; never overwrite another model's work. Finish with a UTC-stamped handover in
vault/00-INBOX/AI-HANDOVER/ and regenerate the dashboard feed if status-board.json changed.
```

---

## 3 · Permission-first self-wiring

Paste this into any assistant that can read and write local files:

```
Read __VAULT_PATH__/CLAUDE.md and AGENTS.md first. Inspect this machine and this vault read-only.
Tell me exactly which local files or settings you propose to create or change to connect yourself,
why each is needed, what data could leave the machine, and how to undo it. Touch nothing outside
__VAULT_PATH__. Do not request or store a credential until I approve the plan. After I approve,
apply only that plan, verify the connection with a harmless read-only check, write a UTC-stamped
handover under vault/00-INBOX/AI-HANDOVER/, and show me the verification result.
```

---

## 4 · Boot (paste first, every session)

```
Read __VAULT_PATH__/CLAUDE.md and follow it as our house rules. Then read MEMORY.md,
status-board.json, and the newest files in vault/00-INBOX/. Give me a 2-line TLDR: what's
live, and what needs me next. Don't read the whole vault — drill in only when a task needs it.
```

---

## 5 · The starter prompts (one per capability)

### 🔎 System discovery / folder walkthrough
```
Walk my Spine OS at __VAULT_PATH__. Map the folder structure and tell me, plainly: what's here,
what each area is for, what looks thin or missing, and the 3 things worth doing first. Don't
change anything yet — just the map and the shortlist. Then seed the "Active" section of MEMORY.md.
```

### 🧠 Research (STORM-style, multi-perspective)
```
Research this for me: <TOPIC>. Do it as a panel of 3–4 different expert perspectives, note where
they disagree, and ground every claim. Then: (a) save a clean notes file to
__VAULT_PATH__/vault/10-PROJECTS/ and (b) produce ONE self-contained, offline HTML write-up
(light/dark, my brand from __VAULT_PATH__/_config/brand.local) I can double-click to read.
No client PII in the research.
```

### 🏛️ ADR (write a decision down properly)
```
Turn this decision into an ADR using __VAULT_PATH__/vault/20-GOVERNANCE/ADR-template.md:
<THE DECISION + why>. Save it in __VAULT_PATH__/vault/20-GOVERNANCE/decisions/ with the next
number, and append a one-line summary to decisions.jsonl.
```

### 📥 Ingest (process an INBOX drop)
```
Process everything in __VAULT_PATH__/vault/00-INBOX/. For each item: read it, tell me in one line
what it is, file it into the right folder (10-PROJECTS / 30-CLIENTS / 20-GOVERNANCE), and log what
moved where. Ask me only if something's genuinely ambiguous. De-identify client details before any
external step.
```

### 🎨 HTML generation (branded, offline output)
```
Make a single-file, offline HTML <report | one-pager | simple deck> from <SOURCE / folder>. Use my
brand (name, colour, logo) from __VAULT_PATH__/_config/brand.local. Light/dark, mobile + desktop,
no external links or fonts. Save it in __VAULT_PATH__/vault/10-PROJECTS/ so I can double-click it.
```

### 🔌 Connectors (wire your tech stack — read-only, human-in-loop)
```
I want to connect <Gmail | Google Calendar | Xero | my practice software>. Set it up READ-ONLY
first, walk me through any keys I paste locally (never into a webpage), and keep it human-in-the-
loop: draft, don't send; propose, don't change. Write a short SOP for it in
__VAULT_PATH__/vault/20-GOVERNANCE/ so it's repeatable.
```

### 📅 Weekly review / morning briefing (run the routines)
```
Run the routine in __VAULT_PATH__/vault/systems/Weekly-Review.md (or Morning-Briefing.md). Pull from
my projects, inbox and clients, give me the briefing, then update __VAULT_PATH__/status-board.json so
the dashboard reflects reality.
```

---

## 6 · Getting the most out of it

- **Let it drive.** These prompts tell your AI to *do the work and show the result*, not ask you to
  spell out every step. Steer with a sentence; it fills in the rest per `CLAUDE.md`.
- **Keep the board current.** After anything big, update `status-board.json`, then run
  `node "__VAULT_PATH__/refresh-status-board.mjs"` so the offline dashboard feed matches.
- **Trust the gates.** It drafts freely but asks before sending, paying, deleting, or exposing client
  data (`CLAUDE.md` §5). That's the safety rail, not friction.
- **Nothing is deleted for good.** Removing a file moves it to `vault/90-ARCHIVE/` or the Trash. A permanent
  delete needs three steps: it lists what and why, moves the items first, then you type "permanently delete"
  and every name (`vault/20-GOVERNANCE/SOP-removing-files.md`).
- **Everything stays yours.** Plain markdown on your disk. Cancel any model any time; the vault — and
  everything your AI built in it — is still fully yours.

*Not legal, clinical, or financial advice. Adapt the governance in `CLAUDE.md` to your own obligations.*
