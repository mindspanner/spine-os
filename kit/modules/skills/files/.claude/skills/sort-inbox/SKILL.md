---
name: sort-inbox
description: Sort everything in vault/00-INBOX into the right folder. Use when the person says sort my inbox, file these, tidy up, or process my inbox.
---

# Sort my inbox

1. List every file in `vault/00-INBOX/` (skip `AI-HANDOVER/` and `.keep`).
2. For each file, decide one home: a client folder in `vault/30-CLIENTS/` (by client code), a project in
   `vault/10-PROJECTS/`, `vault/40-DOCUMENTS/` (if it exists), `vault/20-GOVERNANCE/`, or "leave in inbox".
3. Show the plan as a short table: file → new home → new name. New names follow
   `vault/20-GOVERNANCE/SOP-naming-and-filing.md` (`YYYY-MM-DD topic type.ext`, client code not name).
4. Wait for a yes. Then move (never copy, so there is one copy), and add one line per move to
   `vault/00-INBOX/AI-HANDOVER/YYYY-MM-DD sort log.md`.
5. Ask only about files you truly cannot place. Never delete anything: anything that should go moves to the Archive (see `vault/20-GOVERNANCE/SOP-removing-files.md`).
