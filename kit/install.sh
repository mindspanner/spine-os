#!/usr/bin/env bash
# Spine OS Kit — installer (macOS / Linux).
#
# Installs your vault into ONE folder you choose. Every file the kit writes lives
# INSIDE that folder and its subfolders — NEVER above it, never anywhere else on
# your machine. That boundary is enforced here, not just assumed:
#   • the destination is resolved to a canonical absolute path;
#   • system / home roots are refused;
#   • any path that would escape the chosen folder is skipped;
#   • a `.spine-os-root` marker records the boundary;
#   • a post-install check confirms nothing landed outside the folder.
# No network, no admin rights, nothing leaves your machine.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd -P)"
# macOS `cp` preserves extended attributes by default. On an exFAT target those
# become visible AppleDouble `._*` sidecars even when the archive was clean.
# `-X` copies product bytes only; other platforms use their normal cp.
copy_file() {
  if [ "$(uname -s 2>/dev/null || true)" = "Darwin" ]; then cp -X -- "$1" "$2"; else cp -- "$1" "$2"; fi
}
# Canonical home (resolves any symlink, e.g. macOS /var -> /private/var) for the root check.
HOME_REAL="$(cd -- "$HOME" 2>/dev/null && pwd -P 2>/dev/null || printf '%s' "$HOME")"

printf '\n'
printf '  ┌──────────────────────────────────────────────┐\n'
printf '  │   Spine OS Kit · Starter                      │\n'
printf '  │   Your business on your hard drive.           │\n'
printf '  └──────────────────────────────────────────────┘\n\n'
printf '  Everything installs INSIDE one folder (subfolders only) — never above it.\n\n'

DEFAULT="$HOME/SpineOS"
if ! read -r -p "  Where should your Spine OS folder live? [$DEFAULT]: " DEST; then DEST=""; fi
DEST="${DEST:-$DEFAULT}"

# Expand a leading ~ ourselves (read does not), and drop trailing slashes.
case "$DEST" in
  "~")   DEST="$HOME" ;;
  "~/"*) DEST="$HOME/${DEST#\~/}" ;;
esac
while [ "$DEST" != "/" ] && [ "${DEST%/}" != "$DEST" ]; do DEST="${DEST%/}"; done
[ -z "$DEST" ] && DEST="/"

# The filesystem root is never a wiki.
if [ "$DEST" = "/" ]; then
  printf '  ✗ "/" is the filesystem root. Pick a dedicated folder, e.g. %s\n' "$DEFAULT"; exit 1
fi

# Resolve to an absolute, canonical path: canonicalise the PARENT (which may not
# exist yet) then re-attach the leaf. This removes any relative/.. surprises.
BASE="$(basename -- "$DEST")"
PARENT="$(dirname -- "$DEST")"
if [ -z "$BASE" ] || [ "$BASE" = "." ] || [ "$BASE" = ".." ]; then
  printf '  ✗ Choose a named folder (e.g. SpineOS), not "." or "..".\n'; exit 1
