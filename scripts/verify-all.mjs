// One command for every check a contributor (or an AI) must run before a pull request.
// Run: node scripts/verify-all.mjs   (exit 0 = green). Free and local; no hosted CI minutes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wiz = path.join(repo, 'kit', 'wizard');
const tests = fs.readdirSync(wiz).filter((f) => /-test(-v2)?\.mjs$|pressure-test(-v2)?\.mjs$/.test(f)).sort();
let failed = [];
const run = (label, cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} · ${label} · ${last}`);
  if (r.status !== 0) { failed.push(label); console.log((r.stdout || '') + (r.stderr || '')); }
};
for (const t of tests) run(t, process.execPath, [t], wiz);
run('release pin (release.json + paste + README)', process.execPath, [path.join(repo, 'scripts', 'pin-release.mjs'), '--check'], repo);
run('windows-static-check', process.execPath, [path.join(repo, 'scripts', 'windows-static-check.mjs')], repo);

// version: one number, everywhere it is shown
const v = fs.readFileSync(path.join(repo, 'kit', 'VERSION'), 'utf8').trim();
const shown = {
  'installer-services.mjs': /INSTALLER_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(wiz, 'installer-services.mjs'), 'utf8'))?.[1],
  'status-board.json': JSON.parse(fs.readFileSync(path.join(repo, 'kit', 'status-board.json'), 'utf8')).meta?.version,
  'ui.html': /<span id="version">([^<]+)</.exec(fs.readFileSync(path.join(wiz, 'ui.html'), 'utf8'))?.[1],
  'CHANGELOG.md': /^## \[?(\d+\.\d+\.\d+)/m.exec(fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8'))?.[1],
};
const drift = Object.entries(shown).filter(([, x]) => x !== v);
console.log(`${drift.length ? 'FAIL' : 'PASS'} · version ${v} shown the same everywhere${drift.length ? ' · drift: ' + JSON.stringify(drift) : ''}`);
if (drift.length) failed.push('version');

// every MANIFEST path exists
const m = JSON.parse(fs.readFileSync(path.join(repo, 'MANIFEST.json'), 'utf8'));
const missing = [...m.elements, ...m.modules].flatMap((e) => e.files).filter((f) => !fs.existsSync(path.join(repo, f)));
console.log(`${missing.length ? 'FAIL' : 'PASS'} · every MANIFEST path exists${missing.length ? ' · missing: ' + missing.join(', ') : ''}`);
if (missing.length) failed.push('manifest');

// no secrets or personal data in the kit
const secretRe = /(sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{32,}|xkeysib-[a-f0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,})/;
const hits = fs.readdirSync(path.join(repo, 'kit'), { recursive: true }).map(String)
  .filter((f) => /\.(md|mjs|js|json|html|sh|ps1|cmd|txt|example|local)$/.test(f) && !f.includes('zenflow'))
  .filter((f) => secretRe.test(fs.readFileSync(path.join(repo, 'kit', f), 'utf8')));
console.log(`${hits.length ? 'FAIL' : 'PASS'} · no keys or tokens in the kit${hits.length ? ' · ' + hits.join(', ') : ''}`);
if (hits.length) failed.push('secrets');

console.log(`\n${failed.length ? '❌ FAIL: ' + failed.join(', ') : '✅ ALL GREEN'}`);
process.exit(failed.length ? 1 : 0);
