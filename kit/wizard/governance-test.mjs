// Spine OS — governance-inclusion fold proof (Inc 3). Asserts buildPlan honours persona + strictness.
// Run: node governance-test.mjs   (exit 0 = green)
import { buildPlan } from './provision.mjs';
const p = { platform: 'darwin', arch: 'arm64' };
const rels = (f) => buildPlan(p, f).map((s) => s.rel);
const bodyOf = (f, rel) => (buildPlan(p, f).find((s) => s.rel === rel) || {}).body;
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };
const G = 'vault/20-GOVERNANCE';

// none → no overlay
ok('none: no Governance overlay', !rels({ governance: 'none' }).some((x) => x.startsWith(G)));
// light → ADR + SOP, no retention
{ const r = rels({ governance: 'light' });
  ok('light: ADR template present', r.includes(`${G}/ADR-template.md`));
  ok('light: SOP template present', r.includes(`${G}/SOP-template.md`));
  ok('light: NO retention clock', !r.includes(`${G}/retention-policy.md`)); }
// strict → retention + access-log
{ const r = rels({ governance: 'strict' });
  ok('strict: retention present', r.includes(`${G}/retention-policy.md`));
  ok('strict: access-log present', r.includes(`${G}/access-log.md`)); }
// persona seeds default strictness + jurisdiction-correct retention text
{ const r = rels({ persona: 'psychology' });
  ok('persona psychology → strict default (retention present)', r.includes(`${G}/retention-policy.md`));
  ok('persona psychology → AHPRA/APS retention text', /APS\/AHPRA|age 25/.test(bodyOf({ persona: 'psychology' }, `${G}/retention-policy.md`))); }
{ const r = rels({ persona: 'coaching' });
  ok('persona coaching → light default (no retention)', !r.includes(`${G}/retention-policy.md`));
  ok('persona coaching → still has ADR template', r.includes(`${G}/ADR-template.md`)); }
// explicit governance overrides persona default
ok('strict override on a light persona → retention present', rels({ persona: 'coaching', governance: 'strict' }).includes(`${G}/retention-policy.md`));
// DR-0014 seed semantics: governance files are write-once (shipped/edited files always win)
{ const steps = buildPlan(p, { governance: 'strict' });
  ok('governance overlay uses seed (write-once) steps', steps.filter((s) => s.rel.startsWith(G) && s.type !== 'mkdir').every((s) => s.type === 'seed')); }
// choice recorded in brand.local (so the vault + AI can read it)
ok('brand.local records persona+governance', /persona=legal/.test(bodyOf({ persona: 'legal' }, '_config/brand.local')) && /governance=strict/.test(bodyOf({ persona: 'legal' }, '_config/brand.local')));
// default (empty form) → light
{ const r = rels({});
  ok('default (empty form) → light overlay', r.includes(`${G}/ADR-template.md`) && !r.includes(`${G}/retention-policy.md`)); }

console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
