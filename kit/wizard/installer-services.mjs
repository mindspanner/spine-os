// Spine OS v1.7 — cross-platform installer services.
// Dependency-free by design: the bundled Node sidecar is the only runtime.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const INSTALLER_VERSION = '1.9.0';

const nowUtc = () => new Date().toISOString();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function commandPath(name) {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(command, [name], { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? String(result.stdout).split(/\r?\n/).find(Boolean) || null : null;
}

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function executableProof(executable, kind) {
  if (!executable) return { responded: false, version: '' };
  if (kind === 'desktop') return { responded: true, version: 'application bundle present' };
  const command = executable.endsWith('.app') ? null : executable;
  if (!command) return { responded: true, version: 'application bundle present' };
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  });
  const version = String(result.stdout || result.stderr || '').trim().split(/\r?\n/)[0].slice(0, 160);
  return { responded: result.status === 0, version };
}

export function detectAIClients() {
  const home = os.homedir();
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const applications = process.platform === 'darwin' ? '/Applications' : '';
  const clients = [
    {
      id: 'claude-code',
      name: 'Claude Code',
      kind: 'cli',
      executable: commandPath('claude'),
      localWiring: 'CLAUDE.md',
    },
    {
      id: 'codex',
      name: 'Codex',
      kind: 'cli',
      executable: commandPath('codex'),
      localWiring: 'AGENTS.md',
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      kind: 'desktop',
      executable: firstExisting(process.platform === 'darwin'
        ? [path.join(applications, 'Claude.app')]
        : [
            path.join(localAppData, 'AnthropicClaude', 'Claude.exe'),
            path.join(localAppData, 'Programs', 'claude', 'Claude.exe'),
          ]),
      localWiring: '_config/claude-desktop-mcp.json',
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      kind: 'desktop',
      executable: firstExisting(process.platform === 'darwin'
        ? [path.join(applications, 'ChatGPT.app')]
        : [
            path.join(localAppData, 'Programs', 'ChatGPT', 'ChatGPT.exe'),
            path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ChatGPT.lnk'),
          ]),
      localWiring: 'AGENTS.md',
    },
    {
      id: 'ollama',
      name: 'Ollama',
      kind: 'local',
      executable: commandPath('ollama'),
      localWiring: '_config/llm.local',
    },
  ];
  return clients.map((client) => {
    const proof = executableProof(client.executable, client.kind);
    return {
      ...client,
      detected: Boolean(client.executable),
      responded: proof.responded,
      version: proof.version,
      evidence: client.executable ? `${client.executable}${proof.version ? ` · ${proof.version}` : ''}` : 'not detected',
    };
  });
}

export function pickInstallFolder() {
  if (process.env.SPINEOS_PICK_FOLDER_FIXTURE) {
    return { selected: true, path: process.env.SPINEOS_PICK_FOLDER_FIXTURE, source: 'fixture' };
  }
  if (process.platform === 'darwin') {
    const script = [
      'try',
      'POSIX path of (choose folder with prompt "Choose the folder that will contain Spine OS")',
      'on error number -128',
      'return ""',
      'end try',
    ].join('\n');
    const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' });
    const selected = String(result.stdout || '').trim().replace(/\/$/, '');
    return { selected: Boolean(selected), path: selected || null, source: 'macOS folder picker' };
  }
  if (process.platform === 'win32') {
    const command = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
      '$dialog.Description = "Choose the folder that will contain Spine OS";',
      '$dialog.ShowNewFolderButton = $true;',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
      '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false);',
      '[Console]::Write($dialog.SelectedPath)',
      '}',
    ].join(' ');
    const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const selected = String(result.stdout || '').trim();
    return { selected: Boolean(selected), path: selected || null, source: 'Windows folder picker' };
  }
  return { selected: false, path: null, source: 'unsupported platform' };
}

export function statusBoardFeed(jsonText) {
  const parsed = JSON.parse(jsonText);
  return `window.__STATUS_BOARD__ = ${JSON.stringify(parsed, null, 2)};\n`;
}

export function refreshStatusBoard(root) {
  const jsonPath = path.join(root, 'status-board.json');
  const jsPath = path.join(root, 'status-board.js');
  if (!fs.existsSync(jsonPath)) throw new Error('status-board.json is missing');
  const feed = statusBoardFeed(fs.readFileSync(jsonPath, 'utf8'));
  const temp = `${jsPath}.spineos-partial-${process.pid}`;
  fs.writeFileSync(temp, feed, { encoding: 'utf8' });
  fs.renameSync(temp, jsPath);
  return { jsonPath, jsPath, sha256: sha256(feed), bytes: Buffer.byteLength(feed) };
}

