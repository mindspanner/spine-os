// Spine OS — provisioner core (dependency-free) · L8 · S53 2026-06-05
// Duty-of-care design: SANDBOXED BY DEFAULT. Writes are structurally confined to a single
// resolved `root`. With no --apply, root is a throwaway temp dir (true dry-run). The wizard
// PLANS → (operator/client HITL ACCEPT) → APPLY. Idempotent, ledgered, reversible.
//
// CLI:
//   node provision.mjs                 # DRY-RUN into a temp sandbox, print plan + apply there, keep for inspection
//   node provision.mjs --apply         # apply into the REAL target root (~/SpineOS) — gated, never the default
//   node provision.mjs --teardown      # remove the last sandbox root (path read from --root or stdin)
//   SPINEOS_FIXTURE=fix.json node ...  # override probes with a fixture (for pressure-testing)
//
// Nothing here transmits anything. OAuth orchestration is a LOCAL stub (tokens stay on disk).

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  INSTALLER_VERSION,
  detectAIClients,
  refreshStatusBoard,
  verifyInstall,
  writeDiagnosticReceipt,
  writeHandoverReceipt,
} from './installer-services.mjs';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const nowUtc = () => new Date().toISOString();
// DR-0013: kit version for the `.spine-os-root` marker (matches install.sh). Read from kit-src/VERSION one level up.
const KIT_VERSION = (() => { try { return fs.readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim(); } catch { return '?'; } })();

// ---- 1. read-only environment probe (fixture-overridable) -------------------
export function probe(env = process.env) {
  if (env.SPINEOS_FIXTURE) {
    return JSON.parse(fs.readFileSync(env.SPINEOS_FIXTURE, 'utf8'));
  }
  const free = (() => { try { return Math.round((fs.statfsSync ? fs.statfsSync(os.homedir()).bavail * fs.statfsSync(os.homedir()).bsize : 0) / 1e9); } catch { return null; } })();
  return {
    platform: os.platform(),          // darwin | win32 | linux
    arch: os.arch(),
    release: os.release(),
    cpus: os.cpus().length,
    totalMemGB: Math.round(os.totalmem() / 1e9),
    freeDiskGB: free,
    monitors: null,                   // real probe is front-end side; null here (read-only, no native deps)
    machineId: env.SPINEOS_MACHINE_ID || sha256(os.hostname() + os.userInfo().username).slice(0, 24),
  };
}

// ---- 2. resolve the write root (SANDBOX BY DEFAULT) -------------------------
export function resolveRequestedRoot(input = '~/SpineOS') {
  const raw = String(input || '~/SpineOS').trim();
  if (raw.includes('\0')) throw new Error('install path contains an invalid character');
  if (raw.split(/[\\/]+/).includes('..')) throw new Error('install path may not contain ".." components');
  const expanded = raw === '~' ? os.homedir() : /^~[\\/]/.test(raw) ? path.join(os.homedir(), raw.slice(2)) : raw;
  if (!path.isAbsolute(expanded)) throw new Error('install path must be absolute (or begin with ~/ )');
  if (process.platform === 'win32' && expanded.length > 220) {
    throw new Error('Choose a shorter folder path so Windows applications stay below the 260-character compatibility limit.');
  }
  const base = path.basename(expanded);
  const parent = path.dirname(expanded);
  if (!base || base === '.' || base === '..') throw new Error('choose a named install folder');
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('the chosen parent folder must already exist');
  const parentReal = fs.realpathSync(parent);
  const root = path.join(parentReal, base);
  const homeReal = fs.realpathSync(os.homedir());
  const refused = new Set(['/', homeReal, '/Users', '/root', '/bin', '/sbin', '/etc', '/usr', '/var', '/opt', '/tmp', '/dev', '/private', '/System', '/Library', '/Applications', '/Volumes']);
  // Windows roots (v1.8): a drive root, the Users folder, Windows and Program Files are never a vault.
  if (process.platform === 'win32') {
    const win = root.replace(/[\\/]+$/, '').toLowerCase();
    const sysDrive = (process.env.SystemDrive || 'C:').toLowerCase();
    const winRefused = [homeReal, `${sysDrive}`, `${sysDrive}\\users`, `${sysDrive}\\windows`, `${sysDrive}\\program files`, `${sysDrive}\\program files (x86)`, `${sysDrive}\\programdata`]
      .map((v) => v.replace(/[\\/]+$/, '').toLowerCase());
    if (/^[a-z]:$/.test(win) || winRefused.includes(win)) throw new Error('choose a dedicated named folder, not a system or home root');
  }
  if (refused.has(root)) throw new Error('choose a dedicated named folder, not a system or home root');
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) throw new Error('the install folder may not be a symbolic link');
  return root;
}

