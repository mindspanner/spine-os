// Spine OS — v1.8/v1.9 proof: optional extras, removals choice, one project tree, new personas, entry-point fix.
// Run: node modules-test.mjs   (exit 0 = green)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probe, buildPlan, apply, resolveKitDir, consentRecord, MODULE_IDS, selectedModules, REMOVAL_MODES } from './provision.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };
const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = resolveKitDir();
const p = probe();
// MANIFEST.json and PASTE-SETUP.md sit beside kit/ in the spine-os-advanced repo. A shipped copy of
// the kit (the website's kit-src) has neither, so those cross-checks report SKIP there.
const manifestPath = path.join(kitDir, '..', 'MANIFEST.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
if (!manifest) console.log('SKIP · MANIFEST / one-paste cross-checks (not in a repo checkout)');

// 1. MANIFEST, engine and installers agree on the module ids
if (manifest) {
ok('MANIFEST modules == engine MODULE_IDS', JSON.stringify(manifest.modules.map((m) => m.id)) === JSON.stringify(MODULE_IDS));
ok('every module has a plain-English question and files', manifest.modules.every((m) => /\?$/.test(m.ask) && fs.existsSync(path.join(kitDir, 'modules', m.id, 'files'))));
for (const installer of ['install.sh', 'install.ps1']) {
  const src = fs.readFileSync(path.join(kitDir, installer), 'utf8');
  ok(`${installer} asks every module question`, manifest.modules.every((m) => src.includes(m.ask)));
}
ok('MANIFEST personas are engine keys', manifest.personas.every((k) => /RETENTION/.test(fs.readFileSync(path.join(here, 'provision.mjs'), 'utf8')) &&
  new RegExp(`(^|[\\s{,])'?${k}'?:`, 'm').test(fs.readFileSync(path.join(here, 'provision.mjs'), 'utf8'))));
}

// 2. no modules → no module files; modules never ride along with the generic kit copy
const base = buildPlan(p, { brand: 'Base' }, { kitDir });
ok('modules/ excluded from the base payload', !base.some((s) => s.rel.startsWith('modules/')));
ok('Windows installer chrome excluded from the payload', !base.some((s) => /^(install\.ps1|Install-on-Windows\.cmd)$/.test(s.rel)));
ok('no parallel project trees (00_COMMAND / 10_PROJECTS)', !base.some((s) => /^(00_COMMAND|10_PROJECTS)(\/|$)/.test(s.rel)));
ok('.spineosignore ships in every install', base.some((s) => s.rel === '.spineosignore'));
ok('security baseline + naming + keeping-current SOPs ship in core', ['SECURITY-BASELINE.md', 'SOP-naming-and-filing.md', 'SOP-keeping-current.md']
  .every((f) => base.some((s) => s.rel === `vault/20-GOVERNANCE/${f}`)));

// 3. chosen modules land; unknown ids are ignored
ok('unknown module ids ignored', JSON.stringify(selectedModules({ modules: ['casework', 'evil', '../x'] }, kitDir)) === '["casework"]');
const form = { brand: 'Module Clinic', persona: 'social-work', modules: [...MODULE_IDS] };
const plan = buildPlan(p, form, { kitDir });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-mod-test-'));
apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
const has = (rel) => fs.existsSync(path.join(root, rel));
ok('documents module landed', has('vault/40-DOCUMENTS/README.md') && has('vault/40-DOCUMENTS/admin/.keep'));
ok('casework module landed', has('vault/30-CLIENTS/_CASE-TEMPLATE/notes/_NOTE-TEMPLATE.md') && has('vault/30-CLIENTS/_CODE-KEY.md'));
ok('reminders module landed', has('vault/REMINDERS.md') && has('vault/systems/Reminders.md'));
ok('email module landed', has('vault/systems/Email-Help.md') && has('vault/systems/email-templates/follow-up.md'));
ok('skills module landed (8 skills with frontmatter)', fs.readdirSync(path.join(root, '.claude/skills')).filter((d) =>
  /^---\nname: [a-z-]+\ndescription: .+\n---/.test(fs.existsSync(path.join(root, '.claude/skills', d, 'SKILL.md')) ? fs.readFileSync(path.join(root, '.claude/skills', d, 'SKILL.md'), 'utf8') : '')).length === 8);
ok('code key is on the privacy list', fs.readFileSync(path.join(root, '.spineosignore'), 'utf8').includes('vault/30-CLIENTS/_CODE-KEY.md'));
ok('profile records modules', JSON.parse(fs.readFileSync(path.join(root, '_config/profile.json'), 'utf8')).modules.length === MODULE_IDS.length);
ok('social-work persona → strict retention seeded', /AASW/.test(fs.readFileSync(path.join(root, 'vault/20-GOVERNANCE/retention-policy.md'), 'utf8')));
const again = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
ok('module re-apply idempotent', again.wrote === 0 && again.beside === 0);
fs.writeFileSync(path.join(root, 'vault/REMINDERS.md'), '# mine\n');
const third = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }), form });
ok('edited module file survives; update lands beside', fs.readFileSync(path.join(root, 'vault/REMINDERS.md'), 'utf8') === '# mine\n' && third.beside >= 1);
fs.rmSync(root, { recursive: true, force: true });

