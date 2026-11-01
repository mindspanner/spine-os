#!/usr/bin/env bash
# Outside judge for a release: real fresh installs in throwaway folders, scored by checks the
# installer does not run on itself. macOS/Linux path = install.sh and install.command (piped answers,
# the same keystrokes a person types). Windows path = install.ps1 under real PowerShell when Docker is
# available (mcr.microsoft.com/dotnet/sdk:8.0 ships pwsh 7), plus scripts/windows-static-check.mjs.
# Usage: bash scripts/judge-fresh-install.sh   (exit 0 = every check passed)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
KIT="$REPO/kit"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/spineos judge XXXX")"   # a space in the path on purpose
pass=0; fail=0
ok() { if eval "$2"; then pass=$((pass+1)); printf 'PASS · %s\n' "$1"; else fail=$((fail+1)); printf 'FAIL · %s\n' "$1"; fi; }

run_install() {  # run_install <dest> <answers…>  → runs install.sh with those typed answers
  local dest="$1"; shift
  printf '%s\n' "$dest" "$@" | HOME="$WORK/home" bash "$KIT/install.sh" > "$WORK/last.log" 2>&1
}
mkdir -p "$WORK/home"

# 1 · defaults: Enter on every question (documents, reminders, skills = yes; casework, email = no; removals = Archive)
D1="$WORK/home/Defaults Vault"
run_install "$D1" "" "" "" "" "" ""; rc=$?
cp "$WORK/last.log" "$WORK/first.log"
ok "defaults: installer exits 0" '[ $rc -eq 0 ]'
ok "defaults: marker + charter + dashboard" '[ -f "$D1/.spine-os-root" ] && [ -f "$D1/CLAUDE.md" ] && [ -f "$D1/dashboard.html" ]'
ok "defaults: no placeholders left in the AI instructions" '! grep -q "__VAULT_PATH__\|__BRAND__\|__REMOVALS__" "$D1/CLAUDE.md" "$D1/MEMORY.md" "$D1/START-WITH-YOUR-AI.md"'
ok "defaults: CLAUDE.md points at the real folder" 'grep -qF "$(cd "$D1" && pwd -P)/MEMORY.md" "$D1/CLAUDE.md"'
ok "defaults: documents + reminders + skills installed" '[ -d "$D1/vault/40-DOCUMENTS" ] && [ -f "$D1/vault/REMINDERS.md" ] && [ -f "$D1/.claude/skills/find-it/SKILL.md" ]'
ok "defaults: casework + email NOT installed" '[ ! -d "$D1/vault/30-CLIENTS/_CASE-TEMPLATE" ] && [ ! -f "$D1/vault/systems/Email-Help.md" ]'
ok "defaults: privacy list + security baseline present" '[ -f "$D1/.spineosignore" ] && [ -f "$D1/vault/20-GOVERNANCE/SECURITY-BASELINE.md" ]'
ok "defaults: no installer chrome or test reports copied" '[ ! -e "$D1/install.sh" ] && [ ! -e "$D1/install.ps1" ] && [ ! -d "$D1/modules" ] && [ ! -d "$D1/zenflow" ]'
ok "defaults: nothing written outside the folder" '[ "$(ls -A "$WORK/home")" = "Defaults Vault" ]'
ok "defaults: no ._ or .DS_Store junk" '[ -z "$(find "$D1" -name "._*" -o -name .DS_Store)" ]'
ok "defaults: dashboard feed matches its JSON" 'node -e "const f=require(\"fs\");const j=f.readFileSync(process.argv[1],\"utf8\").trim();const s=f.readFileSync(process.argv[2],\"utf8\");process.exit(s.includes(j.slice(0,40))?0:1)" "$D1/status-board.json" "$D1/status-board.js"'

ok "removals: default = Archive, recorded" 'grep -qx "mode=archive" "$D1/_config/removals.local" && [ -f "$D1/vault/90-ARCHIVE/README.md" ]'
ok "removals: CLAUDE.md §9 states this vault's setting" 'grep -q "Files you remove go to vault/90-ARCHIVE/" "$D1/CLAUDE.md" && grep -q "§9 · Removing files" "$D1/CLAUDE.md"'
ok "removals: rules in AGENTS.md + SOP" 'grep -q "permanently delete" "$D1/AGENTS.md" && [ -f "$D1/vault/20-GOVERNANCE/SOP-removing-files.md" ]'
ok "removals: one line at install tells the person what happens" 'grep -q "Removing files: your AI moves them to the Archive folder" "$WORK/first.log" && grep -q "permanently delete" "$WORK/first.log"'
ok "guard: settings.json + hook installed by default" '[ -f "$D1/.claude/settings.json" ] && [ -x "$D1/.claude/hooks/delete-guard.sh" ] && grep -q delete-guard "$D1/.claude/settings.json"'

