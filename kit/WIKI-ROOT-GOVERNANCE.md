# This folder is your Spine OS wiki root

Everything Spine OS creates lives **inside this one folder** and its subfolders — never above it,
never anywhere else on your machine. The installer copies the kit here, and every playbook, SOP,
and file the system generates is written **relative to this root**. Nothing phones home; nothing is
written outside this folder.

You can confirm this at any time: the marker file `.spine-os-root` at the top of this folder is what
tells Spine OS (and any assistant you use) that *this* is the boundary. If a file would ever be
written above this folder, that is a bug — report it.

## The one rule

> **The wiki root is the boundary.** Read and write only inside it. Treat everything above this
> folder as off-limits.

This is the same principle the vault runs on — *information lives in one place* — applied to the
filesystem. It keeps your business self-contained, portable (move or back up this one folder and you
have moved or backed up everything), and impossible to scatter across your drive by accident.

## Moving or changing the root later

If you decide to relocate your wiki (a new drive, a synced folder, a different name), that is **your
decision to make** — Spine OS will not move itself. To do it safely:

1. Ask your LLM/assistant: *"Help me relocate my Spine OS wiki root from `<here>` to `<there>`."*
2. It should: (a) confirm the new location is a dedicated folder, (b) move this **entire** folder
   (the `.spine-os-root` marker travels with it), (c) update any absolute paths in your SOPs/ADRs,
   and (d) record the change as an ADR in `20-GOVERNANCE/` so the trail is legible.
3. **You own the outcome.** Once you move the root, you are responsible for the new location meeting
   your privacy, backup, and professional obligations — re-read your Privacy note and
   `SOP-data-backup-3-2-1` at the new home.

Spine OS deliberately makes relocation a governed, deliberate act rather than something that happens
silently — because where your business data lives is a decision, not a default.

> Scaffolding only — not legal, clinical, financial or compliance advice. Where your data lives is
> your responsibility; align it with the obligations that apply to you.
