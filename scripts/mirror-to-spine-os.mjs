// Mirrors this repo into a local clone of github.com/mindspanner/spine-os, file for file, so the public
// repo always equals the latest spine-os-advanced release. Run after a release is merged:
//   node scripts/pin-release.mjs --check && node scripts/mirror-to-spine-os.mjs <path-to-spine-os-clone>
// It copies every tracked file and unstages (git rm) files that are no longer in this repo, inside the
// clone only. It never commits, pushes or tags: review `git status` there, then commit, PR, merge, tag.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target || !fs.existsSync(path.join(target, '.git'))) { console.error('usage: node scripts/mirror-to-spine-os.mjs <path-to-spine-os-clone>'); process.exit(1); }
if (path.resolve(target) === path.resolve(repo)) { console.error('target is this repo'); process.exit(1); }
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: target, encoding: 'utf8' }).trim();
if (!/mindspanner\/spine-os(\.git)?$/.test(remote)) { console.error(`refusing: target origin is ${remote}, not mindspanner/spine-os`); process.exit(1); }
execFileSync(process.execPath, [path.join(repo, 'scripts', 'pin-release.mjs'), '--check'], { stdio: 'inherit' });

const list = (cwd) => execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
const src = list(repo);
let copied = 0, same = 0;
for (const f of src) {
  if (f.split('/').includes('..')) continue;
  const from = path.join(repo, f), to = path.join(target, f);
  const buf = fs.readFileSync(from);
  if (fs.existsSync(to) && fs.readFileSync(to).equals(buf)) { same++; continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf, { mode: fs.statSync(from).mode });
  copied++;
}
const gone = list(target).filter((f) => !src.includes(f));
for (const f of gone) execFileSync('git', ['rm', '-q', '--', f], { cwd: target });
execFileSync('git', ['add', '-A', '--', ...src], { cwd: target });
console.log(`mirrored ${src.length} files into ${target} · changed ${copied} · unchanged ${same} · no longer shipped (git rm): ${gone.join(', ') || 'none'}`);
