// Windows path check without a Windows machine: the rules that break installs on Windows
// PowerShell 5.1 (the version every Windows 10/11 PC has) and on double-click, checked by reading
// the files. Pair it with the real-PowerShell run in judge-fresh-install.sh.
// Run: node scripts/windows-static-check.mjs   (exit 0 = green)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'kit');
const ps1 = fs.readFileSync(path.join(kit, 'install.ps1'), 'utf8');
const cmd = fs.readFileSync(path.join(kit, 'Install-on-Windows.cmd'), 'utf8');
const prov = fs.readFileSync(path.join(kit, 'wizard', 'provision.mjs'), 'utf8');
const code = ps1.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };

ok('install.ps1 is pure ASCII (5.1 reads BOM-less files as ANSI)', !/[^\x00-\x7F]/.test(ps1));
ok('no PowerShell 7-only operators (?? ?. ternary && ||)', !/\?\?|\?\.|\s\?\s[^:]+\s:\s|&&|\|\|/.test(code));
ok('no -AsHashtable / ConvertFrom-Json -Depth (7-only)', !/-AsHashtable|ConvertFrom-Json\s+-Depth/.test(code));
ok('writes UTF-8 without BOM (no Set-Content/Out-File -Encoding UTF8)', /UTF8Encoding\(\$false\)/.test(ps1) && !/(Set-Content|Out-File|Add-Content)[^\n]*-Encoding/.test(code));
ok('LiteralPath used for user paths (brackets in folder names)', !/Test-Path\s+\$(Dest|target|f)\b/.test(code));
ok('refuses drive roots, Users, Windows, Program Files', /\\Users"/.test(ps1) && /Program Files/.test(ps1) && /\^\[A-Za-z\]:\$/.test(ps1));
ok('260-character path guard', /Length -gt 220/.test(ps1));
ok('OneDrive warning', /OneDrive/.test(ps1));
ok('hidden files compared with -Force', !/Get-Item -LiteralPath \$[ab]\)/.test(code));
ok('Install-on-Windows.cmd uses CRLF line endings', /\r\n/.test(cmd) && !/[^\r]\n/.test(cmd));
ok('.cmd runs the script beside it, quoted, policy bypassed for this run only', /-ExecutionPolicy Bypass -File "%~dp0install\.ps1"/.test(cmd));
ok('.cmd keeps the window open at the end', /\bpause\b/i.test(cmd));
ok('provision.mjs entry point is Windows-safe (pathToFileURL + realpath)', /pathToFileURL\(fs\.realpathSync\(process\.argv\[1\]\)\)/.test(prov));
ok('provision.mjs expands ~\\ and refuses Windows roots', /\^~\[\\\\\/\]/.test(prov) && /winRefused/.test(prov));
ok('.gitattributes pins line endings', (() => { try { const g = fs.readFileSync(path.join(kit, '..', '.gitattributes'), 'utf8'); return /\*\.cmd\s+text eol=crlf/.test(g) && /\*\.sh\s+text eol=lf/.test(g); } catch { return false; } })());

console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
