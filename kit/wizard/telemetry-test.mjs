// Spine OS — P3 proof: opt-in install ping is allowlist-only + truly opt-in.
// Spins a local capture server, points SPINEOS_TELEMETRY_URL at it, drives the
// wizard server's /api/telemetry. Run: node telemetry-test.mjs  (exit 0 = green)
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };
const ALLOWED_KEYS = ['product', 'install_id', 'version', 'os', 'arch', 'event', 'mode', 'step', 'duration_ms', 'failure_code'].sort().join(',');

// 1 · local capture endpoint standing in for app.mindspan.com.au
const received = [];
const sink = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => { b += c; });
  req.on('end', () => { received.push(JSON.parse(b)); res.writeHead(202); res.end('{}'); });
});
await new Promise((r) => sink.listen(0, '127.0.0.1', r));
const sinkUrl = `http://127.0.0.1:${sink.address().port}/api/spineos-telemetry`;

// 2 · wizard server with the override
const srv = spawn('node', [path.join(here, 'serve.mjs'), '--port', '0'], {
  env: { ...process.env, SPINEOS_TELEMETRY_URL: sinkUrl },
});
const bootLine = await new Promise((resolve) => {
  let b = '';
  srv.stdout.on('data', (c) => { b += c; if (b.includes('[wizard-ui]')) resolve(b); });
});
const port = /127\.0\.0\.1:(\d+)/.exec(bootLine)[1];
const token = /token=([a-f0-9]+)/.exec(bootLine)[1];
const post = (body) => fetch(`http://127.0.0.1:${port}/api/telemetry`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-spineos-token': token }, body: JSON.stringify(body),
}).then((r) => r.json());

// no opt-in → nothing leaves
const r1 = await post({ event: 'install_completed', sandbox: false });
await new Promise((r) => setTimeout(r, 300));
ok('without opt-in: nothing sent', r1.sent === false && received.length === 0);

// opt-in → exactly the allowlisted schema
const r2 = await post({ optIn: true, event: 'install_completed', sandbox: false, brand: 'LEAKME', machineId: 'LEAKME', path: '/Users/x' });
await new Promise((r) => setTimeout(r, 400));
ok('with opt-in: completion ping received', received.length === 1);
const got = received[0] || {};
ok('payload keys are EXACTLY the allowlist', Object.keys(got).sort().join(',') === ALLOWED_KEYS);
ok('no injected fields survive (brand/machineId/path dropped)', !JSON.stringify(got).includes('LEAKME') && !JSON.stringify(got).includes('/Users/'));
ok('install_id is random hex, not a machine hash', /^[a-f0-9]{16}$/.test(got.install_id));
ok('event + mode constrained', got.event === 'install_completed' && got.mode === 'real');

for (const event of ['install_started', 'step_reached', 'ai_connected']) {
  await post({ optIn: true, event, step: 'connect', duration_ms: 123, sandbox: false });
}
await new Promise((r) => setTimeout(r, 400));
ok('journey events leave through the same exact allowlist',
  received.length === 4 && received.slice(1).every((p) => Object.keys(p).sort().join(',') === ALLOWED_KEYS));
ok('install journey event names preserved',
  received.slice(1).map((p) => p.event).join(',') === 'install_started,step_reached,ai_connected');
const rejected = await post({ optIn: true, event: 'install_abandoned', sandbox: false });
await new Promise((r) => setTimeout(r, 200));
ok('non-allowlisted event is rejected and never leaves', rejected.error === 'event is not allowlisted' && received.length === 4);

srv.kill(); sink.close();
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