export function resolveRoot({ apply = false, sandboxBase = os.tmpdir(), realRoot = '~/SpineOS' } = {}) {
  if (apply) {
    const real = resolveRequestedRoot(realRoot);
    return { root: real, sandbox: false };
  }
  const root = fs.mkdtempSync(path.join(sandboxBase, 'spineos-sandbox-'));
  return { root, sandbox: true };
}

// ---- 3. build a plan from probe + (HITL) form input -------------------------
// DR-0005 governance-inclusion, FOLDED from the intake.html meta-wizard: `persona` seeds the
// retention text + the default strictness; `governance` (none|light|strict) selects the overlay.
// DR-0014: ONE governance home = vault/20-GOVERNANCE (the kit's shipped, worked tree). The
// overlay MERGES into it with `seed` steps (write-once): over an installed kit the shipped
// SOPs/templates win; a standalone wizard run creates the same tree from scratch.
const RETENTION = {
  psychology: 'Adults ≥7y from last contact; minors until age 25 (APS/AHPRA — confirm by state).',
  health: 'Adults ≥7y; children to age 25 (AHPRA — legislated NSW/VIC/ACT; obstetric ~25y).',
  legal: 'Client files ~7y from completion; confidentiality survives the retainer; privilege applies.',
  accounting: 'ATO business records 5y; ASIC company records 7y; APES 110 confidentiality.',
  'social-work': 'Adults ≥7y from last contact; minors until age 25 (AASW practice standards; statutory/child-protection records follow your agency — confirm by state).',
  coaching: 'No statutory clinical clock; keep tax/finance records 5y (ATO).',
  sme: 'ATO business records 5y; ASIC 7y if a company.',
  general: 'Keep tax/finance records 5y (ATO) if relevant.',
};
const GOV_DEFAULT = { psychology: 'strict', health: 'strict', 'social-work': 'strict', legal: 'strict', accounting: 'strict', coaching: 'light', sme: 'light', general: 'light' };
const ADR_TMPL = '# ADR-NNNN — <decision>\n\n- Status: proposed\n- Date: <yyyy-mm-dd>\n\n## Context\n\n## Decision\n\n## Consequences\n';
const SOP_TMPL = '# SOP — <procedure>\n\n- When to run:\n- Owner:\n\n## Steps\n1.\n';
const ACCESS_LOG = '# Access log\n\nDate · who · what was accessed/changed. Keep for audit.\n';
const CONNECTOR_TEMPLATES = {
  payments: '# Stripe connector (optional)\n# Add credentials through your OS keychain or runtime environment — never commit secrets.\nSTRIPE_MODE=test\nSTRIPE_SECRET_KEY_REF=keychain:spineos-connector/stripe\n',
  booking: '# Booking connector (optional)\n# Complete the provider OAuth flow after setup; store the token in your OS keychain.\nBOOKING_PROVIDER=cal.com\nBOOKING_TOKEN_REF=keychain:spineos-connector/booking\n',
  email: '# Email connector (optional)\n# Complete the provider setup after installation; keep API keys out of this vault.\nEMAIL_PROVIDER=brevo\nEMAIL_API_KEY_REF=keychain:spineos-connector/email\n',
};
const retentionSeed = (persona) => `# Retention\n\n> Defaults to CONFIRM for your jurisdiction and profession. Not legal advice.\n\n${RETENTION[persona] || RETENTION.general}\n\nReview annually. When a record is past its clock and not otherwise required, destroy or de-identify it (APP 11).\n`;

