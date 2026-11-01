# Spine OS Kit — Setup guide

> Starter template (preview build). Plain markdown — readable and editable in any editor.
> This is illustrative scaffolding. Adapt it to your own professional and regulatory
> obligations before relying on it for real client or clinical work.

## 1. Install

- **macOS** — open the **Spine-OS disk image** you downloaded (`Spine-OS-v<version>.dmg`), drag **Spine-OS** to Applications, then open it. If macOS blocks the ad-hoc-signed
  beta: open **System Settings → Privacy & Security**, scroll to the "Spine-OS"
  message, click **Open Anyway**, then re-open the app and click **Open**. On macOS 13–14 you can
  instead right-click the app → Open. Terminal fallback: `bash install.command`.
- **Linux** — `chmod +x install.sh && ./install.sh`
- **Windows** — under development and not publicly downloadable until the real-Windows proof gate passes.

Pick a folder when prompted — that folder is your **wiki root**. The installer writes **everything
inside that one folder and its subfolders, and nothing anywhere else**: it refuses system/home roots,
warns before installing into a folder that already has other files, and drops a `.spine-os-root`
marker so the boundary is explicit. Move or back up that single folder and you've moved or backed up
your whole business. See **`WIKI-ROOT-GOVERNANCE.md`** at the root of your wiki for the boundary rule
and how to relocate it later (a deliberate, governed step you own — not something that happens by
accident).

## 2. Open the dashboard

Open `dashboard.html` in any browser. It opens offline, makes no network calls, and links into the
four vault lanes: **Inbox → Projects → Governance → Clients**.

## 3. Connect your AI (this is where it gets powerful)

Spine OS is BYO-LLM by design — you stay in control of the model and the data it sees. Two files make
your assistant boot into your vault **already governed**, with the right full paths, ready to work:

1. **`START-WITH-YOUR-AI.md`** — open this first. It has copy-paste prompts (already carrying your real
   folder path) for: booting, a folder walkthrough, STORM-style research, writing ADRs, ingesting your
   inbox, generating branded HTML, wiring connectors (read-only), and running your weekly review.
2. **`CLAUDE.md`** — the house rules your AI follows every session (SSOT · no client data to the model
   by default · human-in-the-loop on anything outward · minimal back-and-forth). Claude Code reads it
   automatically when you run it from `__VAULT_PATH__`; for ChatGPT/Cowork, the Boot prompt points it there.

Quickstart (Claude Code): `cd "__VAULT_PATH__"` then `claude` — it auto-boots. Otherwise paste the **Boot**
prompt from `START-WITH-YOUR-AI.md`. The setup is local by default; the plan screen separately offers an opt-in, de-identified install-status ping. Whatever model you connect runs on *your* terms.

## 4. Make it yours

- Rename the vault lanes to match how you actually work.
- Copy `vault/10-PROJECTS/_TEMPLATE.md` for each new engagement.
- Write decisions down once in an ADR (`vault/20-GOVERNANCE/ADR-template.md`) — future-you will thank you.

## Upgrades

Lifetime updates to the template are included. Re-run the latest installer against the same Spine OS root: identical files are skipped, buyer-edited files stay untouched, and changed templates land beside them as `.new-v<version>` for review and merge.

## Support

Self-serve Kit has no included support calls. Want it installed and tailored for you? The
done-for-you tiers (Lite → Bespoke) pick up exactly these files. See the website.
