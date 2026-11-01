// Spine OS — wizard UI server (dependency-free) · S67 2026-06-12
// Serves the local wizard UI and bridges it to the PROVEN provisioner core (provision.mjs).
// Re-implements NOTHING: probe/buildPlan/apply/consentRecord/teardown are imported, not copied.
//
// Safety posture (inherits + extends the provisioner mandate):
//   · binds 127.0.0.1 ONLY — never reachable off-machine; no outbound network calls at all
//   · SANDBOX BY DEFAULT — /api/apply writes into a throwaway os.tmpdir() sandbox unless the
//     server was started with --allow-real AND the request body carries {target:"real", confirm:"APPLY-REAL"}
//   · consent-first — /api/apply REFUSES (409) unless the request carries the consent object
//     produced by the UI's EULA hard-gate; the consent record is written before business files
//   · CSRF token minted per boot; every POST must echo it in the x-spineos-token header
//   · CSP on the served UI; no eval, no remote origins
//
// Run:  node serve.mjs            → prints the local URL (random port)
//       node serve.mjs --port N   → fixed port
//       node serve.mjs --allow-real  → enables the HITL real-root path (still confirm-gated)

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { probe, resolveRequestedRoot, resolveRoot, buildPlan, apply, consentRecord, teardown, resolveKitDir, connectAI } from './provision.mjs';
import {
  INSTALLER_VERSION,
  detectAIClients,
  pickInstallFolder,
  verifyInstall,
  writeDiagnosticReceipt,
  writeHandoverReceipt,
} from './installer-services.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const allowReal = args.includes('--allow-real');
const portArg = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 0;
const adminConfigPath = args.includes('--admin-config') ? args[args.indexOf('--admin-config') + 1] : null;
const adminConfig = adminConfigPath ? JSON.parse(fs.readFileSync(adminConfigPath, 'utf8')) : null;
const TOKEN = crypto.randomBytes(16).toString('hex');

const sessions = {
  installId: crypto.randomBytes(8).toString('hex'),
  mode: adminConfig ? 'admin' : 'self',
  startedAt: Date.now(),
  lastSandbox: null,
  lastApplied: null,
  events: [],
};

function eulaDetails() {
  const file = path.join(here, '..', 'legal', 'spineos-EULA-v1.2.md');
  const text = fs.readFileSync(file, 'utf8');
  return { version: 'v1.2-FINAL', sha256: crypto.createHash('sha256').update(text).digest('hex'), text };
}

