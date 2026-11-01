# SOP — Keeping SPINE-OS current

- **When:** when Mindspan announces an update, or every 3 months.
- **Owner:** you, with your AI.

1. Get the new kit (download link or `git pull` of the SPINE-OS repo). Your AI does not download it for you.
2. Read `CHANGELOG.md` (ask your AI: "what changed, in 3 lines?").
3. Run the installer again and pick this same folder. It switches to update mode by itself:
   your files are never overwritten — changed kit files land beside yours as `*.new-v<version>`.
4. Ask your AI: "help me merge the .new files". Approve each merge.
5. Optional extras you skipped last time can be added now — the installer asks again.
6. Note it in `decisions/decisions.jsonl`: date, from-version, to-version.

Back up before you update (`SOP-data-backup-3-2-1.md`).
