# 90-ARCHIVE — where removed files go

Nothing in this vault is deleted for good by default. When you (or your AI) remove a file, it moves here,
into a folder named for the month, for example `90-ARCHIVE/2026-11/`. You can always move it back.

- Your AI files things here instead of deleting them. It tells you what it moved and why.
- To delete something for good, three steps, in this order:
  1. Your AI lists exactly what it would delete and why.
  2. It moves those items here (or to the Trash) first.
  3. You type **permanently delete** and the name of every item, for example
     "permanently delete 2026-03-01 old flyer.pdf".
- Your AI never deletes with a wildcard (`*`), a long list, or a list made by another program, even when
  it has full access. In Claude Code a guard (`.claude/hooks/delete-guard.mjs`) blocks it.

How this vault handles removals is set in `_config/removals.local` (archive · trash · ask).
Full rules: `vault/20-GOVERNANCE/SOP-removing-files.md`. You can change this any time.
