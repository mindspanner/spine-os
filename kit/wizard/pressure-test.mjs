// Spine OS — provisioner pressure-test · L8 · S53 2026-06-05
// Runs the REAL provisioner code path against a sandbox root and asserts duty-of-care invariants.
// Proof artefact: writes a report to ../zenflow/_review/v4-L8-pressure-test.json. Exit 0 = all green.
//
//   node pressure-test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probe, resolveRoot, buildPlan, apply, consentRecord, teardown } from './provision.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { (cond ? pass++ : fail++); results.push({ name, ok: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`); };

// fixture probe so the test is deterministic across machines
const fixture = { platform: 'linux', arch: 'x64', release: 'test', cpus: 4, totalMemGB: 16, freeDiskGB: 200, monitors: null, machineId: 'TEST-MACHINE-0001' };
const fixPath = path.join(os.tmpdir(), 'spineos-fix.json');
fs.writeFileSync(fixPath, JSON.stringify(fixture));
process.env.SPINEOS_FIXTURE = fixPath;

const p = probe();
ok('probe is read-only + fixture honoured', p.machineId === 'TEST-MACHINE-0001');

const { root, sandbox } = resolveRoot({ apply: false });
ok('default mode is SANDBOX (no --apply)', sandbox === true, root);
ok('sandbox root is under os.tmpdir()', path.resolve(root).startsWith(path.resolve(os.tmpdir())));

const plan = buildPlan(p, { brand: 'Pressure Test Co', llm: 'gpt' });
const consent = consentRecord({ machineId: p.machineId });

// first apply
const r1 = apply(root, plan, { consent });
ok('first apply wrote files', r1.wrote > 0, `wrote=${r1.wrote}`);

// invariant: NO ledger path escapes the sandbox root
const escapes = r1.ledger.filter((l) => l.path.startsWith('..') || path.isAbsolute(l.path));
ok('no write escaped sandbox root', escapes.length === 0, `escapes=${escapes.length}`);

// invariant: consent record valid + accepted
const consentOnDisk = JSON.parse(fs.readFileSync(path.join(root, 'consent-record.json'), 'utf8'));
ok('consent recorded before business logic', consentOnDisk.accepted === true && /^[a-f0-9]{64}$/.test(consentOnDisk.eula_sha256) && consentOnDisk.template_version === 'v1');

// invariant: idempotent re-run = zero new writes
const r2 = apply(root, plan, { consent });
ok('idempotent re-run (0 new writes)', r2.wrote === 0, `wrote=${r2.wrote} skipped=${r2.skipped}`);

// invariant: path-escape guard actually throws
let guardThrew = false;
try { apply(root, [{ type: 'write', rel: '../../escape.txt', body: 'x' }]); } catch { guardThrew = true; }
ok('path-escape guard blocks ../ writes', guardThrew);

// invariant: teardown removes the sandbox and refuses non-sandbox paths
teardown(root);
ok('teardown removed sandbox root', !fs.existsSync(root));
let refused = false; try { teardown('/etc'); } catch { refused = true; }
ok('teardown refuses non-sandbox path', refused);

// report
const report = { lane: 'L8', utc: new Date().toISOString(), pass, fail, ok: fail === 0, results };
const outDir = path.join(here, '..', 'zenflow', '_review');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'v4-L8-pressure-test.json'), JSON.stringify(report, null, 2));
fs.rmSync(fixPath, { force: true });
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAILURES'} — pass=${pass} fail=${fail} · report: zenflow/_review/v4-L8-pressure-test.json`);
process.exit(fail === 0 ? 0 : 1);