# 1b · the guard, run exactly as Claude Code runs it (hook JSON on stdin, from the installed vault)
TR="$WORK/session.jsonl"; : > "$TR"
userline() { node -e 'process.stdout.write(JSON.stringify({type:"user",message:{role:"user",content:process.argv[1]}})+"\n")' "$1" >> "$TR"; }
hook() {  # hook "<command>" → exit status of the installed guard
  node -e 'process.stdout.write(JSON.stringify({tool_name:"Bash",tool_input:{command:process.argv[1]},cwd:process.argv[2],transcript_path:process.argv[3],hook_event_name:"PreToolUse"}))' "$1" "$D1" "$TR" \
    | CLAUDE_PROJECT_DIR="$D1" HOME="$WORK/home" sh -c "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).hooks.PreToolUse[0].hooks[0].command)' "$D1/.claude/settings.json")" 2>"$WORK/hook.err"
}
userline "tidy my inbox"
printf 'old\n' > "$D1/vault/00-INBOX/2025-01-01 old flyer.txt"
hook 'rm "vault/00-INBOX/2025-01-01 old flyer.txt"'; rc=$?
ok "guard: blocks a delete outside the Archive/Trash (exit 2, plain reason)" '[ $rc -eq 2 ] && grep -q "not in the Archive or the Trash" "$WORK/hook.err"'
hook 'rm -rf vault'; rc=$?;                      ok "guard: blocks rm -rf vault" '[ $rc -eq 2 ]'
hook 'rm vault/00-INBOX/*'; rc=$?;               ok "guard: blocks a wildcard delete" '[ $rc -eq 2 ]'
hook 'find vault -name "*.txt" | xargs rm'; rc=$?; ok "guard: blocks a parsed-list delete" '[ $rc -eq 2 ]'
ok "guard: the file is still there" '[ -f "$D1/vault/00-INBOX/2025-01-01 old flyer.txt" ]'
CMD='mkdir -p vault/90-ARCHIVE/2026-11 && mv "vault/00-INBOX/2025-01-01 old flyer.txt" "vault/90-ARCHIVE/2026-11/"'
hook "$CMD"; rc=$?
ok "guard: allows the Archive move" '[ $rc -eq 0 ]'
( cd "$D1" && eval "$CMD" )
ok "archive move works (file now in vault/90-ARCHIVE/2026-11)" '[ -f "$D1/vault/90-ARCHIVE/2026-11/2025-01-01 old flyer.txt" ] && [ ! -e "$D1/vault/00-INBOX/2025-01-01 old flyer.txt" ]'
DEL='rm "vault/90-ARCHIVE/2026-11/2025-01-01 old flyer.txt"'
hook "$DEL"; rc=$?;                              ok "guard: Archive delete without step 3 → blocked" '[ $rc -eq 2 ] && grep -q "Step 3" "$WORK/hook.err"'
userline "yes"; hook "$DEL"; rc=$?;              ok "guard: a plain yes is not step 3 → blocked" '[ $rc -eq 2 ]'
userline "permanently delete 2025-01-01 old flyer.txt"; hook "$DEL"; rc=$?
ok "guard: after list → move → typed confirmation naming it → allowed" '[ $rc -eq 0 ]'
# Trash: the Mac command the SOP names (macOS 15+), on a throwaway file; Windows uses the Recycle Bin call (static check)
if command -v trash >/dev/null 2>&1 && [ "$(uname -s)" = Darwin ]; then
  TF="$D1/vault/00-INBOX/spineos-judge-trash-test-$$.txt"; printf 'judge\n' > "$TF"
  hook "trash \"$TF\""; rc=$?
  ok "guard: allows the Trash move" '[ $rc -eq 0 ]'
  trash "$TF" >/dev/null 2>&1; rc=$?
  ok "trash move works (file gone from the vault, in the Trash)" '[ $rc -eq 0 ] && [ ! -e "$TF" ]'