// Local Ollama detect (127.0.0.1 only — consistent with the zero-OUTBOUND posture;
// nothing ever leaves this machine).
function ollamaProbe() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 11434, path: '/api/tags', timeout: 800 }, (r) => {
      let b = '';
      r.on('data', (c) => { b += c; });
      r.on('end', () => {
        try { resolve({ reachable: true, models: (JSON.parse(b).models || []).map((m) => m.name).slice(0, 10) }); }
        catch { resolve({ reachable: true, models: [] }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ reachable: false, models: [] }); });
    req.on('error', () => resolve({ reachable: false, models: [] }));
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 3e6) { reject(new Error('body too large')); req.destroy(); } b += c; });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      let html = fs.readFileSync(path.join(here, 'ui.html'), 'utf8');
      html = html.replace('__SPINEOS_TOKEN__', TOKEN).replace('__ALLOW_REAL__', String(allowReal));
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      return res.end(html);
    }
    if (req.method === 'GET' && (url.pathname === '/splash.mp4' || url.pathname === '/splash-autoplay.mp4')) {
      // Fixed filename, no user input in the path — same trust boundary as ui.html above.
      // WebKit's media engine requires Range support to play <video> at all (issues a
      // Range request before the first frame); without it it fires `error` immediately.
      const video = fs.readFileSync(path.join(here, path.basename(url.pathname)));
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        let start = 0;
        let end = video.length - 1;
        if (m && !m[1] && m[2]) {
          const suffixLength = Number(m[2]);
          start = Math.max(video.length - suffixLength, 0);
        } else if (m && m[1]) {
          start = Number(m[1]);
          if (m[2]) end = Number(m[2]);
        }
        if (!m || (!m[1] && !m[2]) || start > end || start >= video.length || end >= video.length) {
          res.writeHead(416, { 'content-range': `bytes */${video.length}` });
          return res.end();
        }
        res.writeHead(206, {
          'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'no-store',
          'content-range': `bytes ${start}-${end}/${video.length}`, 'content-length': end - start + 1,
        });
        return res.end(video.subarray(start, end + 1));
      }
      res.writeHead(200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': video.length, 'cache-control': 'no-store' });
      return res.end(video);
    }
    if (req.method === 'GET' && url.pathname === '/splash-autoplay.webp') {
      const animation = fs.readFileSync(path.join(here, 'splash-autoplay.webp'));
      res.writeHead(200, { 'content-type': 'image/webp', 'content-length': animation.length, 'cache-control': 'no-store' });
      return res.end(animation);
    }
    if (req.method === 'GET' && url.pathname === '/splash-poster.jpg') {
      const poster = fs.readFileSync(path.join(here, 'splash-poster.jpg'));
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': poster.length, 'cache-control': 'no-store' });
      return res.end(poster);
    }
    if (req.method === 'GET' && url.pathname === '/spine-os-icon.png') {
      const icon = fs.readFileSync(path.join(here, 'spine-os-icon.png'));
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': icon.length, 'cache-control': 'no-store' });
      return res.end(icon);
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers['x-spineos-token'] !== TOKEN) {
        return json(res, 403, { error: 'bad or missing x-spineos-token' });
      }
      if (url.pathname === '/api/probe' && req.method === 'GET') {
        return json(res, 200, { probe: probe(), allowReal });
      }
      if (url.pathname === '/api/session' && req.method === 'GET') {
        return json(res, 200, {
          installerVersion: INSTALLER_VERSION,
          mode: sessions.mode,
          allowReal,
          config: adminConfig ? {
            form: adminConfig.form || {},
            root: adminConfig.root || '',
            connect: adminConfig.connect || {},
            telemetryOptIn: adminConfig.telemetryOptIn === true,
            unattended: adminConfig.unattended === true,
            licenceAccepted: adminConfig.licenceAccepted === true,
            eulaSha256: adminConfig.eulaSha256 || '',
          } : null,
        });
      }
      if (url.pathname === '/api/eula' && req.method === 'GET') {
        // SSOT: render the actual final agreement from legal/ — never a diverging copy.
        return json(res, 200, eulaDetails());
      }
      if (url.pathname === '/api/plan' && req.method === 'POST') {
        const body = await readBody(req);
        const p = probe();
        const plan = buildPlan(p, body.form || {}, { kitDir: resolveKitDir() });
        return json(res, 200, {
          plan, probe: p,
          writes: plan.filter((s) => s.type === 'write' || s.type === 'seed').length,
          kitFiles: plan.filter((s) => s.type === 'kitfile').length,
        });
      }
      if (url.pathname === '/api/pick-folder' && req.method === 'POST') {
        return json(res, 200, pickInstallFolder());
      }
      if (url.pathname === '/api/validate-root' && req.method === 'POST') {
        const body = await readBody(req);
        const root = resolveRequestedRoot(body.root);
        const warnings = [];
        if (process.platform === 'win32' && /[\\/]OneDrive[\\/]/i.test(root)) {
          warnings.push('This folder is managed by OneDrive. Pause sync during installation, or choose a local folder to avoid partial-file conflicts.');
        }
        return json(res, 200, { root, warnings });
      }
      if (url.pathname === '/api/apply' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.consent || body.consent.accepted !== true) {
          return json(res, 409, { error: 'consent required: EULA must be accepted before any write' });
        }
        const eula = eulaDetails();
        if (body.consent.eula_sha256 !== eula.sha256) {
          return json(res, 409, { error: 'licence receipt does not match the bundled final EULA; review and accept the current agreement' });
        }
        const wantsReal = body.target === 'real';
        if (wantsReal && (!allowReal || body.confirm !== 'APPLY-REAL')) {
          return json(res, 403, { error: 'real-root apply is gated: start server with --allow-real AND send confirm:"APPLY-REAL"' });
        }
        const p = probe();
        const { root, sandbox } = resolveRoot({
          apply: wantsReal && allowReal && body.confirm === 'APPLY-REAL',
          realRoot: body.root || '~/SpineOS',
        });
        const plan = buildPlan(p, body.form || {}, { kitDir: resolveKitDir() });
        const consent = consentRecord({
          machineId: p.machineId,
          reducedMotion: !!body.consent.reduced_motion,
          eulaText: eula.text,
          eulaVersion: eula.version,
          acceptedAt: body.consent.accepted_at || new Date().toISOString(),
        });
        let r;
        try {
          r = apply(root, plan, { consent, form: body.form || {} });
        } catch (error) {
          let diagnostic = null;
          if (fs.existsSync(root)) {
            diagnostic = writeDiagnosticReceipt(root, {
              code: error.code || 'APPLY_FAILED',
              message: error.message,
              mode: sessions.mode,
              step: 'plan-apply-verify',
            });
          }
          return json(res, 500, {
            error: `Installation stopped safely: ${error.message}`,
            next: diagnostic ? `Send the diagnostic receipt at ${diagnostic.file} to Mindspan support.` : 'Choose another folder and retry.',
            diagnostic: diagnostic?.file || null,
          });
        }
        if (sandbox) sessions.lastSandbox = root;
        sessions.lastApplied = root;
        const ai = connectAI(root, {
          ...(body.ai || {}),
          persona: (body.form || {}).persona || 'general',
        });
        const verification = verifyInstall(root, { requireAI: true });
        const handover = writeHandoverReceipt(root, {
          mode: sessions.mode,
          verification,
          applyResult: r,
          ai,
        });
        return json(res, 200, {
          root,
          sandbox,
          wrote: r.wrote,
          skipped: r.skipped,
          beside: r.beside,
          metadataCleaned: r.metadataCleaned,
          ledger: r.ledger,
          ai,
          verification,
          handover: { file: handover.file, sha256: handover.sha256 },
        });
      }
      if (url.pathname === '/api/telemetry' && req.method === 'POST') {
        // The ONE exception to zero-outbound, and only when the user opted in on the
        // plan screen: a single install ping. Schema is a hard allowlist — version,
        // OS, arch, event, random install id. No machine hash, no brand, no persona,
        // no paths. Fire-and-forget: telemetry can never block or fail an install.
        const body = await readBody(req);
        if (body.optIn !== true) return json(res, 200, { sent: false, reason: 'opt-in not given' });
        const acceptedEvents = new Set(['install_started', 'step_reached', 'ai_connected', 'install_completed', 'install_failed']);
        if (!acceptedEvents.has(body.event)) return json(res, 400, { error: 'event is not allowlisted' });
        const event = body.event;
        const localEvent = {
          product: 'spine-os',
          install_id: sessions.installId,
          version: (() => { try { return fs.readFileSync(path.join(here, '..', 'VERSION'), 'utf8').trim(); } catch { try { return fs.readFileSync(path.join(here, '..', 'kit', 'VERSION'), 'utf8').trim(); } catch { return '?'; } } })(),
          os: process.platform, arch: process.arch,
          event,
          mode: body.sandbox ? 'sandbox' : 'real',
          step: String(body.step || '').slice(0, 40),
          duration_ms: Math.max(0, Math.min(Number(body.duration_ms) || 0, 86_400_000)),
          failure_code: String(body.failure_code || '').slice(0, 60),
        };
        sessions.events.push(localEvent);
        const payload = JSON.stringify(localEvent);
        const target = new URL(process.env.SPINEOS_TELEMETRY_URL || 'https://app.mindspan.com.au/api/spineos-telemetry');
        const mod = target.protocol === 'http:' ? http : https;
        const r2 = mod.request(target, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }, timeout: 2500 }, () => {});
        r2.on('error', () => {}); r2.on('timeout', () => r2.destroy());
        r2.end(payload);
        return json(res, 200, { sent: true, payload: JSON.parse(payload) }); // echoed so the UI can SHOW exactly what left
      }
      if (url.pathname === '/api/ai/probe' && req.method === 'GET') {
        return json(res, 200, { clients: detectAIClients(), ollama: await ollamaProbe() });
      }
      if (url.pathname === '/api/ai/connect' && req.method === 'POST') {
        // K3: real connect. Only ever writes into the root THIS session applied —
        // never a caller-supplied path. The key goes to the OS keychain, not disk.
        const body = await readBody(req);
        if (!sessions.lastApplied) return json(res, 409, { error: 'apply first — there is no provisioned vault to connect' });
        const r = connectAI(sessions.lastApplied, {
          tier: body.tier, provider: body.provider, client: body.client, model: body.model,
          apiKey: body.apiKey || '', persona: (body.form || {}).persona || 'general',
        });
        if (body.tier === 'local') {
          const o = await ollamaProbe();
          r.checks.push({ name: 'local Ollama reachable on 127.0.0.1:11434', ok: o.reachable });
          r.ollamaModels = o.models;
          r.green = r.checks.every((c) => c.ok);
        }
        return json(res, 200, r);
      }
      if (url.pathname === '/api/verify' && req.method === 'POST') {
        if (!sessions.lastApplied) return json(res, 409, { error: 'Apply first — there is no install to verify.' });
        return json(res, 200, verifyInstall(sessions.lastApplied, { requireAI: true }));
      }
      if (url.pathname === '/api/timing-receipt' && req.method === 'POST') {
        if (!sessions.lastApplied) return json(res, 409, { error: 'Apply first — there is no install receipt folder.' });
        const body = await readBody(req);
        const receiptDir = path.join(sessions.lastApplied, '_support');
        fs.mkdirSync(receiptDir, { recursive: true });
        const allowed = Array.isArray(body.events) ? body.events.map((event) => ({
          step: String(event.step || '').slice(0, 40),
          event: String(event.event || '').slice(0, 30),
          duration_ms: Math.max(0, Math.min(Number(event.duration_ms) || 0, 86_400_000)),
          failure_code: String(event.failure_code || '').slice(0, 60),
        })) : [];
        const receipt = {
          schema: 'spineos-step-timing-v1',
          install_id: sessions.installId,
          version: INSTALLER_VERSION,
          os: process.platform,
          arch: process.arch,
          mode: sessions.mode,
          total_duration_ms: Date.now() - sessions.startedAt,
          events: allowed,
          privacy: 'No brand, path, user data, or credential fields.',
        };
        const file = path.join(receiptDir, 'INSTALL-TIMINGS.json');
        fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
        return json(res, 200, { file, receipt });
      }
      if (url.pathname === '/api/open-installed' && req.method === 'POST') {
        if (!sessions.lastApplied) return json(res, 409, { error: 'Install first — there is no completed Spine OS folder to open.' });
        const body = await readBody(req);
        const target = body.target === 'folder' ? sessions.lastApplied : path.join(sessions.lastApplied, 'dashboard.html');
        if (!fs.existsSync(target)) return json(res, 404, { error: 'The requested installed item is missing.' });
        const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
        const child = spawn(command, [target], { detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        return json(res, 200, { opened: body.target === 'folder' ? 'folder' : 'dashboard' });
      }
      if (url.pathname === '/api/selftest' && req.method === 'POST') {
        // green/red self-test: plan→apply→re-apply idempotent→escape-guard throws→teardown, all in a fresh sandbox
        const out = { checks: [], green: false };
        const ok = (name, cond) => out.checks.push({ name, ok: !!cond });
        try {
          const p = probe();
          const { root, sandbox } = resolveRoot({});
          ok('sandbox default', sandbox === true && path.resolve(root).startsWith(path.resolve(os.tmpdir())));
          const plan = buildPlan(p, { brand: 'Self Test', llm: 'claude' });
          const r1 = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }) });
          ok('first apply wrote files', r1.wrote >= 3);
          const r2 = apply(root, plan, { consent: consentRecord({ machineId: p.machineId }) });
          ok('idempotent re-run', r2.wrote === 0);
          let threw = false;
          try { apply(root, [{ type: 'write', rel: '../escape.txt', body: 'x' }]); } catch { threw = true; }
          ok('escape guard throws', threw);
          ok('teardown clean', teardown(root) === true && !fs.existsSync(root));
          out.green = out.checks.every((c) => c.ok);
        } catch (e) { out.error = String(e.message); }
        return json(res, 200, out);
      }
      if (url.pathname === '/api/teardown' && req.method === 'POST') {
        const body = await readBody(req);
        const root = body.root || sessions.lastSandbox;
        if (!root) return json(res, 404, { error: 'no sandbox to tear down' });
        teardown(root); // refuses non-sandbox paths internally
        if (sessions.lastSandbox === root) sessions.lastSandbox = null;
        return json(res, 200, { removed: root });
      }
      return json(res, 404, { error: 'unknown api route' });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    const msg = String(e && e.message || e);
    json(res, /escape|refusing/i.test(msg) ? 403 : 500, { error: msg });
  }
});

// Orphan guard: when launched by the native launcher (--parent-pid N), exit if the
// parent dies by ANY means (incl. SIGKILL/force-quit, which the launcher's own
// CloseRequested kill can't cover). kill(pid, 0) = liveness probe, sends nothing.
const ppidArg = args.includes('--parent-pid') ? Number(args[args.indexOf('--parent-pid') + 1]) : 0;
if (ppidArg > 0) {
  setInterval(() => {
    try { process.kill(ppidArg, 0); } catch { process.exit(0); }
  }, 2000).unref();
}

server.listen(portArg, '127.0.0.1', () => {
  const { port } = server.address();
  console.log(`[wizard-ui] http://127.0.0.1:${port}/  · sandbox-by-default · allowReal=${allowReal} · token=${TOKEN}`);
});