// ---- 3a. kit payload (the FULL product install — Inc 6 cut-over) ------------
// The wizard ships inside the kit (kit-src/wizard/), so the payload is its parent;
// the Tauri launcher bundles the payload beside it as resources/kit/. First hit wins.
// With a kitDir the wizard IS the installer: dashboard, vault, CLAUDE.md, the lot —
// same no-clobber semantics as install.sh's update mode (K4).
const KIT_EXCLUDE = /^(install\.sh|install\.command|install\.ps1|Install-on-Windows\.cmd|modules\/|intake\.html|START-HERE\.html|START-WITH-YOUR-AI\.md|\.spineos-splash\.|Install Spine-OS\.app\/|zenflow\/|wizard\/splash\.html$)|(^|\/)(\.DS_Store|\._[^/]*)$/;
export function resolveKitDir() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const c of [path.join(here, '..', 'kit'), path.join(here, '..')]) {
    if (fs.existsSync(path.join(c, 'VERSION')) && fs.existsSync(path.join(c, 'CLAUDE.md'))) return c;
  }
  return null;
}
export function kitSteps(kitDir) {
  if (!kitDir) return [];
  return fs.readdirSync(kitDir, { recursive: true })
    .map(String).filter((rel) => !rel.includes('..') && !KIT_EXCLUDE.test(rel))
    .filter((rel) => { try { return fs.statSync(path.join(kitDir, rel)).isFile(); } catch { return false; } })
    .sort()
    .map((rel) => ({ type: 'kitfile', rel, src: path.join(kitDir, rel) }));
}
// v1.8 optional modules: kit/modules/<id>/files/** lands at the same relative path in the
// vault (same no-clobber rules as the kit). MANIFEST.json `modules[]` holds the plain-English
// question each installer asks. Unknown ids are ignored; nothing installs without a yes.
export const MODULE_IDS = ['documents', 'casework', 'reminders', 'email', 'skills'];
export function selectedModules(form = {}, kitDir = null) {
  const wanted = Array.isArray(form.modules) ? form.modules.map(String) : [];
  return MODULE_IDS.filter((id) => wanted.includes(id) && (!kitDir || fs.existsSync(path.join(kitDir, 'modules', id, 'files'))));
}
export function moduleSteps(kitDir, modules = []) {
  if (!kitDir) return [];
  const steps = [];
  for (const id of modules) {
    const base = path.join(kitDir, 'modules', id, 'files');
    if (!fs.existsSync(base)) continue;
    for (const rel of fs.readdirSync(base, { recursive: true }).map(String).sort()) {
      if (rel.includes('..') || /(^|[\\/])(\.DS_Store|\._[^\\/]*)$/.test(rel)) continue;
      const src = path.join(base, rel);
      if (!fs.statSync(src).isFile()) continue;
      steps.push({ type: 'kitfile', rel: rel.split(path.sep).join('/'), src, module: id });
    }
  }
  return steps;
}
// v1.9 removals: one choice, set at install. Permanent delete is never an option; by default nothing
// is deleted for good (vault/20-GOVERNANCE/SOP-removing-files.md; enforced by .claude/hooks/delete-guard.mjs).
export const REMOVAL_MODES = ['archive', 'trash', 'ask'];
export const REMOVAL_LINES = {
  archive: 'Files you remove go to vault/90-ARCHIVE/ (in a dated folder).',
  trash: "Files you remove go to your computer's Trash (Mac) or Recycle Bin (Windows).",
  ask: 'Before removing anything, ask me each time: Archive (vault/90-ARCHIVE/) or Trash?',
};
export const removalMode = (form = {}) => (REMOVAL_MODES.includes(form.removals) ? form.removals : 'archive');
export const removalsSeed = (mode) => `# How removing files works in this vault. Change mode to archive, trash or ask.\n# Permanent deletes always need the three steps in vault/20-GOVERNANCE/SOP-removing-files.md.\nmode=${mode}\narchive_folder=vault/90-ARCHIVE\n`;

// Token-stamp + brand the buyer-facing files exactly as install.sh does.
function renderKitFile(rel, buf, { root, form }) {
  const brand = form.brand || 'Your Business';
  if (/^(CLAUDE|MEMORY|START-WITH-YOUR-AI|SETUP-GUIDE)\.md$/.test(rel)) {
    return Buffer.from(buf.toString('utf8').replaceAll('__VAULT_PATH__', root).replaceAll('__BRAND__', brand)
      .replaceAll('__REMOVALS__', REMOVAL_LINES[removalMode(form)]));
  }
  if (rel === 'status-board.json' || rel === 'status-board.js') {
    let sb = (rel === 'status-board.js') ? null : buf.toString('utf8');
    if (sb === null) return null; // regenerated from the stamped json below, never copied raw
    const board = JSON.parse(sb);
    board.brand = {
      ...(board.brand || {}),
      name: brand,
      primary: form.brandColor || board.brand?.primary || '#14b8a6',
      logo: form.logoData ? '_config/brand-logo' : (board.brand?.logo || ''),
    };
    board.items = [
      { label: 'Kit installed — your vault is live on this machine', status: 'green' },
      { label: 'Profile and brand applied by the unified installer', status: 'green' },
      { label: 'AI connection recorded locally', status: 'green' },
      { label: 'First weekly review not yet run', status: 'amber' },
    ];
    board.meta = { ...(board.meta || {}), version: KIT_VERSION };
    return Buffer.from(`${JSON.stringify(board, null, 2)}\n`, 'utf8');
  }
  return buf;
}

