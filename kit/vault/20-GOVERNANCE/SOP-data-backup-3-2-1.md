# SOP — Data backup (the 3-2-1 rule, made boring on purpose)

- **When to run this:** set it up once today; then the weekly part runs in your weekly review, the test part runs quarterly.
- **Owner:** you
- **Last reviewed:** YYYY-MM-DD

## Purpose

Your vault is the source of truth for your business. A drive that dies, a laptop that's stolen, or a folder synced into oblivion can take the whole business with it. The 3-2-1 rule is the industry-standard, plain-English answer: **3 copies of your data, on 2 different kinds of media, with 1 copy off-site.** This SOP makes that real for a solo operator.

## Inputs

- Your vault folder.
- One external drive (USB SSD or HDD).
- One off-site location (a second drive you keep elsewhere, or a cloud/sync tool you trust).

## Outputs

- An automatic local backup running daily.
- A dated weekly copy on a second drive.
- A quarterly restore test you've actually performed.

## The 3-2-1 rule, mapped to you

- **3 copies:** the working vault + a local backup + an off-site copy.
- **2 media:** e.g. your laptop's internal drive + an external drive (don't let all three live on the same physical disk).
- **1 off-site:** a copy that isn't in the same building, so a fire/theft/flood doesn't take everything at once.

## Steps

1. **Turn on automatic local backup.** macOS: Time Machine to an external drive. Windows: File History or a backup tool. Linux: your backup tool of choice (e.g. a scheduled `rsync` or Déjà Dup). Set it and confirm the first run completes.
2. **Add a weekly dated copy.** Once a week (do it during your weekly review), copy the whole vault to a second drive into a dated folder, e.g. `vault-backup-2026-03-14/`. Dated copies protect you from "the sync helpfully deleted my files everywhere".
3. **Put one copy off-site.** Either rotate a drive you keep at another location, or use a sync/cloud tool — but treat the off-site copy as a *copy*, never the master (see your "where data lives" ADR).
4. **Restore-test quarterly.** Once a quarter, open a backed-up copy on another machine (or a different folder) and confirm the files actually open. *A backup you have never restored is a hope, not a backup.*
5. **Mind the sensitive data.** If your off-site copy is a cloud tool, make sure that's consistent with the privacy obligations that apply to the information you hold. Encrypt the backup drive if it leaves the building.

## Done when

There are three copies, on at least two kinds of media, with one off-site — and you have, at least once, successfully opened a file from a backup that wasn't the working copy.

## Worked example

A consultant's setup:

1. Time Machine to a 1 TB USB SSD, runs hourly automatically.
2. Every Friday, drags the vault to a second USB drive as `vault-backup-<date>/`.
3. Off-site: that second drive lives in a drawer at her partner's office; she swaps it monthly. It's encrypted (FileVault-formatted).
4. Each quarter she copies last week's backup to a spare laptop and opens three random files. Last test caught that one project folder had stopped syncing two weeks earlier — fixed before it mattered.

> Practical guidance, not a guarantee. Test your own setup; you own your backups.
