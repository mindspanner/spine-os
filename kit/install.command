#!/usr/bin/env bash
# Spine OS Kit — macOS double-click installer.
# One installer, one source: this file only opens install.sh (same folder) in Terminal, so the
# double-click path and the command-line path can never drift apart (v1.8 — the old copy had).
# No network, no admin rights. Everything installs inside the one folder you choose.
cd "$(dirname "$0")" || exit 1
/bin/bash ./install.sh
status=$?
printf '\n  You can close this window now.\n'
exit $status
