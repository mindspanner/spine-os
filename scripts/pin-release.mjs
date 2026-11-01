// Pins a SPINE-OS release: writes release.json (version, tag, every tracked file with sha256 and size,
// the newest changelog entries) and stamps the tag URL + SHA-256 of INSTALL-FOR-AI.md into the short
// paste (PASTE-SETUP.md) and README.md. Agents are told to read INSTALL-FOR-AI.md at the release TAG,
// never at main, so a later push to main cannot change what an install reads.
//   node scripts/pin-release.mjs           # write
//   node scripts/pin-release.mjs --check   # exit 1 when anything is out of date (verify-all runs this)
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const read = (f) => fs.readFileSync(path.join(repo, f));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const version = read('kit/VERSION').toString().trim();
const tag = `v${version}`;
const installUrl = `https://raw.githubusercontent.com/mindspanner/spine-os/${tag}/INSTALL-FOR-AI.md`;
const installSha = sha(read('INSTALL-FOR-AI.md'));

const stamp = (file) => {
  const before = read(file).toString();
  const after = before
    .replace(/https:\/\/raw\.githubusercontent\.com\/mindspanner\/spine-os\/v\d+\.\d+\.\d+\/INSTALL-FOR-AI\.md/g, installUrl)
    .replace(/(SHA-256 )[0-9a-f]{64}/g, `$1${installSha}`);
  return { file, before, after };
};
const changelog = read('CHANGELOG.md').toString().split(/^## /m).slice(1, 4).map((e) => {
  const [title, ...lines] = e.trim().split('\n');
  return { version: (/^\[?(\d+\.\d+\.\d+)/.exec(title) || [])[1] || title, title: title.trim(),
    notes: lines.filter((l) => /^- \*\*/.test(l)).map((l) => l.replace(/^- \*\*([^*]+)\*\*.*/, '$1').replace(/[:.]$/, '')).slice(0, 8) };
});
const stamped = ['PASTE-SETUP.md', 'README.md'].map(stamp);
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean)
  .filter((f) => f !== 'release.json' && fs.existsSync(path.join(repo, f))).sort();
const files = tracked.map((f) => {
  const s = stamped.find((x) => x.file === f);
  const buf = s ? Buffer.from(s.after) : read(f);
  return { path: f, sha256: sha(buf), bytes: buf.length };
});
const manifest = `${JSON.stringify({ name: 'spine-os', version, tag, install: { url: installUrl, sha256: installSha }, changelog, files }, null, 2)}\n`;
const stale = stamped.filter((s) => s.before !== s.after).map((s) => s.file);
const manifestPath = path.join(repo, 'release.json');
if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== manifest) stale.push('release.json');
if (check) {
  console.log(stale.length ? `FAIL · release pin out of date: ${stale.join(', ')} (run node scripts/pin-release.mjs)` : `PASS · release ${tag} pinned · INSTALL-FOR-AI.md ${installSha.slice(0, 12)}…`);
  process.exit(stale.length ? 1 : 0);
}
for (const s of stamped) if (s.before !== s.after) fs.writeFileSync(path.join(repo, s.file), s.after);
fs.writeFileSync(manifestPath, manifest);
console.log(`pinned ${tag} · INSTALL-FOR-AI.md sha256 ${installSha} · ${files.length} files in release.json`);
