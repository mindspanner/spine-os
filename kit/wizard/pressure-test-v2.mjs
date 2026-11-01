// Spine OS — wizard pressure-test v2 · S67 2026-06-12
// Supersets pressure-test.mjs (the original 10 invariants are re-run first via child process),
// then adds the S67 cases: abort/resume · partial-state recovery · consent-declined ·
// no-network static + runtime · readonly-filesystem grace · uninstall cleanliness ·
// --apply vs dry-run parity · absolute-path escape · full UI-server contract (CSRF, gates, CSP).
// All sandboxed. Exit 0 = green. Report -> ../zenflow/_review/v5-S67-pressure-test-v2.json

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probe, resolveRoot, buildPlan, apply, consentRecord, teardown } from './provision.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const HERO_VIDEO_SHA256 = '30c66f9e46d5c63a7fecd87abbdd2f4abbc368b2587f2c26b6f2a27218e8db66';
const HERO_AUTOPLAY_SHA256 = '7bfa8048f4e75a3ad1bb54555b87654668590d2c3f7588a95fde19a644dbd1b0';
let pass = 0, fail = 0; const checks = [];
const ok = (name, cond, detail = '') => { (cond ? pass++ : fail++); checks.push({ name, ok: !!cond, detail: String(detail) }); console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${detail ? ' · ' + detail : ''}`); };

// ---- 0. original 10 invariants still green (run the untouched v1 harness) ----
let v1ok = false, v1out = '';
try { v1out = execFileSync(process.execPath, [path.join(here, 'pressure-test.mjs')], { encoding: 'utf8' }); v1ok = /pass=10 fail=0/.test(v1out); } catch (e) { v1out = String(e.stdout || e.message); }
ok('v1 harness still 10/10 (no regression)', v1ok);

const FIX = path.join(os.tmpdir(), 'spineos-fixture-' + Date.now() + '.json');
fs.writeFileSync(FIX, JSON.stringify({ platform: 'darwin', arch: 'arm64', release: 'test', cpus: 8, totalMemGB: 16, freeDiskGB: 100, monitors: 1, machineId: 'fixture-machine-0001' }));
const fixedProbe = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const form = { brand: 'PT2 Clinic', llm: 'claude', connectors: ['payments', 'email'] };
const connectorPlan = buildPlan(fixedProbe, form);
ok('connector selections create secret-free in-root scaffolds',
  connectorPlan.some((s) => s.rel === '_config/connectors/payments.example') &&
  connectorPlan.some((s) => s.rel === '_config/connectors/email.example') &&
  !connectorPlan.some((s) => s.rel === '_config/connectors/booking.example'));

// ---- 1. abort/resume mid-step: apply only half the plan, then resume with the full plan ----
{
  const { root } = resolveRoot({});
  const plan = buildPlan(fixedProbe, form);
  const half = plan.slice(0, Math.ceil(plan.length / 2));
  const r1 = apply(root, half, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  const r2 = apply(root, plan, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  const allThere = plan.filter(s => s.type === 'write' || s.type === 'seed').every(s => fs.existsSync(path.join(root, s.rel)));
  ok('abort/resume: partial apply then full apply completes', allThere, `firstWrote=${r1.wrote} resumedWrote=${r2.wrote}`);
  const r3 = apply(root, plan, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  ok('abort/resume: post-resume re-run is idempotent', r3.wrote === 0, `wrote=${r3.wrote}`);
  teardown(root);
}

// ---- 2. partial-state recovery: delete a provisioned file, re-apply restores byte-identical ----
{
  const { root } = resolveRoot({});
  const plan = buildPlan(fixedProbe, form);
  apply(root, plan, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  const victim = plan.find(s => s.type === 'write' || s.type === 'seed');
  const abs = path.join(root, victim.rel);
  const before = sha256(fs.readFileSync(abs, 'utf8'));
  fs.rmSync(abs);
  apply(root, plan, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  const after = fs.existsSync(abs) ? sha256(fs.readFileSync(abs, 'utf8')) : null;
  ok('partial-state recovery: deleted file restored byte-identical', before === after, victim.rel);
  teardown(root);
}

// ---- 3. --apply vs dry-run parity: identical plan for identical inputs ----
{
  const planA = buildPlan(fixedProbe, form);
  const planB = buildPlan(fixedProbe, form);
  ok('apply/dry-run parity: plan is deterministic for same probe+form', JSON.stringify(planA) === JSON.stringify(planB));
  const realRoot = resolveRoot({ apply: true });
  ok('apply/dry-run parity: only the ROOT differs (real root never under tmp)', realRoot.sandbox === false && !path.resolve(realRoot.root).startsWith(path.resolve(os.tmpdir())) , realRoot.root);
  const customParent = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-custom-parent-'));
  const custom = resolveRoot({ apply: true, realRoot: path.join(customParent, 'Chosen-SpineOS') });
  ok('chosen real root resolves inside its existing parent', custom.root === path.join(fs.realpathSync(customParent), 'Chosen-SpineOS'));
  let traversalRefused = false;
  try { resolveRoot({ apply: true, realRoot: `${customParent}/../escape` }); } catch { traversalRefused = true; }
  ok('chosen real root refuses traversal components', traversalRefused);
  fs.rmSync(customParent, { recursive: true, force: true });
  // NOTE: we never write to the real root in tests.
}

// ---- 4. absolute-path escape blocked ----
{
  const { root } = resolveRoot({});
  let threw = false;
  try { apply(root, [{ type: 'write', rel: '/etc/spineos-escape-test', body: 'x' }]); } catch { threw = true; }
  ok('escape: absolute-path write blocked', threw && !fs.existsSync('/etc/spineos-escape-test'));
  teardown(root);
}

// ---- 5. readonly filesystem: graceful refusal, no crash, no partial garbage outside root ----
{
  const { root } = resolveRoot({});
  const plan = buildPlan(fixedProbe, form);
  apply(root, plan, { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  const lockDir = path.join(root, '_config');
  fs.chmodSync(lockDir, 0o555);
  let graceful = false;
  try { apply(root, [{ type: 'write', rel: '_config/new-thing.local', body: 'x' }]); } catch (e) { graceful = /EACCES|EPERM|permission/i.test(String(e.message)); }
  ok('readonly fs: write into chmod-555 dir refused gracefully (typed error, no crash)', graceful);
  fs.chmodSync(lockDir, 0o755);
  teardown(root);
  ok('readonly fs: teardown still clean after perm restore', !fs.existsSync(root));
}

// ---- 6. uninstall/rollback cleanliness: nested tree fully removed ----
{
  const { root } = resolveRoot({});
  apply(root, buildPlan(fixedProbe, form), { consent: consentRecord({ machineId: fixedProbe.machineId }) });
  fs.mkdirSync(path.join(root, '10_PROJECTS/_TEMPLATE/deep/deeper'), { recursive: true });
  fs.writeFileSync(path.join(root, '10_PROJECTS/_TEMPLATE/deep/deeper/file.md'), 'x');
  teardown(root);
  ok('uninstall: deep nested sandbox fully removed', !fs.existsSync(root));
}

// ---- 7. no-network static scan: wizard surface makes no outbound calls ----
{
  const files = ['provision.mjs', 'serve.mjs', 'ui.html'].map(f => fs.readFileSync(path.join(here, f), 'utf8'));
  // P3: the promise is now "zero outbound EXCEPT one opt-in install ping". The single
  // allowed endpoint may appear exactly once, only in serve.mjs's telemetry route
  // (whose opt-in gate is separately proven end-to-end by telemetry-test.mjs), plus
  // the user-facing ollama.com install POINTER in the UI (a label, never fetched).
  const TELEMETRY = 'https://app.mindspan.com.au/api/spineos-telemetry';
  const scrub = (src) => src
    .replace(/xmlns='http:\/\/www\.w3\.org[^']*'/g, '').replace(/xmlns="http:\/\/www\.w3\.org[^"]*"/g, '')
    .split(TELEMETRY).join('').replace(/install ollama\.com/g, '');
  const outbound = files.some(src => /https?:\/\/(?!127\.0\.0\.1)[a-z0-9]/i.test(scrub(src)));
  ok('no-network: zero non-loopback URLs beyond the single opt-in telemetry endpoint', !outbound);
  ok('no-network: telemetry endpoint appears exactly once, in serve.mjs only', files[1].split(TELEMETRY).length === 2 && !files[0].includes(TELEMETRY) && !files[2].includes(TELEMETRY));
  ok('no-network: telemetry send is opt-in gated', /optIn !== true\) return json\(res, 200, \{ sent: false/.test(files[1]));
  ok('no-network: server binds 127.0.0.1 explicitly', /listen\(portArg, '127\.0\.0\.1'/.test(files[1]));
  ok('no-network: ui fetches are relative-only', !/fetch\(['"]https?:/.test(files[2]));
  // regression guard (S67 catch): EULA Accept must stay disabled while the box is display:none —
  // clientHeight 0 must never satisfy the scroll-to-end test
  ok('eula hard-gate: hidden-box race guarded in atEnd()', /clientHeight > 0 &&/.test(files[2]));
}

// ---- 8. UI server contract (boot real server on ephemeral port) ----
await (async () => {
  const srv = spawn(process.execPath, [path.join(here, 'serve.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let line = '';
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server boot timeout')), 8000);
    srv.stdout.on('data', (d) => { line += d; if (/\[wizard-ui\]/.test(line)) { clearTimeout(t); res(); } });
    srv.stderr.on('data', (d) => { line += d; });
  }).catch(e => ok('ui-server: boots', false, e.message + ' :: ' + line));
  const m = line.match(/http:\/\/127\.0\.0\.1:(\d+)\//); const tok = (line.match(/token=([0-9a-f]+)/) || [])[1];
  if (m) {
    const base = `http://127.0.0.1:${m[1]}`;
    ok('ui-server: boots on loopback ephemeral port', true, base);
    const home = await fetch(base + '/');
    const csp = home.headers.get('content-security-policy') || '';
    ok('ui-server: UI serves 200 with CSP (no remote origins; local intro/icon allowed)',
      home.status === 200 && /default-src 'none'/.test(csp) && /media-src 'self'/.test(csp) && /img-src 'self' data:/.test(csp));
    const html = await home.text();
    ok('ui-server: CSRF token injected into UI (not the placeholder)', !html.includes('__SPINEOS_TOKEN__'));
    ok('ui-server: full shared splash is embedded in the production wizard',
      /id="splashMotion" src="\/splash-poster\.jpg"/.test(html) &&
      /id="splashVideo"[\s\S]+src="\/splash\.mp4"/.test(html) &&
      /id="splashSound"/.test(html) && /id="splashSkip"/.test(html) &&
      /prefers-reduced-motion/.test(html) && /armSplashTimeout\(10500\)/.test(html));
    const animation = await fetch(base + '/splash-autoplay.webp');
    const animationBuf = Buffer.from(await animation.arrayBuffer());
    ok('ui-server: automatic 10-second visual derivative is served',
      animation.status === 200 && animation.headers.get('content-type') === 'image/webp' &&
      sha256(animationBuf) === '23435832ba75b6bf883e3dd8b17f466ce68c90637ad8909ab079175d67c9b7e4' &&
      animationBuf.length === 2_786_938,
      `${sha256(animationBuf)} · ${animationBuf.length} bytes`);
    // v1.8: the two hero MP4s are release assets, not tracked in this repo (size). Their checks run
    // where the files exist (the packaged app) and are reported as SKIP here, never as a false PASS.
    if (fs.existsSync(path.join(here, 'splash.mp4')) && fs.existsSync(path.join(here, 'splash-autoplay.mp4'))) {
      const splashVid = await fetch(base + '/splash.mp4');
      const splashBuf = Buffer.from(await splashVid.arrayBuffer());
      ok('ui-server: splash video serves 200 as video/mp4, byte-identical to source',
        splashVid.status === 200 && splashVid.headers.get('content-type') === 'video/mp4' &&
        splashVid.headers.get('accept-ranges') === 'bytes' &&
        splashBuf.equals(fs.readFileSync(path.join(here, 'splash.mp4'))));
      ok('ui-server: exact governed 10-second hero video is served',
        sha256(splashBuf) === HERO_VIDEO_SHA256 && splashBuf.length === 371_887,
        `${sha256(splashBuf)} · ${splashBuf.length} bytes`);
      const autoplayVid = await fetch(base + '/splash-autoplay.mp4');
      const autoplayBuf = Buffer.from(await autoplayVid.arrayBuffer());
      ok('ui-server: exact 10-second fast-start autoplay derivative is served',
        autoplayVid.status === 200 && sha256(autoplayBuf) === HERO_AUTOPLAY_SHA256 &&
        autoplayBuf.length === 1_387_800,
        `${sha256(autoplayBuf)} · ${autoplayBuf.length} bytes`);
      // WebKit's video engine requires this to play at all — regression-guard it explicitly.
      const fullVid = fs.readFileSync(path.join(here, 'splash.mp4'));
      const rangeVid = await fetch(base + '/splash.mp4', { headers: { range: 'bytes=0-99' } });
      const rangeBuf = Buffer.from(await rangeVid.arrayBuffer());
      ok('ui-server: splash video honours Range requests (206, correct slice)',
        rangeVid.status === 206 && rangeVid.headers.get('content-range') === `bytes 0-99/${fullVid.length}` &&
        rangeBuf.equals(fullVid.subarray(0, 100)));
      const suffixVid = await fetch(base + '/splash.mp4', { headers: { range: 'bytes=-512' } });
      const suffixBuf = Buffer.from(await suffixVid.arrayBuffer());
      ok('ui-server: splash video honours WebKit suffix ranges',
        suffixVid.status === 206 &&
        suffixVid.headers.get('content-range') === `bytes ${fullVid.length - 512}-${fullVid.length - 1}/${fullVid.length}` &&
        suffixBuf.equals(fullVid.subarray(-512)));
    } else {
      console.log('SKIP · ui-server: hero MP4 checks (splash.mp4 / splash-autoplay.mp4 are release assets, absent here)');
    }
    // Guaranteed branded frame regardless of webview autoplay policy (S1 finding: some
    // platforms silently refuse video autoplay even when muted — see ui.html videoDone()).
    const poster = await fetch(base + '/splash-poster.jpg');
    const posterBuf = Buffer.from(await poster.arrayBuffer());
    const icon = await fetch(base + '/spine-os-icon.png');
    const iconBuf = Buffer.from(await icon.arrayBuffer());
    ok('ui-server: splash poster + canonical icon serve byte-identical local assets',
      poster.status === 200 && poster.headers.get('content-type') === 'image/jpeg' &&
      posterBuf.equals(fs.readFileSync(path.join(here, 'splash-poster.jpg'))) &&
      icon.status === 200 && icon.headers.get('content-type') === 'image/png' &&
      iconBuf.equals(fs.readFileSync(path.join(here, 'spine-os-icon.png'))));
    const noTok = await fetch(base + '/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    ok('ui-server: POST without token → 403', noTok.status === 403);
    const eula = await (await fetch(base + '/api/eula')).json();
    ok('ui-server: EULA endpoint serves the SSOT final + sha', eula.version === 'v1.2-FINAL' && /^[0-9a-f]{64}$/.test(eula.sha256));
    const planR = await (await fetch(base + '/api/plan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ form }) })).json();
    ok('ui-server: plan endpoint returns full plan (writes nothing)', Array.isArray(planR.plan) && planR.plan.length >= 8);
    const noConsent = await fetch(base + '/api/apply', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ form }) });
    ok('ui-server: consent-declined apply → 409 refused', noConsent.status === 409);
    const acceptedConsent = { accepted: true, accepted_at: new Date().toISOString(), eula_sha256: eula.sha256 };
    const realTry = await fetch(base + '/api/apply', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ form, target: 'real', confirm: 'APPLY-REAL', consent: acceptedConsent }) });
    ok('ui-server: real-root apply without --allow-real → 403', realTry.status === 403);
    const applyR = await (await fetch(base + '/api/apply', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ form, consent: acceptedConsent }) })).json();
    ok('ui-server: consented sandbox apply writes + consent record + ledger', applyR.sandbox === true && applyR.wrote >= 3 && fs.existsSync(path.join(applyR.root, 'consent-record.json')) && fs.existsSync(path.join(applyR.root, '_provision-ledger.jsonl')));
    const st = await (await fetch(base + '/api/selftest', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: '{}' })).json();
    ok('ui-server: green/red self-test = GREEN', st.green === true, st.checks ? st.checks.map(c => (c.ok ? '✓' : '✗') + c.name).join(',') : st.error);
    const td = await (await fetch(base + '/api/teardown', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ root: applyR.root }) })).json();
    ok('ui-server: teardown removes the sandbox', td.removed === applyR.root && !fs.existsSync(applyR.root));
    const tdEvil = await fetch(base + '/api/teardown', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': tok }, body: JSON.stringify({ root: os.homedir() }) });
    ok('ui-server: teardown refuses non-sandbox path (403)', tdEvil.status === 403);
  }
  srv.kill();
})();

fs.rmSync(FIX, { force: true });
const report = { lane: 'S67-PT2', utc: new Date().toISOString(), pass, fail, ok: fail === 0, checks };
fs.mkdirSync(path.join(here, '..', 'zenflow', '_review'), { recursive: true });
fs.writeFileSync(path.join(here, '..', 'zenflow', '_review', 'v5-S67-pressure-test-v2.json'), JSON.stringify(report, null, 2));
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAILURES'} — pass=${pass} fail=${fail} · report: zenflow/_review/v5-S67-pressure-test-v2.json`);
process.exit(fail === 0 ? 0 : 1);