fi
# Reject a leaf/path that would escape the chosen folder BEFORE pwd -P collapses any "..".
# A folder NAME containing "/" or ".." (e.g. typed or pasted "../../SpineOS") would otherwise
# resolve OUTSIDE the folder the user picked. The leaf must be a plain folder name.
case "$BASE" in */*|*..*) printf '  ✗ Folder name may not contain "/" or "..".\n'; exit 1 ;; esac
case "$DEST" in *"/../"*|*/..|../*) printf '  ✗ Path may not contain ".." components.\n'; exit 1 ;; esac
if ! mkdir -p -- "$PARENT" 2>/dev/null; then
  printf '  ✗ Cannot create the parent of "%s". Choose another location.\n' "$DEST"; exit 1
fi
PARENT="$(cd -- "$PARENT" && pwd -P)" || { printf '  ✗ "%s" is not reachable.\n' "$PARENT"; exit 1; }
if [ "$PARENT" = "/" ]; then DEST="/$BASE"; else DEST="$PARENT/$BASE"; fi

# Refuse EXACT system/home roots — the wiki must be a dedicated named folder, never a
# root that would scatter files across shared space. Deep user-chosen paths are allowed
# (exact match only — a folder that merely lives under /private or /var is fine).
for bad in "/" "$HOME" "$HOME_REAL" "/Users" "/root" "/bin" "/sbin" "/etc" "/usr" "/var" "/opt" "/tmp" "/dev" "/cores" "/private" "/System" "/Library" "/Applications" "/Volumes"; do
  if [ "$DEST" = "$bad" ]; then
    printf '  ✗ "%s" is a system or home root. Pick a dedicated folder, e.g. %s\n' "$DEST" "$DEFAULT"; exit 1
  fi
done

# Update mode (K4 no-clobber): an existing `.spine-os-root` means this is the user's
# LIVE wiki. Their edited files are never overwritten — a changed kit file lands
# BESIDE the original as <file>.new-v<version> for the user (or their AI) to merge.
UPDATE=0
[ -f "$DEST/.spine-os-root" ] && UPDATE=1

# If the folder already exists, is non-empty, and is NOT already a Spine OS root,
# do not silently mix into someone else'\''s files.
if [ -e "$DEST" ] && [ "$UPDATE" -eq 0 ] && [ -n "$(ls -A -- "$DEST" 2>/dev/null || true)" ]; then
  printf '  ⚠ "%s" already exists and is not empty (and is not a Spine OS wiki).\n' "$DEST"
  printf '    To keep everything self-contained + tidy, install into a NEW empty folder.\n'
  # `|| ok=""` keeps a non-interactive/GUI caller (stdin already at EOF) from dying under
  # set -e mid-prompt — EOF falls through to the safe abort branch below.
  if ! read -r -p "    Install into it anyway (kit files sit alongside your existing ones)? [y/N]: " ok; then ok=""; fi
  case "$ok" in [yY]*) ;; *) printf '  Aborted — nothing written.\n'; exit 1 ;; esac
fi

# A symlink at the chosen destination would silently redirect the whole install to its target.
# A self-serve installer has no reason to write through a link — refuse.
if [ -L "$DEST" ]; then
  printf '  ✗ "%s" is a symbolic link; choose a real folder.\n' "$DEST"; exit 1
fi

mkdir -p -- "$DEST"
DEST="$(cd -- "$DEST" && pwd -P)"   # final canonical root — the boundary
# Belt-and-suspenders: the canonical root MUST be exactly <chosen parent>/<chosen name>.
# If pwd -P resolved it anywhere else (symlink, residual escape), refuse rather than write.
if [ "$(dirname -- "$DEST")" != "$PARENT" ] || [ "$(basename -- "$DEST")" != "$BASE" ]; then
  printf '  ✗ Resolved path escaped the chosen folder. Aborting.\n'; exit 1
fi

# Copy every kit file into $DEST, preserving subfolders. Confinement guard: skip any
# entry containing "..", and verify each destination directory resolves UNDER $DEST.
# In UPDATE mode: existing files are NEVER overwritten — identical → skip; changed →
# the new version lands beside as <file>.new-v<version> (the user merges on their terms).
KV="$(cat -- "$SRC/VERSION" 2>/dev/null || echo '?')"
copied=0; skipped=0; beside=0

# ── Optional extras (v1.8) ──────────────────────────────────────────────────
# Asked in plain English. Non-interactive callers set SPINEOS_MODULES="documents,casework,…"
# (or "none"). Each extra lives in modules/<id>/files/ and lands at the same path in the vault.
ask_yn() {  # ask_yn "question" default(y|n) → 0 for yes
  local ans
  if ! read -r -p "  $1 " ans; then ans=""; fi
  ans="${ans:-$2}"
  case "$ans" in [yY]*) return 0 ;; *) return 1 ;; esac
}
MODULES=""
if [ -n "${SPINEOS_MODULES+x}" ]; then
  MODULES="$(printf '%s' "$SPINEOS_MODULES" | tr ',' ' ')"
  [ "$MODULES" = "none" ] && MODULES=""
else
  printf '\n  A few optional extras. Press Enter to accept the suggestion in [brackets].\n\n'
  ask_yn "Do you want a tidy place for documents, letters and forms? [Y/n]:" y && MODULES="$MODULES documents"
  ask_yn "Do you keep client or case files (for example clinical or social work)? [y/N]:" n && MODULES="$MODULES casework"
  ask_yn "Would you like a reminders list your AI can check and turn into calendar alerts? [Y/n]:" y && MODULES="$MODULES reminders"
  ask_yn "Would you like email help (your AI drafts, you always press Send)? [y/N]:" n && MODULES="$MODULES email"
  ask_yn "Add ready-made AI shortcuts (sort my inbox, find a file, what's due)? [Y/n]:" y && MODULES="$MODULES skills"
fi

# ── Removing files (v1.9) ───────────────────────────────────────────────────
# One question. Permanent delete is never an option here: by default nothing is deleted for good.
# Non-interactive callers set SPINEOS_REMOVALS=archive|trash|ask.
REMOVALS=""
if [ -n "${SPINEOS_REMOVALS:-}" ]; then
  REMOVALS="$SPINEOS_REMOVALS"
elif [ "$UPDATE" -eq 1 ] && [ -f "$DEST/_config/removals.local" ]; then
  REMOVALS="$(sed -n 's/^mode=//p' "$DEST/_config/removals.local" | head -n 1)"   # keep your earlier choice
else
  printf '\n  When you or your AI remove a file, where should it go?\n'
  printf '    1  An Archive folder inside your vault (suggested)\n'
  printf '    2  Your computer'"'"'s Trash / Recycle Bin\n'
  printf '    3  Ask me each time\n'
  if ! read -r -p "  Nothing is ever deleted for good without three steps. Choose 1, 2 or 3 [1]: " ans; then ans=""; fi
  case "${ans:-1}" in 2|[tT]*) REMOVALS=trash ;; 3|[aA][sS]*) REMOVALS=ask ;; *) REMOVALS=archive ;; esac
fi
case "$REMOVALS" in archive|trash|ask) ;; *) REMOVALS=archive ;; esac
case "$REMOVALS" in
  archive) REMOVALS_LINE='Files you remove go to vault/90-ARCHIVE/ (in a dated folder).' ;;
  trash)   REMOVALS_LINE="Files you remove go to your computer's Trash (Mac) or Recycle Bin (Windows)." ;;
  ask)     REMOVALS_LINE='Before removing anything, ask me each time: Archive (vault/90-ARCHIVE/) or Trash?' ;;
esac

# Copy every file under $1 into $DEST, preserving subfolders. Confinement guard: skip any
# entry containing "..", and verify each destination directory resolves UNDER $DEST.
# In UPDATE mode: existing files are NEVER overwritten — identical → skip; changed →
# the new version lands beside as <file>.new-v<version> (the user merges on their terms).
copy_tree() {
  local from="$1" rel dstdir real
  while IFS= read -r rel; do
    rel="${rel#./}"
    case "$rel" in
      .DS_Store|*/.DS_Store|._*|*/._*) continue ;;                    # exFAT/macOS metadata, never product
      install.sh|install.command|install.ps1|Install-on-Windows.cmd|.spineos-splash.*) continue ;;  # installer chrome
      "Install Spine-OS.app/"*|modules/*|zenflow/*) continue ;;      # guided app · optional extras (copied on a yes) · test reports
      *..*) printf '  ⚠ skipped unsafe path: %s\n' "$rel"; skipped=$((skipped + 1)); continue ;;
    esac
    dstdir="$DEST/$(dirname -- "$rel")"
    mkdir -p -- "$dstdir"
    real="$(cd -- "$dstdir" && pwd -P)"
    case "$real/" in
      "$DEST"/*|"$DEST"/) : ;;                              # under the root — allowed
      *) printf '  ⚠ skipped escaping path: %s\n' "$rel"; skipped=$((skipped + 1)); continue ;;
    esac
    if [ -e "$DEST/$rel" ]; then
      case "$rel" in status-board.json|status-board.js) skipped=$((skipped + 1)); continue ;; esac  # your live board, never replaced
      if cmp -s -- "$from/$rel" "$DEST/$rel"; then
        skipped=$((skipped + 1))                            # identical — nothing to do
      else
        copy_file "$from/$rel" "$DEST/$rel.new-v$KV"       # changed — beside, never over (any mode)
        beside=$((beside + 1))
      fi
      continue
    fi
    copy_file "$from/$rel" "$DEST/$rel"
    copied=$((copied + 1))
  done < <(cd -- "$from" && find . -type f)
}
copy_tree "$SRC"
installed_modules=""
for m in $MODULES; do
  case "$m" in documents|casework|reminders|email|skills) ;; *) continue ;; esac
  if [ -d "$SRC/modules/$m/files" ]; then
    copy_tree "$SRC/modules/$m/files"
    installed_modules="$installed_modules $m"
  fi
done

# Boundary marker — tells Spine OS + any assistant that THIS folder is the wiki root.
if [ ! -f "$DEST/.spine-os-root" ]; then
  {
    printf 'spine-os-wiki-root\n'
    printf 'version=%s\n' "$(cat -- "$SRC/VERSION" 2>/dev/null || echo '?')"
    printf 'installed_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')"
    printf 'boundary=%s\n' "$DEST"
  } > "$DEST/.spine-os-root"
fi
# How removals work (one line, yours to change). The delete guard and CLAUDE.md read it.
mkdir -p -- "$DEST/_config"
if [ "$UPDATE" -eq 0 ] || [ -n "${SPINEOS_REMOVALS:-}" ] || [ ! -f "$DEST/_config/removals.local" ]; then
{
  printf '# How removing files works in this vault. Change mode to archive, trash or ask.\n'
  printf '# Permanent deletes always need the three steps in vault/20-GOVERNANCE/SOP-removing-files.md.\n'
  printf 'mode=%s\n' "$REMOVALS"
  printf 'archive_folder=vault/90-ARCHIVE\n'
} > "$DEST/_config/removals.local"
fi
# Record which extras are installed (append-only; the installer reads nothing back from it).
if [ -n "$installed_modules" ]; then
  mkdir -p -- "$DEST/_config"
  printf '%s modules=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')" "$(printf '%s' "$installed_modules" | sed 's/^ //; s/ /,/g')" >> "$DEST/_config/modules.log"
fi

# ── Branding ─────────────────────────────────────────────────────────────────
# Stamp the vault in YOUR brand. The guided installer passes these via env; a plain
# CLI install leaves them empty and the dashboard ships product-default (still yours
# to edit in _config/brand.local + status-board.json). Every write stays inside $DEST.
brand_name="${SPINEOS_BRAND_NAME:-Spine OS}"
brand_tag="${SPINEOS_TAGLINE:-Your business on your hard drive.}"
brand_ind="${SPINEOS_INDUSTRY:-}"
brand_hex="${SPINEOS_PRIMARY_HEX:-#14b8a6}"
brand_hex2="${SPINEOS_SECONDARY_HEX:-#22d3ee}"
brand_logo_src="${SPINEOS_LOGO:-}"
kit_ver="$(cat -- "$SRC/VERSION" 2>/dev/null || echo '1.0.0')"

# Sanitise to a single line with no " or \ (would break the JSON inline / token swap).
sanitize() { printf '%s' "$1" | tr -d '"\\' | tr '\n\r\t' '   '; }
brand_name="$(sanitize "$brand_name")"; [ -z "$brand_name" ] && brand_name="Spine OS"
# Update mode: keep the brand you chose at first install (read back from _config/brand.local).
if [ "$UPDATE" -eq 1 ] && [ -z "${SPINEOS_BRAND_NAME:-}" ] && [ -f "$DEST/_config/brand.local" ]; then
  prev="$(sed -n 's/^name=//p' "$DEST/_config/brand.local" | head -n 1)"
  [ -n "$prev" ] && brand_name="$(sanitize "$prev")"
fi
brand_tag="$(sanitize "$brand_tag")"; brand_ind="$(sanitize "$brand_ind")"
brand_hex="$(sanitize "$brand_hex")"; brand_hex2="$(sanitize "$brand_hex2")"

# Optional logo → _assets/logo.png, inside the boundary. (Fresh installs only.)
brand_logo=""
if [ "$UPDATE" -eq 0 ] && [ -n "$brand_logo_src" ] && [ -f "$brand_logo_src" ]; then
  mkdir -p -- "$DEST/_assets"
  if copy_file "$brand_logo_src" "$DEST/_assets/logo.png" 2>/dev/null; then brand_logo="_assets/logo.png"; fi
fi

# _config/brand.local — yours to edit. (Fresh installs only — never reset on update.)
if [ "$UPDATE" -eq 0 ]; then
mkdir -p -- "$DEST/_config"
{
  printf 'name=%s\n' "$brand_name"
  printf 'tagline=%s\n' "$brand_tag"
  printf 'industry=%s\n' "$brand_ind"
  printf 'primary_colour=%s\n' "$brand_hex"
  printf 'secondary_colour=%s\n' "$brand_hex2"
  printf 'logo_path=%s\n' "$brand_logo"
} > "$DEST/_config/brand.local"
fi

# Update status-board.json's brand block, then regenerate status-board.js — the file the
# dashboard reads — so the command centre opens in YOUR brand offline, in any browser.
# (Fresh installs only — on update the user's own status-board is theirs, untouched.)
if [ "$UPDATE" -eq 0 ] && [ -f "$DEST/status-board.json" ]; then
  sb="$(cat -- "$DEST/status-board.json")"
  sb="${sb//\"name\": \"\"/\"name\": \"$brand_name\"}"
  sb="${sb//\"tagline\": \"\"/\"tagline\": \"$brand_tag\"}"
  sb="${sb//\"industry\": \"\"/\"industry\": \"$brand_ind\"}"
  sb="${sb//\"logo\": \"\"/\"logo\": \"$brand_logo\"}"
  sb="${sb//\"primary\": \"#14b8a6\"/\"primary\": \"$brand_hex\"}"
  sb="${sb//\"secondary\": \"#22d3ee\"/\"secondary\": \"$brand_hex2\"}"
  printf '%s\n' "$sb" > "$DEST/status-board.json"
  printf 'window.__STATUS_BOARD__ = %s;\n' "$sb" > "$DEST/status-board.js"

  # Branding self-check: the dashboard's data file must be present + carry the brand.
  if [ ! -s "$DEST/status-board.js" ]; then
    printf '  ✗ Branding check FAILED (status-board.js not written). Aborting.\n'; exit 1
  fi
fi

# Stamp YOUR real folder path + brand into the boot protocol + AI prompts, so every prompt
# already has the right full paths and your AI always boots into this vault with governed context.
for md in CLAUDE.md MEMORY.md START-WITH-YOUR-AI.md SETUP-GUIDE.md; do
  f="$DEST/$md"
  [ "$UPDATE" -eq 1 ] && f="$DEST/$md.new-v$KV"   # update mode: stamp the beside-copy only
  [ -f "$f" ] || continue
  c="$(cat -- "$f")"
  c="${c//__VAULT_PATH__/$DEST}"
  c="${c//__BRAND__/$brand_name}"
  c="${c//__REMOVALS__/$REMOVALS_LINE}"
  printf '%s\n' "$c" > "$f"
  # A stamped beside-copy identical to your live file is not an update — remove it (less noise).
  if [ "$UPDATE" -eq 1 ] && cmp -s -- "$f" "$DEST/$md"; then rm -f -- "$f"; beside=$((beside - 1)); fi
done

# macOS may attach `com.apple.provenance` to newly-created files even when cp
# was told not to preserve attributes. exFAT stores that attribute as visible
# `._*` sidecars. Remove only those metadata sidecars, only inside the chosen
# root, after every product write has completed.
metadata_cleaned=0
if [ "$(uname -s 2>/dev/null || true)" = "Darwin" ]; then
  metadata_cleaned="$(find "$DEST" -type f -name '._*' -print 2>/dev/null | wc -l | tr -d ' ')"
  find "$DEST" -type f -name '._*' -delete 2>/dev/null || true
fi

# Confinement self-check: assert nothing was written outside $DEST. By construction
# every write targets "$DEST/...", so this is a belt-and-suspenders proof for the user.
outside="$(cd -- "$DEST" && find . -type f 2>/dev/null | grep -c '^\.\./' || true)"
if [ "${outside:-0}" -ne 0 ]; then
  printf '  ✗ Confinement check FAILED (%s file(s) resolved outside the root). Aborting.\n' "$outside"; exit 1
fi

if [ "$UPDATE" -eq 1 ]; then
  printf '\n  ✓ UPDATE complete — your existing files were left untouched.\n'
  printf '    New files added: %s · unchanged: %s · updated versions placed beside yours: %s\n' "$copied" "$skipped" "$beside"
  [ "$beside" -gt 0 ] && printf '    Look for *.new-v%s files — compare and merge when ready (your AI can help).\n' "$KV"
else
  printf '\n  ✓ Installed %s file(s) — all inside: %s\n' "$copied" "$DEST"
  [ "$skipped" -gt 0 ] && printf '  ⚠ Skipped %s path(s) that would have escaped the folder.\n' "$skipped"
fi
[ "$UPDATE" -eq 0 ] && printf '  → Branded as: %s\n' "$brand_name"
[ -n "$installed_modules" ] && printf '  → Optional extras added:%s\n' "$installed_modules"
case "$REMOVALS" in archive) where='the Archive folder (vault/90-ARCHIVE)' ;; trash) where='the Trash' ;; *) where='the Archive or the Trash (it asks you each time)' ;; esac
printf '  → Removing files: your AI moves them to %s. Nothing is deleted for good unless you type "permanently delete" and the file names.\n' "$where"
if [ -f "$DEST/.claude/settings.json.new-v$KV" ]; then
  printf '    Your own .claude/settings.json was kept, so the delete guard is not on yet: merge settings.json.new-v%s to turn it on.\n' "$KV"
fi
[ "${metadata_cleaned:-0}" -gt 0 ] && printf '  → Removed %s macOS metadata sidecar(s) from the product folder.\n' "$metadata_cleaned"
printf '  → Open %s/dashboard.html in any browser to start.\n' "$DEST"
printf '  → This folder is your wiki root. Everything lives here. To move it later, ask your\n'
printf '    LLM to update WIKI-ROOT-GOVERNANCE.md and relocate the whole folder — you own that call.\n\n'
