# Verify your download

Good practice before you unzip and trust any download: confirm the file you received is exactly the file
that was published, byte for byte. This catches a corrupted download or a tampered copy.

Your purchase email (or the download page) lists a **SHA-256 checksum** for the Kit zip — a long string of
letters and numbers. Compute the checksum of *your* downloaded file and confirm it matches that string.
If they match, your copy is intact. If they don't, **don't use it** — re-download and check again.

> The published checksum is the one from Mindspan, shown alongside your download. Compare against *that*,
> not against any value shown here.

## macOS

Open **Terminal**, then run (replace the filename with your actual zip):

```
shasum -a 256 ~/Downloads/spineos-kit.zip
```

Compare the output to the published SHA-256. They should be identical.

## Linux

Open a terminal and run:

```
sha256sum ~/Downloads/spineos-kit.zip
```

Compare the output to the published SHA-256.

## Windows (PowerShell)

Open **PowerShell**, then run:

```
Get-FileHash "$HOME\Downloads\spineos-kit.zip" -Algorithm SHA256
```

The `Hash` value it prints should match the published SHA-256 (case doesn't matter).

## Windows (Command Prompt)

If you prefer `cmd.exe`:

```
certutil -hashfile "%USERPROFILE%\Downloads\spineos-kit.zip" SHA256
```

Compare the printed hash to the published SHA-256.

## What "match" means

- **Matches** → your download is intact and unaltered. Proceed.
- **Doesn't match** → the file is corrupt or has been changed. Delete it, download again, and re-check. If
  a fresh download still doesn't match the published value, contact the seller before using it.

> Verifying a download is a security habit, not a guarantee of anything inside the Kit. The Kit is
> business-admin scaffolding — see `SETUP-GUIDE.md` for what it is (and isn't).
