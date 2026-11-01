# Changelog

Plain-English notes for every SPINE-OS kit version. Newest first. The number here always matches
`kit/VERSION` (checked by `node scripts/verify-all.mjs`).

## 1.9.0 — 2 Nov 2026 · nothing is deleted for good

**New**
- **One new question at install:** "When you or your AI remove a file, where should it go?" —
  1 an Archive folder inside your vault (suggested) · 2 your computer's Trash / Recycle Bin · 3 ask me each
  time. Permanent delete is never offered. The answer lives in `_config/removals.local`.
- **The three-step rule for a permanent delete**, in `CLAUDE.md` §9, `AGENTS.md` and the new
  `vault/20-GOVERNANCE/SOP-removing-files.md`: your AI lists exactly what and why, moves the items to the
  Archive or the Trash first, and deletes only after you type "permanently delete" and every name.
  Never through wildcards, bulk or parsed lists, and never even with full access or bypass permissions.
- **A delete guard, on by default** for Claude Code: `.claude/settings.json` runs
  `.claude/hooks/delete-guard.mjs` before every command. It blocks any delete outside the Archive or Trash,
  any wildcard or list delete, and any delete you have not confirmed in your own words. Moves are never
  blocked. Without Node.js it stops anything that looks like a delete.
- **`vault/90-ARCHIVE/`** in every install, and a one-line note at the end of every installer saying
  what will happen to removed files.
- The keep-current and sort-inbox shortcuts archive instead of deleting.
- The one-paste setup asks the same removals question (Q6) and writes the same rules.
- **One-line install for any desktop AI:** `INSTALL-FOR-AI.md` (Claude Desktop, Claude Code, Codex; ChatGPT
  and web chats are offered Claude Desktop or a zip). The paste is now one short paragraph that points at it,
  pinned to a release tag with its SHA-256. The wizard asks where the folder lives first.
- **"Check for updates":** reads the newest release, says what changed, archives the old rule files, never
  touches your own files, and asks first. `release.json` lists every file with its SHA-256.
- **Codex safety settings** (`.codex/config.toml`): asks before changing anything, writes only in the folder.
- **Delete guard hardened** (280 checks) and protected from being switched off; described honestly as a
  safety net plus rules, not a guarantee.

**Fixed**
- The kit's licence and legal files now match the website kit: EULA and disclaimer v1.2 (ABN
  correction), with v1.1 kept as the record. The installer's licence screen serves v1.2.
- Install signals match the live collector: `install_started`, `step_reached`, `ai_connected`,
  `install_completed`, `install_failed` (opt-in only; anything else is refused and never leaves).

## 1.8.0 — 2 Nov 2026 · keep current, optional extras, Windows

**New**
- **Optional extras, asked in plain English** by every installer (Mac, Windows, AI-guided, app):
  documents · client/case files (clinical or social work) · reminders with calendar files · email
  drafting help · ready-made AI shortcuts. Say no now, add any later by running the installer again.
- **AI shortcuts (skills):** sort-inbox, find-it, case-note, whats-due, draft-email, weekly-review,
  privacy-check, keep-current — in `.claude/skills/`, usable from Claude Code, Claude Desktop and others.
- **Windows installer:** `Install-on-Windows.cmd` (double-click) → `install.ps1`, same questions and
  rules as the Mac installer; works on Windows PowerShell 5.1 and PowerShell 7.
- **Security baseline** (10 things to have on, Mac and Windows steps), **naming and filing SOP**,
  **keeping-current SOP**, and a `.spineosignore` privacy list in every install (was strict-only).
- **Social work persona** with retention defaults; MANIFEST personas now match the engine.
- **One-paste setup** (`PASTE-SETUP.md`) for people with no technical background.
- **Checks:** `scripts/verify-all.mjs` (every test + version + manifest + secrets),
  `scripts/judge-fresh-install.sh` (real fresh installs, Mac + PowerShell), `scripts/windows-static-check.mjs`.

**Fixed**
- `node provision.mjs` silently did nothing when the kit sat in a folder with spaces (for example
  Google Drive's "My Drive"), on Windows, or behind macOS `/var` links. Now it runs.
- The Mac double-click installer (`install.command`) was an old copy: it overwrote existing files and
  left `__VAULT_PATH__` placeholders unfilled. It now runs `install.sh`, so the two cannot drift.
- A fresh install into a non-empty folder could overwrite a same-named file; every mode now puts
  the kit copy beside yours instead.
- Re-running the installer no longer leaves `*.new-v*` copies of files that did not change, keeps
  the brand chosen at first install, and never replaces your live status board.
- The engine no longer creates a second project tree (`00_COMMAND/`, `10_PROJECTS/`) beside `vault/`.
- `pressure-test-v2.mjs` crashed when the release videos were absent; those checks now report SKIP.
- Windows: `~\` paths expand, and drive roots, `Users`, `Windows` and `Program Files` are refused.

## 1.7.0
- Transparency Edition v1: the inspectable kit and the AI-guided install protocol.
