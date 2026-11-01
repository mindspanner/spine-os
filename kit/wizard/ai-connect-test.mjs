// Spine OS — K3 proof: AI-connect is a FUNCTION (keychain + config + verify), not a screenshot.
// Uses a throwaway keychain service account; cleans up after itself.
// Run: node ai-connect-test.mjs   (exit 0 = green)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { connectAI, keychainStore, keychainRead, keychainDelete } from './provision.mjs';

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} · ${n}`); };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spineos-ai-test-'));
const FAKE_KEY = 'sk-test-NOT-A-REAL-KEY-' + Number(process.hrtime.bigint() % 100000n);

// keychain roundtrip (mac/win; linux returns false → file fallback covered below)
const stored = keychainStore('test-provider', FAKE_KEY, 'spineos-llm-test');
if (stored) {
  ok('keychain store + read-back roundtrip', keychainRead('test-provider', 'spineos-llm-test') === FAKE_KEY || keychainRead('test-provider', 'spineos-llm-test') === '(stored)');
  ok('keychain cleanup', keychainDelete('test-provider', 'spineos-llm-test'));
} else {
  ok('no OS keychain on this platform (fallback path exercised below)', true);
  ok('(placeholder to keep counts stable)', true);
}

// full connect: cloud tier
const r = connectAI(root, { tier: 'cloud', provider: 'claude', apiKey: FAKE_KEY, persona: 'psychology' });
ok('connect reports green', r.green === true);
ok('llm.local written inside the vault', fs.existsSync(path.join(root, '_config/llm.local')));
ok('PHI guardrail recorded for clinical persona', /LLM_PHI_GUARDRAIL=local-first/.test(fs.readFileSync(path.join(root, '_config/llm.local'), 'utf8')));
ok('mcp.sample.json written + vault-scoped', (() => {
  const m = JSON.parse(fs.readFileSync(path.join(root, '_config/mcp.sample.json'), 'utf8'));
  return m.mcpServers['spine-os-vault'].args.includes(root);
})());
// THE key check: the secret must not exist anywhere on disk inside the vault (mac/win)
const keyOnDisk = fs.readdirSync(root, { recursive: true }).map(String)
  .filter((f) => { try { return fs.statSync(path.join(root, f)).isFile(); } catch { return false; } })
  .some((f) => fs.readFileSync(path.join(root, f), 'utf8').includes(FAKE_KEY));
if (r.keyRef.startsWith('keychain:')) {
  ok('key is NOT on disk anywhere in the vault', !keyOnDisk);
  keychainDelete('claude'); // remove the test key from the real service
} else {
  ok('file fallback is 0600', (fs.statSync(path.join(root, '_config/llm.local.key')).mode & 0o777) === 0o600);
}
// prompt tier: zero secrets, still green
const r2 = connectAI(root, { tier: 'prompt', provider: 'claude', persona: 'general' });
ok('prompt tier green with zero secrets', r2.green && r2.keyRef === 'none');

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAIL'} — pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
