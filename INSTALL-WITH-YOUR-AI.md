# INSTALL-WITH-YOUR-AI — the guided install your AI follows

> **You are an AI assistant reading this for a person.** Take them through the steps below, one at a
> time. Rules for the whole session:
> 1. **Plain English.** Short sentences. No jargon. Say exactly what to click. One question per message.
> 2. **Ask, then wait.** Every question has a suggested answer — offer it ("press Enter / say yes to keep it").
> 3. **Nothing is written until the person approves the plan in Step 5.**
> 4. **No network.** Send nothing anywhere, except the optional install signal in Step 6, and only on a clear yes.
> 5. **No personal or client details in kit files.** The vault holds those later, under its own rules.
> 6. **Never overwrite.** If a folder already holds their work, files land beside theirs as `*.new-v<version>`.
> 7. **Warn before every pop-up** (see "Heads-up list" below), and tell them what to click.

Read `MANIFEST.json` first: `elements` (the core) and `modules` (the optional extras, each with the
exact question to ask in `ask`).

---

## Step 1 · Where it lives
Ask: "Where should your SPINE-OS folder live? I suggest a folder called **SpineOS** in your user folder."
- Mac default: `~/SpineOS` · Windows default: `%USERPROFILE%\SpineOS`.
- Offer a name that fits their work (for example "Practice Hub", "Casework Vault", "Clinic Records Desk").
- If they pick iCloud, OneDrive, Google Drive or Dropbox: fine, but say "edit on one computer at a time,
  or the sync app makes 'conflicted copy' files". Do not block.

## Step 2 · Their work (one question)
Ask: "Which is closest to your work: psychologist or counsellor · GP or allied health · social worker or
case manager · lawyer · accountant · coach or consultant · small business · not sure?"
Map to the engine key: `psychology · health · social-work · legal · accounting · coaching · sme · general`.
It only sets the starting record-keeping rules (to confirm for their state and profession — not legal advice).

## Step 3 · Optional extras (the five questions)
Ask each `modules[].ask` question from `MANIFEST.json`, in order, one per message, with its suggestion:
documents (yes) · client or case files (no, unless Step 2 was clinical or social work → suggest yes) ·
reminders (yes) · email help (no) · AI shortcuts (yes). Record the yes answers as a list.

## Step 3b · Removing files (one question, asked once)
Ask `removals.ask` from `MANIFEST.json`: "When you or your AI remove a file, where should it go?
1 An Archive folder inside your vault (suggested) · 2 Your computer's Trash / Recycle Bin · 3 Ask me each time."
Add: "Whatever you pick, nothing is ever deleted for good unless you type 'permanently delete' and its name."
Never offer permanent delete as a choice. Record `archive`, `trash` or `ask` (Enter / "ok" = `archive`).

## Step 4 · Name on the dashboard (optional)
Ask: "What name should appear on your dashboard? For example your practice name. You can skip this."

## Step 5 · Show the plan, then wait
In under 10 lines: the folder path, what goes in (core + the extras they said yes to), what does not,
"nothing leaves your computer", and ONE line on removals: "Removed files go to <the Archive / the Trash /
you ask me each time>; nothing is deleted for good unless you type 'permanently delete' and the names. In
Claude Code a guard blocks delete commands that break this rule." Ask: "Shall I set it up?" Only continue on a clear yes.

Apply with ONE of these (all three give the same result):
- **Mac or Linux (Terminal):**
  `SPINEOS_MODULES="documents,reminders,skills" SPINEOS_REMOVALS="archive" SPINEOS_BRAND_NAME="<name>" bash kit/install.sh` and type the folder when asked.
- **Windows (PowerShell):**
  `$env:SPINEOS_MODULES="documents,reminders,skills"; $env:SPINEOS_REMOVALS="archive"; $env:SPINEOS_BRAND_NAME="<name>"; powershell -ExecutionPolicy Bypass -File kit\install.ps1`
- **Any computer with Node 18+:** write `brief.json` →
  `{ "root": "<folder>", "form": { "brand": "<name>", "persona": "<key>", "modules": [ ... ], "removals": "archive" } }`
  then `node kit/wizard/provision.mjs --config brief.json --apply --yes` (adds the engine's ledger and receipt).
- **No terminal at all (Claude Desktop, ChatGPT):** create the folders and copy the files yourself, following the
  plan; fill `__VAULT_PATH__`, `__BRAND__` and `__REMOVALS__` (the removals sentence) in `CLAUDE.md`, `MEMORY.md`, `START-WITH-YOUR-AI.md`, `SETUP-GUIDE.md`.

## Step 6 · Check it worked, then hand over
1. Check: `CLAUDE.md` exists and has no `__VAULT_PATH__` left · `vault/` has `00-INBOX` to `30-CLIENTS` ·
   each chosen extra is there · `dashboard.html` opens in a browser.
   With Node: `node kit/wizard/kit-install-test.mjs` and `node kit/wizard/modules-test.mjs`.
2. Optional, ask ONCE: "May I send Mindspan a one-line 'install finished' note — version and computer
   type only, no name, no files?" Silence or no = no.
3. Show them three first moves: open the folder beside this chat · drop one real item into `vault/00-INBOX` ·
   say "sort my inbox".
4. Write a receipt in `vault/00-INBOX/AI-HANDOVER/` (UTC time, choices, what was installed, check result).

Deeper setup comes later, one topic at a time, when they ask: the security baseline
(`vault/20-GOVERNANCE/SECURITY-BASELINE.md`), backups, email or calendar connections (read-only first).

---

Whatever the path: `_config/removals.local` holds the choice, and `.claude/settings.json` + `.claude/hooks/`
(the delete guard) are copied as they are. Never edit or leave out the guard.

## Heads-up list (say this BEFORE the pop-up appears)

| When | What they will see | What to click |
|---|---|---|
| Mac: first double-click on `install.command` | "cannot be opened because it is from an unidentified developer" | Click **Done**, then System Settings → Privacy & Security → scroll down → **Open Anyway** → **Open** |
| Mac: Terminal or your AI asks for Documents/Desktop access | "would like to access files in your Documents folder" | **Allow** (needed to write the folder) |
| Windows: double-click `Install-on-Windows.cmd` | Blue "Windows protected your PC" | **More info** → **Run anyway** |
| Windows: file from the internet | "Do you want to run this file?" | **Run** / **Open** |
| Claude Desktop: Claude wants to create or edit files | "Allow Claude to …" / "Allow once / Always allow" | **Allow** (or **Allow once**). It may ask again later; that is normal |
| Claude Desktop: Claude wants to delete a file | "Allow Claude to delete …?" | **Deny**, unless the person just typed "permanently delete" and that name |
| Any: password or admin prompt | A box asking for the computer password | **Cancel** — SPINE-OS never needs admin rights. Tell the person something is wrong. |

## Removing files (for the whole life of the vault)
`CLAUDE.md` §9 and `vault/20-GOVERNANCE/SOP-removing-files.md`: removing = moving to the Archive or the Trash.
A permanent delete needs three steps in order — list exactly what and why · move the items first · the person
types "permanently delete" and every name. Never wildcards, bulk or parsed lists; holds even with full access.

## Update later (keeping current)
Run the same installer on the same folder. It notices the existing vault, never overwrites, puts changed
kit files beside theirs, and asks the five extras questions again (it keeps your removals choice). Then follow
`vault/20-GOVERNANCE/SOP-keeping-current.md` (or say "check for updates").
