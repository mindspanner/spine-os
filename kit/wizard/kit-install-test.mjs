// Spine OS — Inc 6 proof: the wizard IS the full-product installer.
// buildPlan({kitDir}) installs the entire kit payload with K4 no-clobber semantics.
// Run: node kit-install-test.mjs   (exit 0 = green)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probe, buildPlan, apply, resolveKitDir, consentRecord, teardown } from './provision.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };

const kitDir = resolveKitDir();
ok('kitDir resolves (wizard lives inside the kit)', !!kitDir && fs.existsSync(path.join(kitDir, 'dashboard.html')));

const p = probe();
const form = { brand: 'Kit Test Clinic', llm: 'claude', persona: 'psychology' };
const plan = buildPlan(p, form, { kitDir });
const kitFiles = plan.filter((s) => s.type === 'kitfile');
ok('plan includes the kit payload', kitFiles.length > 20);
ok('installer chrome excluded', !kitFiles.some((s) => /^(install\.sh|install\.command|install\.ps1|Install-on-Windows\.cmd|modules\/)|Install Spine-OS\.app|zenflow\//.test(s.rel)));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-kit-test-'));
const r1 = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
ok('full product lands (dashboard + CLAUDE.md + vault + wizard)',
  ['dashboard.html', 'CLAUDE.md', 'vault/20-GOVERNANCE/README.md', 'wizard/serve.mjs', 'status-board.js']
    .every((f) => fs.existsSync(path.join(root, f))));
ok('CLAUDE.md stamped with real path + brand', (() => {
  const c = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  return !c.includes('__VAULT_PATH__') && !c.includes('__BRAND__');
})());
ok('status-board.json branded', fs.readFileSync(path.join(root, 'status-board.json'), 'utf8').includes('Kit Test Clinic'));
ok('governance overlay merged into shipped 20-GOVERNANCE (retention beside worked SOPs)',
  fs.existsSync(path.join(root, 'vault/20-GOVERNANCE/retention-policy.md')) &&
  fs.existsSync(path.join(root, 'vault/20-GOVERNANCE/SOP-record-retention-AU.md')));

const r2 = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
ok('idempotent re-apply (wrote 0, no beside)', r2.wrote === 0 && r2.beside === 0);

// user edits a kit file → re-apply must land beside, never over (K4)
const edited = '# USER EDIT — must survive\n';
fs.writeFileSync(path.join(root, 'CLAUDE.md'), edited);
const r3 = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
ok('user edit survives re-apply', fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8') === edited);
ok('changed file landed beside as .new-v*', r3.beside >= 1 && fs.readdirSync(root).some((f) => /^CLAUDE\.md\.new-v/.test(f)));

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