export function buildPlan(p, form = {}, { kitDir = null } = {}) {
  const brand = form.brand || 'Your Business';
  const persona = (form.persona && RETENTION[form.persona]) ? form.persona : null;
  const governance = form.governance || (persona ? GOV_DEFAULT[persona] : 'light');
  const connectors = Array.isArray(form.connectors) ? form.connectors.filter((id) => CONNECTOR_TEMPLATES[id]) : [];
  const projectTypes = Array.isArray(form.projectTypes) ? form.projectTypes.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 20) : [];
  const organising = String(form.organising || 'actionability').slice(0, 60);
  const depth = String(form.depth || 'guided').slice(0, 40);
  const modules = selectedModules(form, kitDir);
  const steps = [
    { type: 'mkdir', rel: '.' },
    { type: 'mkdir', rel: '_config' },
    { type: 'seed', rel: '_config/brand.local', body: `name=${brand}\ncolour=${form.brandColor || '#14b8a6'}\nlogo=${form.logoData ? '_config/brand-logo' : ''}\nplatform=${p.platform}\narch=${p.arch}\npersona=${persona || 'general'}\ngovernance=${governance}\ndepth=${depth}\norganising=${organising}\n` },
    { type: 'seed', rel: '_config/profile.json', body: `${JSON.stringify({ depth, persona: persona || 'general', organising, governance, project_types: projectTypes, modules, removals: removalMode(form) }, null, 2)}\n` },
    { type: 'seed', rel: '_config/removals.local', body: removalsSeed(removalMode(form)) },
    { type: 'seed', rel: '_config/llm.local.example', body: `# Paste YOUR own key — stays on this machine.\nLLM_PROVIDER=${form.llm || 'claude'}\nLLM_API_KEY=\n` },
  ];
  for (const projectType of projectTypes) {
    const safe = projectType.normalize('NFKD').replace(/[^\p{Letter}\p{Number}._ -]/gu, '').trim().replace(/\s+/g, '-').slice(0, 60);
    if (safe) steps.push({ type: 'mkdir', rel: `vault/10-PROJECTS/${safe}` });
  }
  for (const id of connectors) {
    steps.push({ type: 'seed', rel: `_config/connectors/${id}.example`, body: CONNECTOR_TEMPLATES[id] });
  }
  // Kit payload FIRST, governance overlay after — the shipped worked SOPs/templates
  // must already exist when the write-once seeds run, so the richer kit files win.
  steps.push(...kitSteps(kitDir));
  steps.push(...moduleSteps(kitDir, modules));
  if (governance !== 'none') {
    steps.push(
      { type: 'mkdir', rel: 'vault/20-GOVERNANCE' },
      { type: 'seed', rel: 'vault/20-GOVERNANCE/ADR-template.md', body: ADR_TMPL },
      { type: 'seed', rel: 'vault/20-GOVERNANCE/SOP-template.md', body: SOP_TMPL },
    );
    if (governance === 'strict') {
      steps.push(
        { type: 'seed', rel: 'vault/20-GOVERNANCE/retention-policy.md', body: retentionSeed(persona) },
        { type: 'seed', rel: 'vault/20-GOVERNANCE/access-log.md', body: ACCESS_LOG },
        // PHI guardrail (H3.14): tells any AI assistant which paths must never be
        // pasted/uploaded to a cloud model. Advisory-by-design, honoured by the
        // CLAUDE.md boot protocol shipped in the kit.
        { type: 'seed', rel: '.spineosignore', body: '# Paths an AI assistant must NOT send to cloud models.\n# One glob per line. Enforced by your AI\'s boot instructions (CLAUDE.md).\nvault/30-CLIENTS/**\n**/*client*\n**/*.phi.*\nvault/20-GOVERNANCE/access-log.md\n' },
      );
    }
  }
  return steps;
}

