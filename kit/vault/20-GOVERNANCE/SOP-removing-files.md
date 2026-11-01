# SOP — Removing files (nothing is deleted for good by default)

- **When to run this:** every time you or your AI want to get rid of a file or folder.
- **Owner:** you. Your AI follows it; in Claude Code a guard also checks its commands (a safety net, not a guarantee).
- **Last reviewed:** YYYY-MM-DD

## Purpose

A deleted file is gone. An archived file can come back. So in this vault, removing means **moving**,
and a permanent delete is rare, slow on purpose, and always your call — never the AI's.

## The agreement (set at install, yours to change)

`_config/removals.local` holds one of three choices:

| `mode=` | What "remove" means |
|---|---|
| `archive` (default) | Move it to `vault/90-ARCHIVE/<year-month>/`. You can move it back any time. |
| `trash` | Move it to your computer's Trash (Mac) or Recycle Bin (Windows). |
| `ask` | Your AI asks each time: Archive or Trash? |

Permanent delete is never a setting. Your AI never deletes a file for good, **even when it has full
access or "bypass permissions"**.

## Steps — removing (every time)

1. Your AI names each item and says why it should go.
2. It moves each one to the place your setting says. It keeps the name, and adds the date if two clash.
3. It tells you in one line what moved where. Nothing else changes.

How your AI moves things:
- **Archive:** a normal move into `vault/90-ARCHIVE/<year-month>/`.
- **Trash, Mac:** `trash "<file>"` (macOS 15 or later), or Finder: right-click → **Move to Trash**.
- **Recycle Bin, Windows:** PowerShell `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('<file>','OnlyErrorDialogs','SendToRecycleBin')`,
  or File Explorer: right-click → **Delete** (this goes to the Recycle Bin).
- If it cannot reach the Trash (for example Claude Desktop's Filesystem extension), it moves the item to
  the Archive and tells you to drag it to the Trash yourself.

## Steps — a permanent delete (all three, in this order)

1. **List.** Your AI lists exactly what would be deleted (each name) and why. No "and the rest".
2. **Move first.** It moves those items to the Archive or the Trash. It deletes nothing yet.
3. **You confirm in writing.** You type **permanently delete** and the name of every item, for example:
   "permanently delete 2026-03-01 old flyer.pdf". A plain "yes" or "ok" is not enough.

Only then may your AI delete those named items — from the Archive or the Trash, one command, named
items only. Or you empty the Trash yourself.

## Never (whatever access the AI has)

- Never delete with a wildcard (`*`, `?`), a whole folder of unknown contents, more than 10 items at a
  time, or a list made by another command (`find`, `xargs`, a loop, a pasted list).
- Never delete anything outside the Archive or the Trash.
- Never delete to "fix" a problem, to make room, or to tidy up. Archive instead and ask.
- Never delete from inside a script, where nobody can see the names.

## The guard (Claude Code)

The guard is a safety net plus rules, not a guarantee. `.claude/settings.json` runs
`.claude/hooks/delete-guard.sh` before each shell command and each file edit your AI makes in Claude Code.
In plain English, it stops the common ways to delete or overwrite files: a delete outside the Archive or
the Trash, a wildcard or a list, a delete you have not confirmed with "permanently delete" and the names,
commands hidden inside `eval`, variables, scripts or inline code, text fed into a shell, destructive git
commands, and writing over a file that already exists. It also stops your AI changing these safety
settings (`.claude/` and `_config/removals.local`); only you change those, by hand. Moves to the Archive
or the Trash go through. If Node.js is not installed, a rougher check stops anything that looks like a
delete.

What it cannot do: it cannot see every way a file can be destroyed (a program it cannot read, a tool it
does not know, code that hides what it does). It does not run in Claude Desktop chats, ChatGPT or other
apps; there only the written rules in `CLAUDE.md` and `AGENTS.md` apply. Claude Desktop asks "Allow …?"
before it deletes — click **Deny** unless you typed the confirmation yourself. Keep the 3-2-1 backup
(`SOP-data-backup-3-2-1.md`) either way.

## Done when

Every removal is a move you can undo, and every permanent delete has the three steps in the chat.

## Worked example

The person says "get rid of the old flyers in my inbox".
1. AI: "I'll move these 2 to the Archive (no longer needed, replaced by the 2026 flyer):
   `2025-02-01 flyer.pdf`, `2025-06-01 flyer.pdf`. OK?" → "ok" → moved to `vault/90-ARCHIVE/2026-11/`.
2. Later: "delete them for good". AI lists the two names again and confirms they are in the Archive.
3. Person: "permanently delete 2025-02-01 flyer.pdf and 2025-06-01 flyer.pdf". AI deletes those two only.

> You can change this any time. Operating guidance, not legal or professional advice. Record-keeping
> laws may require you to keep some records for years — check `SOP-record-retention-AU.md` first.
