// Spine OS — K4 no-clobber update proof. Runs install.sh twice into a temp dir:
// fresh install, user edits files, bump kit VERSION, re-install (update mode).
// Asserts: user edits survive byte-true; changed kit files land beside as *.new-v<ver>;
// brand.local/status-board untouched. Run: node update-test.mjs  (exit 0 = green)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kitSrc = path.join(here, '..');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-update-test-'));
const src = path.join(tmp, 'kit');
const dest = path.join(tmp, 'wiki');
// Work on a throwaway copy of kit-src so the VERSION bump never touches the repo.
fs.cpSync(kitSrc, src, { recursive: true });
const run = (env = {}) =>
  execFileSync('bash', [path.join(src, 'install.sh')], {
    input: `${dest}\ny\n`, env: { ...process.env, ...env, SPINEOS_BRAND_NAME: 'Test Clinic' }, encoding: 'utf8',
  });

// 1 · fresh install
const out1 = run();
ok('fresh install completes', /Installed \d+ file\(s\)/.test(out1));
ok('marker written', fs.existsSync(path.join(dest, '.spine-os-root')));
ok('branded', /name=Test Clinic/.test(fs.readFileSync(path.join(dest, '_config/brand.local'), 'utf8')));

// 2 · user customises the files the kit says are theirs
const edited = '# MY EDITED CLAUDE.md — do not lose\n';
fs.writeFileSync(path.join(dest, 'CLAUDE.md'), edited);
const sb = path.join(dest, 'status-board.json');
const sbEdited = fs.readFileSync(sb, 'utf8').replace('{', '{ "user_edit": true,');
fs.writeFileSync(sb, sbEdited);

// 3 · new kit version with a changed CLAUDE.md + a brand-new file
fs.writeFileSync(path.join(src, 'VERSION'), '99.0.0\n');
fs.appendFileSync(path.join(src, 'CLAUDE.md'), '\n<!-- kit v99 change -->\n');
fs.writeFileSync(path.join(src, 'NEW-IN-99.md'), 'new file\n');

// 4 · re-install over the live wiki = update mode
const out2 = run({ SPINEOS_BRAND_NAME: 'WRONG BRAND' });
ok('update mode announced', /UPDATE complete/.test(out2));
ok('user CLAUDE.md untouched', fs.readFileSync(path.join(dest, 'CLAUDE.md'), 'utf8') === edited);
ok('changed file landed beside as .new-v99.0.0', fs.existsSync(path.join(dest, 'CLAUDE.md.new-v99.0.0')));
ok('beside copy is stamped (no raw token)', !fs.readFileSync(path.join(dest, 'CLAUDE.md.new-v99.0.0'), 'utf8').includes('__VAULT_PATH__'));
ok('user status-board.json untouched', fs.readFileSync(sb, 'utf8') === sbEdited);
ok('brand.local NOT reset', /name=Test Clinic/.test(fs.readFileSync(path.join(dest, '_config/brand.local'), 'utf8')));
ok('brand-new kit file added normally', fs.existsSync(path.join(dest, 'NEW-IN-99.md')));
ok('marker not rewritten (original version kept)', !/99\.0\.0/.test(fs.readFileSync(path.join(dest, '.spine-os-root'), 'utf8')));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