// ---- 4. guard: every path must stay inside root -----------------------------
export function safeJoin(root, rel) {
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error(`PATH ESCAPE BLOCKED: ${rel} -> ${abs} is outside ${rootAbs}`);
  }
  return abs;
}

// ---- 5. consent record (per consent-record-schema-v1.json) ------------------
export function consentRecord({
  eulaText = 'EULA v0.1-DRAFT',
  eulaVersion = 'v0.1-DRAFT',
  templateVersion = 'v1',
  machineId,
  reducedMotion = false,
  acceptedAt = nowUtc(),
} = {}) {
  return {
    schema_version: 'v1', product: 'spine-os', accepted: true, accepted_at_utc: acceptedAt,
    eula_version: eulaVersion, eula_sha256: sha256(eulaText), template_version: templateVersion,
    machine_id: machineId, app_version: 'spineos-wizard-0.1.0', reduced_motion: reducedMotion, locale: 'en-AU',
  };
}

// ---- 6. apply plan (idempotent, ledgered) -----------------------------------
function atomicWrite(abs, data) {
  const temporary = `${abs}.spineos-partial-${process.pid}`;
  fs.writeFileSync(temporary, data);
  fs.renameSync(temporary, abs);
}

export function apply(root, plan, { consent, form = {} } = {}) {
  const ledger = [];
  const rec = (action, abs, body) => ledger.push({ action, path: path.relative(root, abs) || '.', sha256: body != null ? sha256(body) : null, ts: nowUtc() });
  let wrote = 0, skipped = 0, beside = 0;
  const brand = form.brand || 'Spine OS';
  for (const step of plan) {
    const abs = safeJoin(root, step.rel);
    if (step.type === 'mkdir') {
      fs.mkdirSync(abs, { recursive: true }); rec('mkdir', abs);
    } else if (step.type === 'kitfile') {
      // Full-product file. K4 no-clobber: missing → install; identical → skip;
      // differs (user-edited or older kit) → land BESIDE as <file>.new-v<version>.
      if (step.rel === 'status-board.js') continue; // regenerated from the stamped json below
      const data = renderKitFile(step.rel, fs.readFileSync(step.src), { root, form: { ...form, brand } });
      if (fs.existsSync(abs)) {
        if (sha256(fs.readFileSync(abs)) === sha256(data)) { skipped++; rec('skip-identical', abs); continue; }
        const besideAbs = safeJoin(root, `${step.rel}.new-v${KIT_VERSION}`);
        if (fs.existsSync(besideAbs) && sha256(fs.readFileSync(besideAbs)) === sha256(data)) { skipped++; rec('skip-identical', besideAbs); continue; }
        fs.mkdirSync(path.dirname(besideAbs), { recursive: true });
        atomicWrite(besideAbs, data); beside++; rec('beside', besideAbs, data);
        continue;
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      atomicWrite(abs, data); wrote++; rec('kit-write', abs, data);
      if (step.rel === 'status-board.json') {
        const feed = refreshStatusBoard(root);
        wrote++; rec('kit-write', feed.jsPath, fs.readFileSync(feed.jsPath));
      }
    } else if (step.type === 'write' || step.type === 'seed') {
      if (fs.existsSync(abs)) {
        // seed = write-once (DR-0014: never clobber a shipped/edited governance file)
        if (step.type === 'seed' || sha256(fs.readFileSync(abs, 'utf8')) === sha256(step.body)) { skipped++; rec('skip-existing', abs, step.body); continue; }
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      atomicWrite(abs, step.body); wrote++; rec('write', abs, step.body);
    }
  }
  if (form.logoData) {
    const logoMatch = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(form.logoData));
    if (!logoMatch) throw new Error('The logo is not a supported PNG, JPEG or WebP image.');
    const logo = Buffer.from(logoMatch[2], 'base64');
    if (logo.length > 2 * 1024 * 1024) throw new Error('The logo is larger than the 2 MB limit.');
    const logoAbs = safeJoin(root, '_config/brand-logo');
    if (!fs.existsSync(logoAbs)) {
      atomicWrite(logoAbs, logo); wrote++; rec('write', logoAbs, logo);
    } else {
      skipped++; rec('skip-existing', logoAbs);
    }
  }
  // DR-0013: boundary marker — write-once (mirrors install.sh `if [ ! -f .spine-os-root ]`), so re-apply stays idempotent.
  {
    const markerAbs = safeJoin(root, '.spine-os-root');
    if (fs.existsSync(markerAbs)) { skipped++; rec('skip-existing', markerAbs); }
    else {
      const body = `spine-os-wiki-root\nversion=${KIT_VERSION}\ninstalled_utc=${nowUtc()}\nboundary=${root}\n`;
      atomicWrite(markerAbs, body); wrote++; rec('write', markerAbs, body);
    }
  }
  if (consent) {
    const abs = safeJoin(root, 'consent-record.json');
    const body = JSON.stringify(consent, null, 2);
    atomicWrite(abs, body); rec('write', abs, body);
  }
  const ledgerPath = safeJoin(root, '_provision-ledger.jsonl');
  atomicWrite(ledgerPath, ledger.map((l) => JSON.stringify(l)).join('\n') + '\n');
  // exFAT represents macOS provenance/resource metadata as visible `._*`
  // sidecars. Remove only those metadata files, only inside this proven root,
  // after all product and audit writes are complete.
  let metadataCleaned = 0;
  if (process.platform === 'darwin') {
    const junk = fs.readdirSync(root, { recursive: true }).map(String)
      .filter((rel) => path.basename(rel).startsWith('._'));
    for (const rel of junk) {
      const abs = safeJoin(root, rel);
      try { if (fs.statSync(abs).isFile()) { fs.rmSync(abs); metadataCleaned++; } } catch {}
    }
  }
  return { wrote, skipped, beside, metadataCleaned, ledger, ledgerPath };
}

// ---- 6a. AI-connect (K3 closed — a FUNCTION, not a screenshot) ---------------
// Three tiers: 'prompt' (pasteable prompt pack, zero secrets) · 'local' (Ollama on
// 127.0.0.1, no key) · 'cloud' (user's own API key → OS KEYCHAIN, never a disk file
// on mac/win). Confinement holds: the only files written live INSIDE root
// (_config/llm.local + _config/mcp.sample.json — a snippet the user's AI applies;
// we never touch user-level config outside the vault). No outbound network: cloud
// keys are verified by keychain read-back, not by calling the vendor.
import { spawnSync } from 'node:child_process';
const KEYCHAIN_SERVICE = 'spineos-llm';

export function keychainStore(account, secret, service = KEYCHAIN_SERVICE) {
  if (process.platform === 'darwin') {
    const r = spawnSync('security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w', secret]);
    return r.status === 0;
  }
  if (process.platform === 'win32') {
    const r = spawnSync('cmdkey', [`/generic:${service}:${account}`, `/user:${account}`, `/pass:${secret}`]);
    return r.status === 0;
  }
  return false; // linux: no universal keychain — caller falls back to a 0600 file with a warning
}
export function keychainRead(account, service = KEYCHAIN_SERVICE) {
  if (process.platform === 'darwin') {
    const r = spawnSync('security', ['find-generic-password', '-s', service, '-a', account, '-w']);
    return r.status === 0 ? String(r.stdout).trim() : null;
  }
  if (process.platform === 'win32') {
    // cmdkey can't read secrets back; existence check is the verify on Windows.
    const r = spawnSync('cmdkey', ['/list:' + `${service}:${account}`]);
    return r.status === 0 && /Target:/.test(String(r.stdout)) ? '(stored)' : null;
  }
  return null;
}
export function keychainDelete(account, service = KEYCHAIN_SERVICE) {
  if (process.platform === 'darwin') return spawnSync('security', ['delete-generic-password', '-s', service, '-a', account]).status === 0;
  if (process.platform === 'win32') return spawnSync('cmdkey', ['/delete:' + `${service}:${account}`]).status === 0;
  return false;
}

