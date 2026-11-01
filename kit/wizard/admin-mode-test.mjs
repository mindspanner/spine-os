import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyHandoverReceipt } from './installer-services.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-admin-test-'));
const root = path.join(parent, 'Client Spine OS');
const configFile = path.join(parent, 'qa.spineos-admin');
const config = {
  mode: 'admin',
  unattended: true,
  licenceAccepted: true,
  eulaSha256: '',
  root,
  telemetryOptIn: false,
  form: { brand: 'Admin Test Client', persona: 'general', governance: 'light' },
  connect: { tier: 'prompt', client: 'other', provider: 'other' },
};
fs.writeFileSync(configFile, JSON.stringify(config));

let pass = 0;
let fail = 0;
const ok = (name, condition) => {
  condition ? pass++ : fail++;
  console.log(`${condition ? 'PASS' : 'FAIL'} · ${name}`);
};
const child = spawn(process.execPath, [path.join(here, 'serve.mjs'), '--port', '0', '--allow-real', '--admin-config', configFile], {
  cwd: here,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });
try {
  let base = '';
  for (let i = 0; i < 100 && !base; i++) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    base = (output.match(/\[wizard-ui\] (http:\/\/127\.0\.0\.1:\d+\/)/) || [])[1] || '';
  }
  if (!base) throw new Error(`server did not start: ${output}`);
  const html = await (await fetch(base)).text();
  const token = (html.match(/var TOKEN='([0-9a-f]+)'/) || [])[1];
  const headers = { 'content-type': 'application/json', 'x-spineos-token': token };
  const session = await (await fetch(`${base}api/session`)).json();
  const eula = await (await fetch(`${base}api/eula`)).json();
  ok('same server enters admin mode from .spineos-admin config', session.mode === 'admin' && session.config.unattended);
  const bad = await fetch(`${base}api/apply`, {
    method: 'POST', headers,
    body: JSON.stringify({ target: 'real', confirm: 'APPLY-REAL', root, form: config.form, ai: config.connect, consent: { accepted: true, eula_sha256: 'wrong' } }),
  });
  ok('unattended admin refuses stale licence hash', bad.status === 409 && !fs.existsSync(root));
  const applied = await (await fetch(`${base}api/apply`, {
    method: 'POST', headers,
    body: JSON.stringify({
      target: 'real', confirm: 'APPLY-REAL', root, form: config.form, ai: config.connect,
      consent: { accepted: true, accepted_at: new Date().toISOString(), eula_sha256: eula.sha256 },
    }),
  })).json();
  ok('admin real-root apply passes nine checks', applied.verification?.green && applied.verification.checks.length === 9);
  const signed = JSON.parse(fs.readFileSync(path.join(root, 'SPINEOS-HANDOVER-RECEIPT.json'), 'utf8'));
  ok('admin handover says admin and verifies Ed25519', signed.receipt.mode === 'admin' && verifyHandoverReceipt(signed));
} finally {
  child.kill();
  fs.rmSync(parent, { recursive: true, force: true });
}
console.log(`\nAdmin mode — pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