else
  printf 'SKIP · trash move (no macOS trash command here)\n'
fi
ok "Windows Recycle Bin move is the SOP's documented call" 'grep -q "SendToRecycleBin" "$D1/vault/20-GOVERNANCE/SOP-removing-files.md"'

# 1c · the other two removals answers are recorded
D4="$WORK/home/Trash Vault"; run_install "$D4" "" "" "" "" "" "2"; rc=$?
ok "removals: answer 2 → Trash recorded + stated" '[ $rc -eq 0 ] && grep -qx "mode=trash" "$D4/_config/removals.local" && grep -q "Trash (Mac) or Recycle Bin" "$D4/CLAUDE.md" && grep -q "moves them to the Trash" "$WORK/last.log"'
D5="$WORK/home/Ask Vault"; run_install "$D5" "" "" "" "" "" "3"; rc=$?
ok "removals: answer 3 → ask each time" '[ $rc -eq 0 ] && grep -qx "mode=ask" "$D5/_config/removals.local" && grep -q "ask me each time" "$D5/CLAUDE.md"'

# 2 · re-run on the same folder with no changes → update mode, nothing beside, nothing overwritten
run_install "$D1" "" "" "" "" ""; rc=$?
ok "rerun: exits 0 in update mode" '[ $rc -eq 0 ] && grep -q "UPDATE complete" "$WORK/last.log"'
ok "rerun: no *.new-v* noise when nothing changed" '[ -z "$(find "$D1" -name "*.new-v*")" ]'
ok "rerun: removals not asked again, choice kept" '! grep -q "where should it go" "$WORK/last.log" && grep -qx "mode=archive" "$D1/_config/removals.local"'

# 3 · user edits, then adds casework later
printf '# my own house rules\n' > "$D1/CLAUDE.md"
run_install "$D1" "n" "y" "n" "n" "n"; rc=$?
ok "add-later: casework added on a later run" '[ -f "$D1/vault/30-CLIENTS/_CASE-TEMPLATE/00-SUMMARY.md" ]'
ok "add-later: user edit kept, kit version beside it" '[ "$(cat "$D1/CLAUDE.md")" = "# my own house rules" ] && ls "$D1"/CLAUDE.md.new-v* >/dev/null 2>&1'
ok "add-later: modules log is append-only" '[ "$(wc -l < "$D1/_config/modules.log" | tr -d " ")" -ge 2 ]'

# 4 · everything no
D2="$WORK/home/Bare"
run_install "$D2" "n" "n" "n" "n" "n" ""; rc=$?
ok "all-no: installs core only (guard still on)" '[ $rc -eq 0 ] && [ ! -d "$D2/vault/40-DOCUMENTS" ] && [ ! -d "$D2/.claude/skills" ] && [ -f "$D2/.claude/settings.json" ] && [ -f "$D2/vault/20-GOVERNANCE/SOP-naming-and-filing.md" ]'

# 5 · refusals
run_install "$WORK/home" "" "" "" "" "" ""; rc=$?
ok "refuses the home folder itself" '[ $rc -ne 0 ] && grep -q "system or home root" "$WORK/last.log"'
run_install "$WORK/home/a/../../escape" ""; rc=$?
ok "refuses .. in the path" '[ $rc -ne 0 ] && [ ! -e "$WORK/escape" ]'
mkdir -p "$WORK/home/Busy"; echo keep > "$WORK/home/Busy/mine.txt"
run_install "$WORK/home/Busy" "" ; rc=$?
ok "non-empty folder: Enter = stop, nothing written" '[ $rc -ne 0 ] && [ "$(ls -A "$WORK/home/Busy")" = "mine.txt" ]'
run_install "$WORK/home/Busy" "y" "" "" "" "" "" ""; rc=$?
ok "non-empty folder on yes: existing file untouched" '[ $rc -eq 0 ] && [ "$(cat "$WORK/home/Busy/mine.txt")" = keep ]'

# 6 · the Mac double-click wrapper runs the same installer
D3="$WORK/home/Via Command"
printf '%s\n' "$D3" "" "" "" "" "" "" | HOME="$WORK/home" bash "$KIT/install.command" > "$WORK/last.log" 2>&1; rc=$?
ok "install.command (double-click path) installs identically" '[ $rc -eq 0 ] && [ -f "$D3/vault/REMINDERS.md" ] && diff -rq "$D2/vault/20-GOVERNANCE" "$D3/vault/20-GOVERNANCE" >/dev/null'