// PHI-aware defaults (H3.14): clinical/legal personas are steered to local-first.
const PHI_PERSONAS = new Set(['psychology', 'health', 'social-work', 'legal']);

export function connectAI(root, {
  tier = 'prompt',
  provider = 'claude',
  client = '',
  model = '',
  apiKey = '',
  persona = 'general',
} = {}) {
  const available = detectAIClients();
  const chosen = available.find((item) => item.id === client) || available.find((item) => item.id === provider);
  const clientId = chosen?.id || client || provider || 'other';
  const out = { tier, provider, client: clientId, checks: [], green: false };
  const ok = (name, cond) => out.checks.push({ name, ok: !!cond });
  let keyRef = 'none';
  if (tier === 'cloud' && apiKey) {
    const stored = keychainStore(provider, apiKey);
    if (stored) {
      keyRef = `keychain:${KEYCHAIN_SERVICE}/${provider}`;
      const back = keychainRead(provider);
      ok('key stored in OS keychain + read back', back === apiKey || back === '(stored)');
    } else {
      // ponytail: linux/no-keychain fallback — 0600 file inside the vault, loudly flagged
      const p = safeJoin(root, '_config/llm.local.key');
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, apiKey, { mode: 0o600 });
      keyRef = 'file:_config/llm.local.key (0600 — no OS keychain available)';
      ok('key stored (file fallback, 0600)', fs.existsSync(p));
    }
  }
  const cfg = safeJoin(root, '_config/llm.local');
  fs.mkdirSync(path.dirname(cfg), { recursive: true });
  const body = [
    '# Spine OS — your AI connection. Stays on this machine.',
    `LLM_TIER=${tier}`, `LLM_PROVIDER=${provider}`, `LLM_MODEL=${model}`,
    `LLM_KEY_REF=${keyRef}`, `LLM_PHI_GUARDRAIL=${PHI_PERSONAS.has(persona) ? 'local-first' : 'standard'}`,
    `CONNECTED_UTC=${nowUtc()}`, '',
  ].join('\n');
  fs.writeFileSync(cfg, body);
  ok('llm.local written inside the vault', fs.existsSync(cfg) && (!apiKey || !body.includes(apiKey)));
  // MCP wiring snippet — generated INSIDE the vault; the user's AI applies it to its own config.
  const mcp = safeJoin(root, '_config/mcp.sample.json');
  fs.writeFileSync(mcp, JSON.stringify({
    mcpServers: { 'spine-os-vault': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', root] } },
    _note: 'Paste into your AI\'s MCP config (e.g. claude_desktop_config.json). Scopes the assistant to THIS vault only.',
  }, null, 2));
  ok('mcp.sample.json written (vault-scoped filesystem server)', fs.existsSync(mcp));
  // Dashboard feed (offline, file:// safe — same pattern as status-board.js). NEVER the key.
  const aiState = { tier, provider, model, keyRef, phi_guardrail: PHI_PERSONAS.has(persona) ? 'local-first' : 'standard', connected_utc: nowUtc() };
  const aiJs = `window.__SPINEOS_AI__ = ${JSON.stringify(aiState, null, 2)};\n`;
  fs.writeFileSync(safeJoin(root, '_config/llm.local.js'), aiJs);
  ok('dashboard AI feed written (no secret material)', !apiKey || !aiJs.includes(apiKey));
  const connection = {
    schema: 'spineos-ai-connection-v1',
    client: clientId,
    client_name: chosen?.name || 'Other AI',
    detected: Boolean(chosen?.detected),
    detection_evidence: chosen?.evidence || 'copy-ready prompt path',
    executable_responded: Boolean(chosen?.responded),
    local_wiring: chosen?.localWiring || 'CLAUDE.md + AGENTS.md',
    permission_boundary: 'No file outside the chosen Spine OS folder was changed.',
    verified_at_utc: nowUtc(),
  };
  const connectionBody = `${JSON.stringify(connection, null, 2)}\n`;
  fs.writeFileSync(safeJoin(root, '_config/ai-connection.json'), connectionBody, 'utf8');
  ok('AI connection receipt written inside the vault', fs.existsSync(safeJoin(root, '_config/ai-connection.json')));
  ok(
    chosen?.detected ? `${chosen.name} detected, responded, and was locally wired` : 'copy-ready permission-first wiring available',
    chosen?.detected ? Boolean(chosen.responded) : tier === 'prompt' || (tier === 'cloud' && keyRef !== 'none'),
  );
  if (!chosen?.detected) {
    const prompt = [
      'SPINE OS — PERMISSION-FIRST CONNECTION',
      `Open this folder only: ${root}`,
      'Read AGENTS.md, then CLAUDE.md. Confirm the exact files you plan to change before writing.',
      'Use one writer and many advisors. Never upload the vault; share only the smallest necessary slice.',
      'First task: read status-board.json, propose my first three moves, and wait for approval before applying them.',
      '',
    ].join('\n');
    fs.writeFileSync(safeJoin(root, '_config/CONNECT-YOUR-AI.txt'), prompt, 'utf8');
    ok('copy-ready AI prompt written inside the vault', fs.existsSync(safeJoin(root, '_config/CONNECT-YOUR-AI.txt')));
  }
  out.keyRef = keyRef;
  out.verified = out.checks.every((c) => c.ok);
  out.green = out.checks.every((c) => c.ok);
  return out;
}