export function verifyInstall(root, { requireAI = true } = {}) {
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const read = (rel) => exists(rel) ? fs.readFileSync(path.join(root, rel), 'utf8') : '';
  const marker = read('.spine-os-root');
  const version = read('VERSION').trim();

  check('install boundary marker', /spine-os-wiki-root/.test(marker), '.spine-os-root');
  check('semantic payload version', /^\d+\.\d+\.\d+$/.test(version), version || 'missing');
  check('branded dashboard', exists('dashboard.html') && !/__BRAND__/.test(read('dashboard.html')), 'dashboard.html');
  check('status JSON source of truth', exists('status-board.json'), 'status-board.json');
  check(
    'status JS regenerated from JSON',
    exists('status-board.js') && read('status-board.js') === statusBoardFeed(read('status-board.json')),
    'status-board.js',
  );
  check('AI operating instructions', exists('CLAUDE.md') && exists('AGENTS.md'), 'CLAUDE.md + AGENTS.md');
  check('canonical project vault', exists('vault/10-PROJECTS') && exists('vault/20-GOVERNANCE'), 'vault/');
  check('AI connection is locally wired', !requireAI || exists('_config/ai-connection.json'), '_config/ai-connection.json');
  check(
    'UTF-8 dashboard renders an em dash source',
    Buffer.from(read('dashboard.html'), 'utf8').includes(Buffer.from('—', 'utf8')) &&
      !/â€|Ã¢|�/.test(read('dashboard.html')),
    'dashboard.html',
  );
  return { green: checks.every((item) => item.ok), checks, version };
}

export function writeDiagnosticReceipt(root, {
  code = 'INSTALL_FAILED',
  message,
  mode = 'self',
  step = 'unknown',
  details = {},
} = {}) {
  const receiptDir = path.join(root, '_support');
  fs.mkdirSync(receiptDir, { recursive: true });
  const receipt = {
    schema: 'spineos-diagnostic-v1',
    created_at_utc: nowUtc(),
    installer_version: INSTALLER_VERSION,
    code,
    message: String(message || 'Unknown installer failure'),
    mode,
    step,
    os: process.platform,
    arch: process.arch,
    details,
    privacy: 'No brand, install path, credentials, or user content is included.',
  };
  const body = `${JSON.stringify(receipt, null, 2)}\n`;
  const file = path.join(receiptDir, `DIAGNOSTIC-${Date.now()}.json`);
  fs.writeFileSync(file, body, 'utf8');
  return { file, receipt, sha256: sha256(body) };
}

export function writeHandoverReceipt(root, {
  mode = 'self',
  verification,
  applyResult = {},
  ai = {},
} = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const receipt = {
    schema: 'spineos-handover-v1',
    created_at_utc: nowUtc(),
    installer_version: INSTALLER_VERSION,
    payload_version: verification.version,
    mode,
    os: process.platform,
    arch: process.arch,
    result: verification.green ? 'PASS' : 'FAIL',
    verification: verification.checks,
    changes: {
      wrote: applyResult.wrote || 0,
      skipped: applyResult.skipped || 0,
      beside: applyResult.beside || 0,
    },
    ai: {
      client: ai.client || 'none',
      verified: Boolean(ai.verified),
    },
    privacy: 'Receipt excludes brand, install path, credentials, and user content.',
    signature_note: 'Self-contained Ed25519 tamper-evidence; not an identity certificate.',
  };
  const canonical = JSON.stringify(receipt);
  const signature = crypto.sign(null, Buffer.from(canonical), privateKey).toString('base64');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const signed = {
    receipt,
    signature_algorithm: 'Ed25519',
    public_key_pem: publicKeyPem,
    signature_base64: signature,
    receipt_sha256: sha256(canonical),
  };
  const body = `${JSON.stringify(signed, null, 2)}\n`;
  const file = path.join(root, 'SPINEOS-HANDOVER-RECEIPT.json');
  fs.writeFileSync(file, body, 'utf8');
  return { file, signed, sha256: sha256(body) };
}

export function verifyHandoverReceipt(signed) {
  const canonical = JSON.stringify(signed.receipt);
  return crypto.verify(
    null,
    Buffer.from(canonical),
    signed.public_key_pem,
    Buffer.from(signed.signature_base64, 'base64'),
  );
}
