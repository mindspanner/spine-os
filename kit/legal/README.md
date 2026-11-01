# Spine OS — Legal layer (DRAFTS) · L10

> **HARD GATE — read first.** Everything in this folder is a **draft prepared by Cowork as a drafting aid, NOT legal advice.** A qualified Australian lawyer must review and sign off each document before it appears on any live, transacting, or client-facing surface. Cowork drafts + scans visible claims; it never asserts legal sufficiency.

## Files
| File | Purpose | Status |
|---|---|---|
| `ecosystem-disclosures-template-v1.md` | **Canonical, versioned disclosures/disclaimers** for the whole Mindspan ecosystem. Authored once; referenced by every surface (operator directive 2026-06-05). | DRAFT v1 |
| `spineos-EULA-v1.2.md` | End-User Licence Agreement (licence-not-sale; no resale of template). In force from 28 Sep 2026; also the kit's `LICENSE.txt`. | FINAL v1.2 (ABN correction only; matches app.mindspan.com.au/legal/spine-os/eula) |
| `spineos-EULA-v1.1.md` | The v1.1 text exactly as accepted (19 Jul 2026), kept unedited as the record. | SUPERSEDED by v1.2 |
| `spineos-disclaimer-liability-v1.2.md` | As-is disclaimer + ACL-aware liability cap. In force from 28 Sep 2026. | FINAL v1.2 (ABN correction only; matches app.mindspan.com.au/legal/spine-os/disclaimer) |
| `spineos-disclaimer-liability-v1.1.md` | The v1.1 text exactly as accepted (19 Jul 2026), kept unedited as the record. | SUPERSEDED by v1.2 |
| `spineos-privacy-data-handling-v0.1-DRAFT.md` | Local-first privacy / data-handling statement. | FINAL v1.1 (matches app.mindspan.com.au/legal/spine-os) |
| `consent-record-schema-v1.json` | Schema for the wizard splash/consent ceremony record (§3.8a). | DRAFT v1 |
| `legal-padding-claim-scan-2026-06-05.md` | Scan over every visible claim on the landing page vs the bright-lines. | FINAL v1.1 (matches app.mindspan.com.au/legal/spine-os) |

## Design principle (why a template, not bespoke copy)
The operator's objection was that legal text had become **welded to Spine OS's marketing**. Fix: legal posture is an **ecosystem property**, defined once in the template and **referenced** by each surface (CLAUDE.md §8 — information lives in one place). The Spine OS footer, EULA, and wizard consent gate all render *instances* of the template's blocks, so wording stays consistent and auditable across products.

## What the footer renders (block map)
Spine OS landing footer = template blocks **D1** (entity/trademarks) · **D2** (nature/regulator-distancing) · **D3** (no certification) · **D4** (as-is) · **D5** (local-first data) · **D7** (pricing state). No specific regulator is named in product copy.

## Before go-live (operator checklist excerpt)
1. Australian lawyer reviews `ecosystem-disclosures-template-v1.md` + the three Spine OS drafts.
2. Finalise EULA/disclaimer/privacy → replace the footer `details` summary stubs with links to published policies.
3. Confirm the wizard writes a `consent-record-schema-v1` record before any business logic.
4. Re-run `legal-padding-claim-scan` after any copy change.
