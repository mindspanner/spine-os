---
name: keep-current
description: Check whether this SPINE-OS vault is up to date and help merge updates safely. Use when the person says update, keep current, new version, or check for updates.
---

# Keep current

1. Read `VERSION` in this vault and the newest `CHANGELOG.md` you were given (the person downloads the
   new kit or pulls the repo; you do not download anything yourself).
2. Explain what changed in plain English, 3 lines at most.
3. Run the installer in update mode (it never overwrites: changed files land beside yours as
   `*.new-v<version>`).
4. For each `*.new-v*` file: show the difference in plain words, propose a merge, wait for a yes,
   then merge and move the `.new-v` copy to `vault/90-ARCHIVE/` (never delete it).
5. Note the update in `vault/20-GOVERNANCE/decisions/decisions.jsonl`.
