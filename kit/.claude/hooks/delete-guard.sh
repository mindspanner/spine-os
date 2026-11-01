#!/bin/sh
# SPINE-OS delete guard launcher (v1.9). Claude Code runs this before every shell command and every
# file edit. A safety net plus rules, not a guarantee. With Node.js: the full check in delete-guard.mjs
# (moves to the Archive or the Trash are fine; a permanent delete needs the three steps; the safety
# settings are the person's to change). Without Node.js: a rougher check stops delete-looking commands
# and edits to the safety settings. Plain-English rules: vault/20-GOVERNANCE/SOP-removing-files.md
INPUT="$(cat)"
DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v node >/dev/null 2>&1; then
  printf '%s' "$INPUT" | node "$DIR/delete-guard.mjs"
  s=$?
  if [ "$s" -eq 0 ] || [ "$s" -eq 2 ]; then exit "$s"; fi
fi
if printf '%s' "$INPUT" | grep -Eq '"tool_name"[[:space:]]*:[[:space:]]*"(Write|Edit|MultiEdit|NotebookEdit)"' &&
   printf '%s' "$INPUT" | grep -Eq '"(file_path|notebook_path)"[[:space:]]*:[[:space:]]*"[^"]*(\.claude[/\\]|removals\.local)'; then
  echo 'SPINE-OS delete guard: blocked. The safety settings can only be changed by the person, by hand.' >&2
  exit 2
fi
if printf '%s' "$INPUT" | grep -Eiq '"command"[^}]*(^|[^A-Za-z0-9_-])(rm|rmdir|unlink|shred|del|erase|rd|ri|Remove-Item|rimraf|eval|iex|truncate)([^A-Za-z0-9_-]|$)'; then
  echo 'SPINE-OS delete guard: blocked. This looks like a delete, and the full guard needs Node.js (nodejs.org). Move the file to the Archive or the Trash instead.' >&2
  exit 2
fi
exit 0