# 7 · the Node engine path (AI-guided / GUI) with every module, from a folder with spaces
cat > "$WORK/brief.json" <<JSON
{ "root": "$WORK/home/Engine Vault", "form": { "brand": "Judge Clinic", "persona": "social-work", "modules": ["documents","casework","reminders","email","skills"], "removals": "ask" } }
JSON
node "$KIT/wizard/provision.mjs" --config "$WORK/brief.json" --apply --yes > "$WORK/last.log" 2>&1; rc=$?
ok "engine: --apply --yes installs all modules" '[ $rc -eq 0 ] && [ -f "$WORK/home/Engine Vault/vault/systems/Email-Help.md" ] && grep -q "verify: GREEN" "$WORK/last.log"'
ok "engine: removals + guard installed" 'grep -qx "mode=ask" "$WORK/home/Engine Vault/_config/removals.local" && [ -f "$WORK/home/Engine Vault/.claude/hooks/delete-guard.mjs" ] && ! grep -q __REMOVALS__ "$WORK/home/Engine Vault/CLAUDE.md"'
ok "engine: no parallel project trees" '[ ! -e "$WORK/home/Engine Vault/00_COMMAND" ] && [ ! -e "$WORK/home/Engine Vault/10_PROJECTS" ]'

# 8 · Windows: real PowerShell (Linux container) + static checks
node "$REPO/scripts/windows-static-check.mjs" > "$WORK/win.log" 2>&1; rc=$?
ok "windows static check" '[ $rc -eq 0 ]'
if command -v docker >/dev/null 2>&1 && docker image inspect mcr.microsoft.com/dotnet/sdk:8.0 >/dev/null 2>&1; then
  docker run --rm -v "$KIT":/kit:ro -e SPINEOS_DEST="/root/My Practice" -e SPINEOS_MODULES="documents,casework,reminders,email,skills" -e SPINEOS_BRAND_NAME="Win Clinic" -e SPINEOS_REMOVALS="trash" \
    mcr.microsoft.com/dotnet/sdk:8.0 pwsh -NoProfile -Command '
      & /kit/install.ps1 | Out-Null
      $d = "/root/My Practice"
      $a = (Test-Path "$d/.spine-os-root") -and (Test-Path "$d/vault/30-CLIENTS/_CASE-TEMPLATE/00-SUMMARY.md") -and (Test-Path "$d/.claude/skills/whats-due/SKILL.md")
      $b = (Select-String -Path "$d/CLAUDE.md" -Pattern "__VAULT_PATH__|__BRAND__").Count -eq 0
      $c = ((Select-String -Path "$d/status-board.js" -Pattern "Win Clinic").Count -ge 1) -and ((Get-Content "$d/_config/removals.local") -contains "mode=trash") -and (Test-Path "$d/.claude/hooks/delete-guard.mjs") -and ((Select-String -Path "$d/CLAUDE.md" -Pattern "__REMOVALS__").Count -eq 0)
      $env:SPINEOS_BRAND_NAME = $null; $env:SPINEOS_MODULES = "none"; $env:SPINEOS_REMOVALS = $null
      & /kit/install.ps1 | Out-Null
      $e = @(Get-ChildItem -Recurse -Force -Path $d -Filter "*.new-v*").Count -eq 0
      if ($a -and $b -and $c -and $e) { "PWSH-OK" } else { "PWSH-FAIL a=$a b=$b c=$c e=$e" }' > "$WORK/pwsh.log" 2>&1
  ok "install.ps1 under real PowerShell 7: install + brand + modules + quiet rerun" 'grep -q PWSH-OK "$WORK/pwsh.log"'
else
  printf 'SKIP · install.ps1 under PowerShell (docker image mcr.microsoft.com/dotnet/sdk:8.0 not present)\n'
fi

printf '\n%s — pass=%s fail=%s · work folder: %s\n' "$([ $fail -eq 0 ] && echo 'ALL GREEN' || echo 'FAILURES')" "$pass" "$fail" "$WORK"
[ $fail -eq 0 ] && rm -rf "$WORK"
exit $([ $fail -eq 0 ] && echo 0 || echo 1)
