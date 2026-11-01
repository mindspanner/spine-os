# Security

## What the kit does and does not do
- Runs locally. No accounts, no servers, no background services. The only optional network signal is
  the de-identified install-completed ping in the app wizard, off unless you say yes.
- Installers write only inside the one folder you choose, refuse system and home folders, refuse `..`
  and links, and never overwrite your files (changed kit files land beside yours as `*.new-v<version>`).
- No keys or passwords are stored in the vault. Cloud AI keys go to the system keychain
  (macOS Keychain / Windows Credential Manager).
- The delete guard (`kit/.claude/hooks/delete-guard.mjs`) is a safety net plus rules, not a guarantee. In
  Claude Code it checks each shell command and file edit for the common ways to delete or overwrite files
  (rm and its cousins, wildcards and lists, eval, variables as commands, text piped into a shell, scripts
  and inline code that delete, destructive git, overwrites of existing files) and for changes to its own
  settings, and stops them. It cannot see every way a file can be destroyed (a program it cannot read, a
  tool it does not know, code that hides what it does), and it does not run in Claude Desktop chats,
  ChatGPT or other apps, where only the written rules in `CLAUDE.md` / `AGENTS.md` apply. Keep backups.
- `.spineosignore` lists what an AI must never send to an online AI service (client folders, the client
  code key, local config). It is followed by instruction, not enforced by software — your AI tool's own
  data settings still apply.

## Report a problem
Email **info@mindspan.com.au** with "SPINE-OS security" in the subject. Please do not open a public issue
for a security problem. We reply within 5 business days.

## Before every release
`node scripts/verify-all.mjs` and `bash scripts/judge-fresh-install.sh` must both be green; the secrets
scan in `verify-all` must pass.
