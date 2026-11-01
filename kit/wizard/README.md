# Spine OS — Provisioning wizard · L8 + S67 UI

> **Status:** **canonical shipped flow.** The provisioner passes `pressure-test.mjs` 10/10 and `pressure-test-v2.mjs` 34/34 (hero-MP4 checks SKIP where the release videos are absent). DR-0012 selected one Tauri 2 launcher with a bundled Node sidecar and embedded webview; v1.7.0 packaged this eight-step wizard (v1.8.0 adds optional extras and the Windows script installer) for macOS and Windows. Release remains proof-gated pending the native Part G matrix.

## The UI (S67 · decision S67-D1: dependency-free local server, not React/Vite)
```
node serve.mjs                # → prints http://127.0.0.1:<port>/ — open it
```
Splash → **EULA hard ACCEPT gate** (scroll-to-end; serves the real `../legal/` draft via /api/eula, sha-stamped into consent) → 5 steps (you · scope · environment probe · connectors · review) → **full plan shown before any write** → sandbox apply + ledger view → green/red self-test → teardown. Server binds 127.0.0.1 only, CSRF-tokened POSTs, CSP, zero outbound network. Real-root apply needs `--allow-real` **and** a typed confirm — sandbox is the default, always.

## Why this exists the way it does (operator duty-of-care, 2026-06-05)
The wizard touches a filesystem to set up Spine OS. Before it ever runs on *someone else's* machine, we must pressure-test it in isolation. Rather than build a VM platform (bloat), the safety is **built into the provisioner itself** so it is safe *everywhere*, and trivially testable.

## The safety model — sandbox by default
`provision.mjs` is **structurally incapable** of writing outside one resolved `root`:
- **No `--apply` ⇒ DRY-RUN.** `root` = a throwaway temp dir (`os.tmpdir()/spineos-sandbox-*`). It plans, applies *into the sandbox*, and leaves it for inspection.
- **`--apply` ⇒ real root** (`~/SpineOS`) — never the default; the launcher enables it only after explicit plan review.
- **Path-escape guard:** every write is `safeJoin`-ed to `root`; a `../` escape throws.
- **Idempotent:** re-running writes nothing new (sha-compared).
- **Ledgered:** every action → `_provision-ledger.jsonl` (action · path · sha256 · ts) for audit.
- **Consent-first:** a `consent-record.json` (per `../legal/consent-record-schema-v1.json`) is written before business logic.
- **Reversible:** `teardown()` removes a sandbox root and **refuses** any non-sandbox path.

This is the same guarantee that protects a real client machine: the wizard always **plans → shows → waits for ACCEPT → applies**, confined to an explicit root.

## Pressure-test (proof, runnable)
```
node pressure-test.mjs
```
Runs the real code path against a sandbox and asserts 10 invariants (sandbox-default, no escape, idempotent, consent recorded, guard throws, teardown safe). **Last run: ✅ 10/10, exit 0** → report at `../zenflow/_review/v4-L8-pressure-test.json`. Re-run after any change to `provision.mjs`.

## Splash + consent ceremony (§3.8a · corner-resize)
`splash.html` — runnable single-file demo. Hero video → product icon **animates/resizes into the corner** (operator-chosen variant) → EULA scrolls behind a **hard ACCEPT gate** (no proceed until scrolled to end) → records a consent object locally (timestamp · EULA hash · machine id · accepted). Honours `prefers-reduced-motion` (skips video → straight to the gate). Fully local. Open it directly in a browser.

## The clean "other system" — container/VM seam (no bloat)
- **Default clean target = Docker** (already governed; data-root on SSD per ADR-031/§8a). Run the provisioner + pressure-test inside a fresh Linux container to validate all OS-agnostic logic against a pristine filesystem. *(Seam documented; not wired this session.)*
- **True-OS validation = optional final gate.** A multipass (Ubuntu) or UTM (macOS/Windows) VM is the recommended pass **before the very first external install only** — not standing infrastructure. The provisioner's platform probe is the only OS-specific surface to exercise there.

## Honest release seams
- Cloud provider keys are stored in the OS keychain; the vault records only a key reference. Local Ollama detection is built in.
- The macOS beta is ad-hoc signed, not Developer ID notarised. Windows source parity exists, but public Windows delivery stays closed until real-Windows proof.
- The legal files served by the EULA gate remain draft pending solicitor approval; the UI labels them accordingly.

## Bright-lines respected
No live money is handled by the installer. Cloud keys stay in the OS keychain. Telemetry is off by default and limited to the explicit allowlist when a buyer opts in.
