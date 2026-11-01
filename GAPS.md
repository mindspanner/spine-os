# Gaps found in the v1.8 upgrade — every item fixed or listed

Audit of v1.7.0 (2 Nov 2026) against: keep current · optional extras asked in plain English ·
security, governance, one home per fact, SOPs · Windows parity · engineering. Judges:
`node scripts/verify-all.mjs` and `bash scripts/judge-fresh-install.sh` (26 checks, Mac + PowerShell).

| # | Gap | Status |
|---|---|---|
| 1 | `node provision.mjs` silently did nothing from a folder with spaces (Google Drive "My Drive"), on Windows, or via macOS `/var` links (`file://${argv[1]}` entry check) | **Fixed** — `pathToFileURL(realpath)`; tested from a spaced path |
| 2 | `install.command` (Mac double-click) was a stale copy: overwrote files, no update mode, left `__VAULT_PATH__` unfilled | **Fixed** — now a 6-line wrapper that runs `install.sh` |
| 3 | Fresh install into a non-empty folder overwrote same-named files | **Fixed** — beside-copy in every mode |
| 4 | No Windows installer for the plain-file path | **Fixed** — `install.ps1` + `Install-on-Windows.cmd`, run under real PowerShell 7 in the judge |
| 5 | No optional extras; installers asked nothing about use | **Fixed** — 5 modules, same plain-English questions in all four installers, add-later on re-run |
| 6 | No workflows/skills shipped | **Fixed** — 8 skills (sort-inbox, find-it, case-note, whats-due, draft-email, weekly-review, privacy-check, keep-current) |
| 7 | No case-management layout for clinical or social work | **Fixed** — casework module, client codes, private code key, case-files SOP |
| 8 | No reminders, no email workflow | **Fixed** — reminders list + `.ics` routine; draft-only email routine + templates |
| 9 | No naming/filing convention | **Fixed** — `SOP-naming-and-filing.md` |
| 10 | No security baseline; `.spineosignore` only on strict | **Fixed** — `SECURITY-BASELINE.md` (Mac + Windows steps); `.spineosignore` in every install |
| 11 | No "keeping current" path, no CHANGELOG, version shown in 4 places by hand | **Fixed** — `SOP-keeping-current.md`, `keep-current` skill, `CHANGELOG.md`, version-sync check |
| 12 | Engine created a second project tree (`00_COMMAND/`, `10_PROJECTS/`) beside `vault/`, against its own AGENTS.md | **Fixed** — removed |
| 13 | MANIFEST personas (`generic`) did not match engine keys (`general`); no social-work persona | **Fixed** — keys aligned, `social-work` added (strict, local-first AI) |
| 14 | `pressure-test-v2.mjs` crashed without the release MP4s | **Fixed** — those checks SKIP, never false-PASS |
| 15 | Re-runs left `*.new-v*` noise, reset the brand, replaced the live status board | **Fixed** |
| 16 | Windows: `~\` not expanded; drive roots / Users / Windows / Program Files not refused | **Fixed** |
| 17 | No `.gitignore`/`.gitattributes` (test reports and CRLF risks), no SECURITY.md | **Fixed** |
| 18 | No single check command, no outside judge | **Fixed** — `verify-all.mjs`, `judge-fresh-install.sh`, `windows-static-check.mjs` |
| 19 | No path for people with no technical background | **Fixed** — `PASTE-SETUP.md`, tested with simulated Mac and Windows users |
| 20 | Legal files (EULA, privacy) are drafts pending solicitor review | **Listed** — operator/solicitor; unchanged |
| 21 | macOS app is ad-hoc signed, not notarised; Windows app delivery closed until real-Windows proof | **Listed** — needs Apple Developer ID + a Windows machine run (`Install-on-Windows.cmd` on Windows 11) |
| 22 | `install.ps1` proven on PowerShell 7 (Linux) + static 5.1 rules, not yet on a real Windows PC | **Listed** — first real Windows run closes it |
| 23 | Hosted CI not added (DR-0067/0078 spend rules: no hosted runners) | **Listed** — run `verify-all` + judge locally before every PR |
| 24 | `.spineosignore` is followed by instruction, not enforced by software | **Listed** — stated plainly in SECURITY.md |
| 25 | Public site spine-os.mindspan.com.au not yet at parity | **Listed** — next pass, per operator |
| 26 | The shipped kit zip is built from MindspanEcoSystem `scripts/spineos/kit-src` (still 1.7.0, `KIT_VERSION` in `lib/spineos/kit-version.ts`), so this repo is now ahead of what buyers download. `kit-src` still carries gap 1 (entry point) and gap 2 (stale `install.command`, byte-identical to the old copy) | **Fixing (v1.9)** — back-ported to `kit-src` in the MindspanEcoSystem v1.9 PR, zip rebuilt |
| 27 | No agreed rule for removing files: an AI with full or bypass access could delete for good, in bulk, from a parsed list | **Fixed (v1.9)** — one install question (Archive · Trash · ask), the three-step rule in `CLAUDE.md` §9 / `AGENTS.md` / `SOP-removing-files.md`, the Claude Code delete guard on by default |
| 28 | The delete guard covers Claude Code only (and needs Node.js for the smart check; without it every delete is stopped). Claude Desktop Cowork / Filesystem, ChatGPT and others follow the rules by instruction, plus Claude Desktop's own "Allow …?" prompt | **Listed** — stated in the SOP; the paste adds `.claude/settings.json` deny rules where it can write them |
| 29 | The guard reads commands, not intentions: a delete hidden in an unusual tool (not rm/del/Remove-Item/git clean/find -delete/rsync --delete/scripts) can slip past | **Listed** — defence in depth; the rule itself is in the house rules every AI reads |
| 30 | Updates reached nobody: each install was a one-off copy | **Fixed (v1.9)** — `INSTALL-FOR-AI.md` + `release.json` at a release tag in the public mirror `mindspanner/spine-os`; "check for updates" archives old rule files first and never touches the person's files |
| 31 | The guard had 10+ known bypasses and could be switched off by the AI editing its own settings | **Fixed as far as feasible** — 280 cases incl. eval, dynamic commands, pipes to shells, scripts, interpreters, overwrites, git resets, PowerShell aliases, wrapper/git options; a Write/Edit matcher + deny rules protect `.claude/**` and `_config/removals.local`. Still a safety net plus rules, not a guarantee (obfuscated code, unknown tools) |
| 32 | Release commits are not signed with a key agents cannot use (hardware key / Touch ID) | **Listed** — operator: add a signing key and require signed commits on `main` and tags; until then the tag + SHA-256 is the check |
| 33 | Codex has no hook: safety there is the approval prompts + sandbox (`kit/.codex/config.toml`) + `AGENTS.md` rules | **Listed** — stated plainly in `INSTALL-FOR-AI.md` and the SOP |