// 3b. v1.9 removals: one question everywhere, never a permanent-delete option, guard ships in core
const REMOVALS_ASK = 'When you or your AI remove a file, where should it go?';
if (manifest) ok('MANIFEST removals question + options == engine', manifest.removals.ask === REMOVALS_ASK &&
  JSON.stringify(manifest.removals.options.map((o) => o.id)) === JSON.stringify(REMOVAL_MODES));
for (const installer of ['install.sh', 'install.ps1', 'wizard/ui.html', ...(manifest ? ['../INSTALL-FOR-AI.md'] : [])]) {
  const src = fs.readFileSync(path.join(kitDir, installer), 'utf8');
  ok(`${installer} asks the removals question once`, src.split(REMOVALS_ASK).length - 1 === 1);
  ok(`${installer} never offers a permanent delete at setup`, !/permanent(ly)? delete[^\n]{0,40}\(suggested\)|value="delete"|4\s+Delete/i.test(src));
}
ok('guard + settings + Archive + SOP ship in every install', ['.claude/settings.json', '.claude/hooks/delete-guard.mjs', '.claude/hooks/delete-guard.sh',
  'vault/90-ARCHIVE/README.md', 'vault/20-GOVERNANCE/SOP-removing-files.md'].every((rel) => base.some((s) => s.rel === rel)));
for (const mode of [...REMOVAL_MODES, undefined, 'delete']) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-rem-test-'));
  apply(r, buildPlan(p, { brand: 'Rem', removals: mode }, { kitDir }), { consent: consentRecord({ machineId: p.machineId }), form: { brand: 'Rem', removals: mode } });
  const want = REMOVAL_MODES.includes(mode) ? mode : 'archive';
  const claude = fs.readFileSync(path.join(r, 'CLAUDE.md'), 'utf8');
  ok(`removals=${mode} → mode=${want} recorded, CLAUDE.md stamped`, fs.readFileSync(path.join(r, '_config/removals.local'), 'utf8').includes(`mode=${want}\n`) &&
    !claude.includes('__REMOVALS__') && /§9 · Removing files/.test(claude));
  fs.rmSync(r, { recursive: true, force: true });
}

// 4. CLI entry point runs from a folder whose path has spaces (the old file:// check silently did nothing)
const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos space test '));
fs.cpSync(kitDir, path.join(spaced, 'kit copy'), { recursive: true, filter: (s) => !/zenflow|\.mp4$/.test(s) });
const run = spawnSync(process.execPath, [path.join(spaced, 'kit copy', 'wizard', 'provision.mjs')], { encoding: 'utf8' });
ok('provision.mjs CLI runs from a path with spaces', run.status === 0 && /\[provision\] PLAN:/.test(run.stdout));
const sb = /sandbox kept for inspection: (.+)\n/.exec(run.stdout);
if (sb) fs.rmSync(sb[1].trim(), { recursive: true, force: true });
fs.rmSync(spaced, { recursive: true, force: true });

console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