// ---- 7. teardown (sandbox only) ---------------------------------------------
export function teardown(root) {
  const base = os.tmpdir();
  if (!path.resolve(root).startsWith(path.resolve(base))) throw new Error(`refusing to teardown non-sandbox path: ${root}`);
  fs.rmSync(root, { recursive: true, force: true });
  return true;
}

// ---- CLI --------------------------------------------------------------------
// Interactive self-install drives this through serve.mjs/ui.html. The CLI is the
// ADMIN REMOTE-DEPLOY path (P3): the SAME engine, headless, fed by a brief:
//   node provision.mjs --config client.json [--apply --yes]
// brief = { "form": { brand, persona, governance, llm }, "connect": { tier, provider, model } }
// Same gates as ever: sandbox-by-default; --apply --yes for the real root; the kit
// payload installs when the wizard sits inside a kit (resolveKitDir). Cloud keys are
// NEVER accepted in a brief — key entry is interactive-only (keychain), by design.
// pathToFileURL: a plain `file://${argv[1]}` never matches on Windows or in folders with spaces.
// realpath too: Node reports import.meta.url for the resolved file (macOS /var → /private/var).
const isMain = (() => { try { return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const apply_ = args.includes('--apply');
  const briefFlag = args.includes('--config') ? '--config' : '--brief';
  const briefPath = args.includes(briefFlag) ? args[args.indexOf(briefFlag) + 1] : null;
  const brief = briefPath ? JSON.parse(fs.readFileSync(briefPath, 'utf8')) : {};
  if (brief.connect && (brief.connect.tier === 'cloud' || brief.connect.apiKey)) {
    console.error('[provision] REFUSED: cloud keys cannot travel in a brief — connect that tier interactively.');
    process.exit(1);
  }
  const form = brief.form || { brand: 'Demo Clinic', llm: 'claude' };
  const p = probe();
  const { root, sandbox } = resolveRoot({ apply: apply_, realRoot: brief.root || '~/SpineOS' });
  const plan = buildPlan(p, form, { kitDir: resolveKitDir() });
  const mode = brief.mode === 'admin' ? 'admin' : 'self';
  console.log(`[provision] platform=${p.platform} arch=${p.arch} mode=${mode}/${sandbox ? 'DRY-RUN (sandbox)' : 'APPLY (real)'} root=${root}${briefPath ? ` config=${briefPath}` : ''}`);
  console.log(`[provision] PLAN: ${plan.length} steps (${plan.filter((s) => s.type === 'kitfile').length} kit files)`);
  if (!briefPath) plan.filter((s) => s.type !== 'kitfile').forEach((s) => console.log(`  - ${s.type} ${s.rel}`));
  if (!apply_ || args.includes('--yes')) {
    const consent = consentRecord({ machineId: p.machineId });
    let r;
    try {
      r = apply(root, plan, { consent, form });
    } catch (error) {
      if (fs.existsSync(root)) {
        const diagnostic = writeDiagnosticReceipt(root, { message: error.message, mode, step: 'apply' });
        console.error(`[provision] diagnostic=${diagnostic.file}`);
      }
      throw error;
    }
    console.log(`[provision] applied: wrote=${r.wrote} skipped=${r.skipped} beside=${r.beside} ledger=${path.relative(process.cwd(), r.ledgerPath)}`);
    let aiResult = { client: 'none', verified: false };
    if (brief.connect) {
      const c = connectAI(root, { ...brief.connect, persona: form.persona || 'general' });
      aiResult = c;
      console.log(`[provision] ai-connect: ${c.green ? 'GREEN' : 'CHECK'} · ${c.checks.map((x) => (x.ok ? '✓' : '✗') + ' ' + x.name).join(' · ')}`);
    }
    const verification = verifyInstall(root, { requireAI: Boolean(brief.connect) });
    const handover = writeHandoverReceipt(root, { mode, verification, applyResult: r, ai: aiResult });
    console.log(`[provision] verify: ${verification.green ? 'GREEN' : 'RED'} · ${verification.checks.filter((x) => x.ok).length}/9 · handover=${handover.file}`);
    console.log(sandbox ? `[provision] sandbox kept for inspection: ${root}\n[provision] remove with: node provision.mjs --teardown --root "${root}"` : '[provision] applied to real root.');
  } else {
    console.log('[provision] HITL gate: re-run with --apply --yes to write to the real root.');
  }
}
