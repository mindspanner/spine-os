// SPINE-OS delete guard (v1.9) — a Claude Code PreToolUse hook. A safety net plus rules, not a guarantee.
//   The rule: your AI may MOVE files (to the Archive or the Trash). A permanent delete happens only after
//   three steps in order: (1) it lists exactly what and why, (2) it moves the items to the Archive or the
//   Trash first, (3) YOU type "permanently delete" plus each item's name.
//   What this guard does: before Claude Code runs a shell command, it looks for the common ways to delete
//   or overwrite files (rm and its cousins, wildcards, bulk or piped lists, loops, names built from
//   variables, eval, text fed into a shell, scripts and inline code that delete, destructive git commands,
//   writing over an existing file) and stops what breaks the rule. A permanent delete must name items
//   inside the Archive or the Trash, and your own last message must say "permanently delete" and name each
//   one. It also stops the AI changing these safety settings (.claude/ and _config/removals.local).
//   What it cannot do: it cannot see every way a file can be destroyed (a program it cannot read, a tool it
//   does not know, code that hides what it does). It runs only in Claude Code, in every permission mode;
//   in Claude Desktop chats, ChatGPT or other apps only the written rules apply.
// Input: the hook JSON on stdin. Output: exit 0 = allowed; exit 2 + a reason on stderr = blocked.
// Rules: vault/20-GOVERNANCE/SOP-removing-files.md. Test: kit/wizard/delete-guard-test.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DELETE_VERBS = new Set(['rm', 'rmdir', 'unlink', 'shred', 'srm', 'del', 'erase', 'rd', 'remove-item', 'ri', 'rimraf', 'wipe']);
const TRASH_VERBS = new Set(['trash', 'gio', 'trash-put', 'kioclient5']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'mksh', 'ash', 'fish', 'csh', 'tcsh']);
const PWSH = new Set(['powershell', 'pwsh']);
const INTERPS = new Set(['python', 'python2', 'python3', 'node', 'nodejs', 'perl', 'ruby', 'php', 'deno', 'bun', 'tsx', 'ts-node']);
const AWKS = new Set(['awk', 'gawk', 'mawk', 'nawk']);
const KEYWORDS = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', '!', '\\']);  // judge what follows them
const READ_ONLY = new Set(['cat', 'less', 'more', 'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ls', 'dir', 'stat', 'wc',
  'diff', 'cmp', 'file', 'jq', 'shasum', 'sha1sum', 'sha256sum', 'md5', 'md5sum', 'readlink', 'realpath', 'test', '[', '[[', 'echo',
  'printf', 'find', 'du', 'tree', 'bat', 'type', 'get-content', 'gc', 'select-string', 'sls', 'test-path', 'get-item', 'gi',
  'get-childitem', 'gci', 'get-filehash', 'git', 'basename', 'dirname', 'pwd', 'which', 'where', 'sort', 'uniq', 'cut', 'tr', 'xxd', 'od']);
const ANCESTOR_VERBS = new Set(['mv', 'move', 'move-item', 'mi', 'rename-item', 'rni', 'ren', 'rename', 'chmod', 'chown', 'chgrp',
  'chflags', 'chattr', 'xattr', 'setfacl', 'icacls', 'attrib', 'ln', ...DELETE_VERBS, ...TRASH_VERBS]);
const MOVES = new Set(['mv', 'move', 'move-item', 'mi']);
const COPIES = new Set(['cp', 'copy', 'copy-item', 'cpi', 'ditto']);
const MAX_ITEMS = 10;
const MAX_DEPTH = 8;

// Text patterns for code the guard cannot follow line by line (script files, inline code, here-documents).
const CODE_DELETE = /(^|[^\w.-])(rm|rmdir|unlink|shred|srm|rimraf|Remove-Item)(?=[\s"'`;)]|$)|\b(unlink(Sync)?|rmSync|rmdirSync|rmtree|removedirs|os\.remove|os\.rmdir|shutil\.\w+|FileUtils\.\w+|File\.delete|Dir\.(delete|rmdir|unlink)|fs\.(promises\.)?(rm|rmdir|unlink)\w*|Deno\.remove\w*|DeleteFile|DeleteDirectory|removeItemAt(Path|URL)|truncateSync|ftruncate)\b|\.(unlink|rmdir)\s*\(|\s-delete\b|\bgit\s+(clean|reset\s+--hard|restore|checkout\s+--|stash\s+(drop|clear))|empty\s+(the\s+)?trash/i;
const CODE_SHELL_OUT = /\b(os\.system|os\.popen|os\.exec\w*|os\.spawn\w*|subprocess|pty\.spawn|commands\.getoutput|child_process|execSync|execFileSync|spawnSync|execa|shelljs|Deno\.(run|Command)|Bun\.(spawn\w*|\$)|IO\.popen|Open3|Kernel\.(system|exec|spawn)|shell_exec|passthru|proc_open|popen|pcntl_exec|__import__|importlib|getattr\s*\(\s*(os|shutil|subprocess|pathlib|posix)\b|do\s+shell\s+script|doShellScript)\b|(^|[^.\w])(system|exec|spawn|eval|execfile)\s*\(|(^|[^.\w])qx\s*[{(\/|]|%x[{(\[]/;
const BACKTICK_SHELL = /`[^`]+`/;  // perl / ruby / php run backtick text as a shell command
const AWK_SHELL = /\bsystem\s*\(|\|\s*getline|\bprint[^;\n}]*\|/;
const OSA_BAD = /empty\s+(the\s+)?trash|do\s+shell\s+script|doShellScript|System Events[\s\S]*\bdelete\b|removeItemAt/i;
const SELF_TEXT = /(^|[\\/"'\s])\.claude([\\/]|$|["'\s])|removals\.local/;
const WRITEISH = /write|rename|chmod|unlink|remove|\brm\b|move|copy|replace|truncate|open\s*\(|>/i;

const SELF = 'The safety settings can only be changed by the person, by hand.';
const OVERWRITE = (n) => `"${n}" already exists, so this would overwrite an existing file; move the old one to the Archive first.`;
const no = (why) => ({ ok: false, why });
const OK = { ok: true };

const say = (why) => {
  const tail = why === SELF ? 'Ask the person to make this change themselves.\n' :
    'Removing files works like this here: move it to the Archive or the Trash (allowed). ' +
    'A permanent delete needs 3 steps in order: 1 list exactly what and why, 2 move the items to the Archive or Trash, ' +
    '3 the person types "permanently delete" and names every item. Then delete only those named items, one command, no wildcards. ' +
    'Rules: vault/20-GOVERNANCE/SOP-removing-files.md\n';
  process.stderr.write(`SPINE-OS delete guard: blocked. ${why}\n${tail}`);
  process.exit(2);
};

// ── shell-ish tokenizer ─────────────────────────────────────────────────────────────────────────────
// Words (with glob / dyn / quoted marks), segments split on ; & | && || newlines and brackets, redirects
// (> >> >| &> < << <<< …) with their targets, here-document bodies, and the text inside $( ), ` ` and
// <( ) >( ) so it can be judged as a command of its own. Returns the segments; .subs holds inner commands.
const closeParen = (s, i) => {  // s[i] === '(' → index of the matching ')'
  let d = 0; let q = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === q) q = null; else if (c === '\\' && q !== "'") k++; continue; }
    if (c === '\\') { k++; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(') d++;
    else if (c === ')' && --d === 0) return k;
  }
  return s.length;
};
const closeTick = (s, i) => { for (let k = i + 1; k < s.length; k++) { if (s[k] === '\\') { k++; continue; } if (s[k] === '`') return k; } return s.length; };
function subsIn(text) {  // command substitutions inside a here-document body (quotes there are plain text)
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '$' && text[i + 1] === '(') { const e = closeParen(text, i + 1); if (text[i + 2] !== '(') out.push(text.slice(i + 2, e)); i = e; continue; }
    if (text[i] === '`') { const e = closeTick(text, i); out.push(text.slice(i + 1, e)); i = e; }
  }
  return out;
}

export function tokenize(cmd) {
  const segs = []; const subs = []; const heredocs = [];
  let words = []; let redirs = []; let w = ''; let has = false; let glob = false; let dyn = false; let quoted = false; let q = null; let redir = null;
  const push = () => {
    if (has) {
      const word = { t: w, glob, dyn, q: quoted };
      if (redir) { const r = { op: redir, target: word }; redirs.push(r); if (redir === '<<' || redir === '<<-') heredocs.push(r); redir = null; } else words.push(word);
    }
    w = ''; has = false; glob = false; dyn = false; quoted = false;
  };
  const end = (op) => { push(); if (words.length || redirs.length) segs.push({ words, op, redirs }); words = []; redirs = []; redir = null; };
  const sub = (i, inner) => { const e = inner === '`' ? closeTick(cmd, i) : closeParen(cmd, i + 1); return e; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; else w += c; continue; }
    if (q === '"') {
      if (c === '"') { q = null; continue; }
      if (c === '\\' && i + 1 < cmd.length) { w += cmd[++i]; continue; }
      if (c === '$' && cmd[i + 1] === '(') { const e = sub(i, '('); if (cmd[i + 2] !== '(') subs.push({ text: cmd.slice(i + 2, e) }); w += cmd.slice(i, e + 1); dyn = true; i = e; continue; }
      if (c === '`') { const e = sub(i, '`'); subs.push({ text: cmd.slice(i + 1, e) }); w += cmd.slice(i, e + 1); dyn = true; i = e; continue; }
      if (c === '$') dyn = true;
      w += c; continue;
    }
    if (c === "'" || c === '"') { q = c; has = true; quoted = true; continue; }
    if (c === '\\' && i + 1 < cmd.length) { const n = cmd[++i]; if (n !== '\n') { w += n; has = true; } continue; }
    if (c === ' ' || c === '\t') { push(); continue; }
    if (c === '\n') {
      end('\n');
      // here-document bodies follow the line that opened them
      let pos = i + 1;
      for (const r of heredocs.splice(0)) {
        const lines = [];
        while (pos <= cmd.length) {
          let nl = cmd.indexOf('\n', pos); if (nl < 0) nl = cmd.length;
          const line = cmd.slice(pos, nl); pos = nl + 1;
          if ((r.op === '<<-' ? line.replace(/^\t+/, '') : line) === r.target.t) break;
          lines.push(line);
        }
        r.body = lines.join('\n');
        if (!r.target.q) for (const t of subsIn(r.body)) subs.push({ text: t });
      }
      i = pos - 1; continue;
    }
    if (c === ';') { end(c); continue; }
    if (c === '$' && cmd[i + 1] === '(') { const e = sub(i, '('); if (cmd[i + 2] !== '(') subs.push({ text: cmd.slice(i + 2, e) }); w += cmd.slice(i, e + 1); has = true; dyn = true; i = e; continue; }
    if (c === '`') { const e = sub(i, '`'); subs.push({ text: cmd.slice(i + 1, e) }); w += cmd.slice(i, e + 1); has = true; dyn = true; i = e; continue; }
    if ((c === '<' || c === '>') && cmd[i + 1] === '(') {  // process substitution <( ) >( )
      const e = closeParen(cmd, i + 1); subs.push({ text: cmd.slice(i + 2, e) }); w += cmd.slice(i, e + 1); has = true; dyn = true; i = e; continue;
    }
    if (c === '>' || c === '<') {
      if (has && !quoted && /^\d+$/.test(w)) { w = ''; has = false; } else push();
      let op = c;
      if (c === '>') { if (cmd[i + 1] === '>') { op = '>>'; i++; } else if (cmd[i + 1] === '|') { op = '>|'; i++; } else if (cmd[i + 1] === '&') { op = '>&'; i++; } } else if (cmd.startsWith('<<<', i)) { op = '<<<'; i += 2; } else if (cmd.startsWith('<<-', i)) { op = '<<-'; i += 2; } else if (cmd[i + 1] === '<') { op = '<<'; i++; } else if (cmd[i + 1] === '&') { op = '<&'; i++; } else if (cmd[i + 1] === '>') { op = '<>'; i++; }
      redir = op; continue;
    }
    if (c === '&' && cmd[i + 1] === '>') { push(); if (cmd[i + 2] === '>') { redir = '&>>'; i += 2; } else { redir = '&>'; i++; } continue; }
    if (c === '|' && cmd[i + 1] === '&') { i++; end('|'); continue; }  // |& pipes stderr too
    if (c === '&' || c === '|') { const two = cmd[i + 1] === c; if (two) i++; end(two ? c + c : c); continue; }
    if (c === '{') {
      if (w.endsWith('$')) { dyn = true; w += c; has = true; continue; }
      if (has || (i + 1 < cmd.length && !/\s/.test(cmd[i + 1]))) { glob = true; w += c; has = true; continue; }  // {a,b} or {}
      end(c); continue;
    }
    if (c === '}') { if (has) { glob = true; w += c; continue; } end(c); continue; }
    if (c === '(' || c === ')') { end(c); continue; }
    if (c === '$') dyn = true;
    if (c === '*' || c === '?' || c === '[' || c === ']') glob = true;
    w += c; has = true;
  }
  end('');
  segs.subs = subs;
  return segs;
}

const verbOf = (t) => path.basename(String(t).replace(/\\/g, '/')).toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
const interpBase = (v) => (v === 'nodejs' ? 'node' : v.replace(/[\d.]+$/, ''));
const isInterp = (v) => INTERPS.has(v) || INTERPS.has(interpBase(v));

function expandHome(p, home) {
  if (p === '~') return home;
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(home, p.slice(2));
  return p.replace(/^\$HOME(?=[\\/]|$)/, home).replace(/^%USERPROFILE%(?=[\\/]|$)/i, home).replace(/^\$env:USERPROFILE(?=[\\/]|$)/i, home);
}
function realish(p) {  // resolve links on the longest existing parent, keep the rest
  let cur = path.resolve(p); const tail = [];
  for (let i = 0; i < 64; i++) {
    try { return path.join(fs.realpathSync.native(cur), ...tail.reverse()); } catch { /* walk up */ }
    const up = path.dirname(cur); if (up === cur) break; tail.push(path.basename(cur)); cur = up;
  }
  return path.resolve(p);
}
const inside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const within = (child, parent) => child === parent || inside(child, parent);
const statOf = (p) => { try { return fs.statSync(p); } catch { return null; } };
const isNullDevice = (t) => /^(\/dev\/(null|stdout|stderr|tty|fd\/\d+)|nul|\$null)$/i.test(t);

export function findRoot(start) {
  let cur = path.resolve(start);
  for (let i = 0; i < 64; i++) {
    if (fs.existsSync(path.join(cur, '.spine-os-root'))) return cur;
    const up = path.dirname(cur); if (up === cur) break; cur = up;
  }
  return null;
}
export function settings(root) {
  const out = { mode: 'archive', archive: 'vault/90-ARCHIVE' };
  try {
    for (const line of fs.readFileSync(path.join(root, '_config', 'removals.local'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*(mode|archive_folder)\s*=\s*(.+?)\s*$/.exec(line);
      if (m && m[1] === 'mode') out.mode = m[2];
      if (m && m[1] === 'archive_folder' && !m[2].includes('..')) out.archive = m[2];
    }
  } catch { /* defaults */ }
  return out;
}
export function safeZones(root, home) {
  const zones = [];
  if (root) zones.push({ name: 'Archive', dir: realish(path.join(root, settings(root).archive)) });
  for (const t of [path.join(home, '.Trash'), path.join(home, '.local', 'share', 'Trash')]) zones.push({ name: 'Trash', dir: realish(t) });
  return zones;
}
const inRecycleBin = (abs) => /(^|[\\/])\$recycle\.bin([\\/]|$)/i.test(abs);

// The paths only the person may change: <root>/.claude/**, <root>/_config/removals.local, ~/.claude/settings*.json
export function protectedPaths({ cwd = process.cwd(), projectDir = '', home = os.homedir(), extra = [] } = {}) {
  const bases = [...new Set([findRoot(cwd), projectDir && findRoot(projectDir), projectDir, ...extra.map((p) => findRoot(p))]
    .filter(Boolean).map((b) => realish(b)))];
  const out = bases.flatMap((b) => [path.join(b, '.claude'), path.join(b, '_config', 'removals.local')]);
  out.push(realish(path.join(home, '.claude', 'settings.json')), realish(path.join(home, '.claude', 'settings.local.json')));
  return out;
}

// The person's own last typed message (not tool output) from the session transcript.
export function lastUserText(transcriptPath) {
  if (!transcriptPath) return '';
  let lines; try { lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n'); } catch { return ''; }
  for (let i = lines.length - 1; i >= 0; i--) {
    let e; try { e = JSON.parse(lines[i]); } catch { continue; }
    if (e.type !== 'user' || e.isMeta || !e.message) continue;
    const c = e.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      if (c.some((b) => b && b.type === 'tool_result')) continue;
      const text = c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
      if (text) return text;
    }
  }
  return '';
}

function targetsOf(verb, args) {
  const out = []; let flagsDone = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (verb === 'remove-item' || verb === 'ri') {
      if (/^-(path|literalpath|lp)$/i.test(a.t)) { if (args[i + 1]) out.push(args[++i]); continue; }
      if (/^-(include|exclude|filter)$/i.test(a.t)) { out.push({ t: args[i + 1]?.t || '*', glob: true, dyn: false }); i++; continue; }
      if (a.t.startsWith('-')) continue;
      for (const part of a.t.split(',')) if (part) out.push({ ...a, t: part });
      continue;
    }
    if (['del', 'erase', 'rd'].includes(verb) && /^\/[a-z]$/i.test(a.t)) continue;
    if (!flagsDone && a.t === '--') { flagsDone = true; continue; }
    if (!flagsDone && a.t.startsWith('-') && a.t.length > 1) continue;
    out.push(a);
  }
  return out;
}

// ── wrappers (sudo, env, nice, timeout …): consume their options exactly, or stop when unsure ───────
// arg = short options that take a value · noArg = short flags · long = {--name: 1 takes a value | 0 flag}
// stop = options that mean "do not run anything" · fail = options the guard will not follow
const WRAP = {
  sudo: { arg: 'ugCDhprtUTc', noArg: 'nEHSkKbislAPNV', fail: 'e', chdir: 'D', long: { '--user': 1, '--group': 1, '--chdir': 1, '--close-from': 1, '--host': 1, '--prompt': 1, '--role': 1, '--type': 1, '--other-user': 1, '--command-timeout': 1, '--login-class': 1, '--non-interactive': 0, '--preserve-env': 0, '--set-home': 0, '--stdin': 0, '--background': 0, '--shell': 0, '--login': 0, '--reset-timestamp': 0, '--remove-timestamp': 0, '--askpass': 0, '--preserve-groups': 0 }, chdirLong: '--chdir' },
  doas: { arg: 'uC', noArg: 'nsL' },
  env: { arg: 'uCP', noArg: 'i0v', fail: 'S', chdir: 'C', assign: true, long: { '--unset': 1, '--chdir': 1, '--ignore-environment': 0, '--null': 0, '--debug': 0 }, chdirLong: '--chdir' },
  nice: { arg: 'n', numeric: true, long: { '--adjustment': 1 } },
  ionice: { arg: 'cnp', noArg: 't', long: { '--class': 1, '--classdata': 1, '--pid': 1, '--ignore': 0 } },
  time: { arg: 'fo', noArg: 'pvalq', long: { '--format': 1, '--output': 1, '--append': 0, '--verbose': 0, '--quiet': 0, '--portability': 0 } },
  timeout: { arg: 'sk', noArg: 'v', operands: 1, long: { '--signal': 1, '--kill-after': 1, '--preserve-status': 0, '--foreground': 0, '--verbose': 0 } },
  nohup: {},
  exec: { arg: 'a', noArg: 'cl' },
  command: { noArg: 'p', stop: 'vV' },
  builtin: {},
  stdbuf: { arg: 'ioe', long: { '--input': 1, '--output': 1, '--error': 1 } },
  caffeinate: { arg: 'tw', noArg: 'dimsu' },
  watch: { arg: 'nq', noArg: 'dtbegcxpw', long: { '--interval': 1, '--differences': 0, '--no-title': 0, '--beep': 0, '--errexit': 0, '--chgexit': 0, '--color': 0, '--exec': 0, '--precise': 0 } },
  arch: { exact: { '-arch': 1, '-e': 1, '-d': 1, '-c': 0, '-32': 0, '-64': 0, '-x86_64': 0, '-x86_64h': 0, '-arm64': 0, '-arm64e': 0, '-i386': 0 } },
};
function unwrap(words) {
  words = words.slice(); let chdir = null;
  for (let guard = 0; guard < 32 && words.length; guard++) {
    const w0 = words[0];
    if (w0.dyn) break;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w0.t)) { words.shift(); continue; }
    const v = verbOf(w0.t);
    if (KEYWORDS.has(v)) { words.shift(); continue; }
    const spec = WRAP[v]; if (!spec) break;
    words.shift();
    const bad = (t) => ({ fail: `Cannot tell for certain which command "${v}" runs (at "${t}"), so it is stopped. Run the command without "${v}".` });
    const take = () => { const x = words.shift(); return x; };
    while (words.length) {
      const t = words[0].t;
      if (t === '--') { words.shift(); break; }
      if (spec.assign && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { words.shift(); continue; }
      if (spec.exact && Object.hasOwn(spec.exact, t)) { words.shift(); if (spec.exact[t]) { if (!words.length) return bad(t); words.shift(); } continue; }
      if (t === '-' && spec.assign) { words.shift(); continue; }
      if (!t.startsWith('-') || t === '-') break;
      if (words[0].dyn) return bad(t);
      if (spec.numeric && /^-\d+$/.test(t)) { words.shift(); continue; }
      if (t.startsWith('--')) {
        const name = t.split('=')[0]; const k = spec.long?.[name];
        if (k === undefined) return bad(t);
        words.shift();
        let val = t.includes('=') ? { t: t.slice(t.indexOf('=') + 1), dyn: false } : null;
        if (k === 1 && !val) { if (!words.length) return bad(t); val = take(); }
        if (spec.chdirLong === name && val) { if (val.dyn) return bad(t); chdir = val.t; }
        continue;
      }
      words.shift();
      const cl = t.slice(1);
      for (let k = 0; k < cl.length; k++) {
        const ch = cl[k];
        if ((spec.fail || '').includes(ch)) return bad(t);
        if ((spec.stop || '').includes(ch)) return { lookup: true };
        if ((spec.noArg || '').includes(ch)) continue;
        if ((spec.arg || '').includes(ch)) {
          let val = cl.slice(k + 1) ? { t: cl.slice(k + 1), dyn: false } : null;
          if (!val) { if (!words.length) return bad(t); val = take(); }
          if (ch === spec.chdir) { if (val.dyn) return bad(t); chdir = val.t; }
          break;
        }
        return bad(t);
      }
    }
    for (let n = 0; n < (spec.operands || 0); n++) { if (!words.length || words[0].dyn) return bad(v); words.shift(); }
  }
  return { words, chdir };
}

// ── git: skip the global options to find the real subcommand ─────────────────────────────────────────
const GIT_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix', '--attr-source', '--list-cmds']);
const GIT_FLAGS = new Set(['--no-pager', '-p', '--paginate', '-P', '--bare', '--no-replace-objects', '--literal-pathspecs', '--glob-pathspecs',
  '--noglob-pathspecs', '--icase-pathspecs', '--no-optional-locks', '--no-advice', '--html-path', '--man-path', '--info-path', '--version', '--help', '--exec-path', '--no-lazy-fetch']);
function gitParse(args) {
  const chdirs = []; const configs = []; let i = 0;
  while (i < args.length && args[i].t.startsWith('-')) {
    const t = args[i].t; const name = t.split('=')[0];
    if (t.includes('=') && GIT_VALUED.has(name)) { if (name === '--config-env') configs.push(t.slice(t.indexOf('=') + 1)); i++; continue; }
    if (GIT_VALUED.has(t)) {
      const val = args[i + 1]; if (!val) return { fail: t };
      if (t === '-C') { if (val.dyn) return { fail: t }; chdirs.push(val.t); }
      if (t === '-c') configs.push(val.t);
      i += 2; continue;
    }
    if (GIT_FLAGS.has(t)) { i++; continue; }
    return { fail: t };
  }
  return { sub: args[i]?.t || '', rest: args.slice(i + 1), chdirs, configs };
}

// ── reading code the guard cannot follow command by command ──────────────────────────────────────────
function checkCode(text, kind, ctx, depth, label) {
  const del = CODE_DELETE.exec(text);
  if (del) return no(`${label} contains a delete ("${del[0].trim()}"). Deleting from inside a script or inline code cannot be checked, so it is not allowed. Move files to the Archive or the Trash one named command at a time.`);
  if (kind === 'osascript') { const m = OSA_BAD.exec(text); if (m) return no(`${label} would ${/trash/i.test(m[0]) ? 'empty the Trash (a permanent delete)' : 'run commands or delete files the guard cannot check'}. Not allowed.`); return OK; }
  if (SELF_TEXT.test(text) && WRITEISH.test(text)) return no(SELF);
  if (kind === 'shell' || kind === 'pwsh') {
    const r = judgeText(text.replace(/^[ \t]*#.*$/gm, ''), ctx, depth + 1);  // a script's own comment lines (and #!) are not commands
    return r.ok ? OK : no(`${label}: ${r.why}`);
  }
  const sh = CODE_SHELL_OUT.exec(text) || (['perl', 'ruby', 'php'].includes(kind) && BACKTICK_SHELL.exec(text)) || (kind === 'awk' && AWK_SHELL.exec(text));
  if (sh) return no(`${label} runs other commands ("${sh[0].trim()}"), which the guard cannot check, so it is not allowed. Run each command directly.`);
  return OK;
}
const SYSTEM_DIRS = /^(\/usr\/|\/bin\/|\/sbin\/|\/opt\/homebrew\/|\/System\/|\/Library\/|\/Applications\/|[A-Za-z]:[\\/](Windows|Program Files)[\\/])/i;
function checkScript(word, kind, ctx, depth) {
  if (word.dyn || word.glob) return no('The script name is built from a variable or a wildcard, so what it does cannot be checked. Use the plain file name.');
  const abs = path.resolve(ctx.here, expandHome(word.t, ctx.home));
  let text;
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new Error('not a file');
    if (st.size > 4_000_000) return no(`"${word.t}" is too large to check, so it is not allowed to run.`);
    text = fs.readFileSync(abs, 'utf8');
  } catch { return no(`"${word.t}" could not be read, so what it does cannot be checked. A script must exist and be readable before it runs.`); }
  if (text.includes('\u0000')) return no(`"${word.t}" is a program file, not text, so what it does cannot be checked.`);
  if (kind === 'auto') {
    const bang = /^#!.*$/m.exec(text.split('\n')[0] || '')?.[0] || '';
    const m = /\b(python[\d.]*|node|perl|ruby|php|deno|bun|osascript|pwsh|powershell)\b/.exec(bang);
    kind = m ? (m[1] === 'osascript' ? 'osascript' : PWSH.has(m[1]) ? 'pwsh' : interpBase(m[1])) : /\.ps1$/i.test(abs) ? 'pwsh' : 'shell';
  }
  return checkCode(text, kind, ctx, depth, `The script "${word.t}"`);
}

const onlyInfo = (args) => args.length > 0 && args.every((a) => /^(--?version|-[vV]|--help|-h|\/\?)$/.test(a.t));
const FEED = (v) => `Feeding text into ${v} (a pipe, a here-document, a here-string or no code at all) cannot be checked, so it is not allowed. Run the command directly.`;

function interpreter(verb, args, ctx, depth, stdin) {
  const base = interpBase(verb);
  const INLINE = { python: ['-c'], node: ['-e', '--eval', '-p', '--print'], perl: ['-e', '-E'], ruby: ['-e'], php: ['-r'], bun: ['-e', '--eval', '-p', '--print'], tsx: ['-e', '--eval', '-p', '--print'], 'ts-node': ['-e', '--eval', '-p', '--print'], deno: [] }[base] || [];
  const VALUED = { python: ['-W', '-X', '-Q'], node: ['-r', '--require', '--import', '--loader', '--experimental-loader', '--input-type', '--env-file', '-C', '--conditions', '--title'], perl: [], ruby: ['-I', '-r', '-C', '-E'], php: ['-c', '-d', '-f', '-z'], bun: ['-r', '--preload', '--cwd', '--env-file'], deno: [] }[base] || [];
  const codes = []; const files = []; let script = null; let module = false; let i = 0;
  if (base === 'deno' || base === 'bun') {  // deno eval / deno run / bun run
    if (args[0]?.t === 'eval') { if (args[1]) codes.push(args[1]); i = args.length; } else if (args[0] && ['run', 'x'].includes(args[0].t)) i = 1;
    else if (base === 'deno' && args[0] && !args[0].t.startsWith('-') && !/\.[cm]?[jt]sx?$/.test(args[0].t)) return OK;  // deno fmt, lint …
  }
  for (; i < args.length; i++) {
    const a = args[i]; const t = a.t;
    if (t === '--') { script = args[i + 1] || null; break; }
    if (t === '-') { break; }
    if (!t.startsWith('-')) { script = a; break; }
    const name = t.split('=')[0];
    if (INLINE.includes(name) || ((base === 'perl' || base === 'ruby') && /^-[a-zA-Z]*[eE]$/.test(t))) {
      const code = t.includes('=') && name.startsWith('--') ? { ...a, t: t.slice(t.indexOf('=') + 1) } : args[++i];
      if (code) codes.push(code); break;
    }
    if (base === 'python' && /^-m/.test(t)) { module = true; break; }
    if (VALUED.includes(name)) {
      const val = t.includes('=') ? { ...a, t: t.slice(t.indexOf('=') + 1) } : args[++i];
      if (val && (name === '-f' || /^(\.{0,2}[\\/]|~[\\/])|\.(m?js|cjs|[cm]?ts|py|rb|pl|php)$/.test(val.t))) files.push(val);
    }
  }
  for (const c of codes) {
    if (c.dyn) return no(`The code handed to ${verb} is built from variables, so it cannot be checked.`);
    const r = checkCode(c.t, base, ctx, depth, `This ${verb} inline code`); if (!r.ok) return r;
  }
  for (const f of script ? [...files, script] : files) { const r = checkScript(f, base, ctx, depth); if (!r.ok) return r; }
  if (codes.length || script || module) return OK;
  if (stdin.text != null) return stdin.textDyn ? no(FEED(verb)) : checkCode(stdin.text, base, ctx, depth, `The code fed into ${verb}`);
  if (stdin.file) return checkScript(stdin.file, base, ctx, depth);
  if (!stdin.piped && onlyInfo(args)) return OK;
  return no(FEED(verb));
}

// ── one simple command ───────────────────────────────────────────────────────────────────────────────
function touchesProtected(word, ctx, ancestorToo) {
  if (word.dyn) return SELF_TEXT.test(word.t);
  const raw = word.t.includes('=') && word.t.startsWith('-') ? word.t.slice(word.t.indexOf('=') + 1) : word.t;
  if (word.glob) {
    if (SELF_TEXT.test(raw)) return true;
    if (!ancestorToo) return false;
    const parts = raw.split(/[\\/]/); const k = parts.findIndex((p) => /[*?[\]{}]/.test(p));
    const dir = realish(path.resolve(ctx.here, expandHome(parts.slice(0, k).join('/') || '.', ctx.home)));
    const re = new RegExp(`^${parts[k].replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\{([^}]*)\}/g, (m, x) => `(${x.split(',').join('|')})`)}$`, 'i');
    return ctx.protect.some((P) => within(dir, P) || (inside(P, dir) && re.test(path.relative(dir, P).split(path.sep)[0])));
  }
  const abs = realish(path.resolve(ctx.here, expandHome(raw, ctx.home)));
  return ctx.protect.some((P) => within(abs, P) || (ancestorToo && inside(P, abs)));
}
function selfProtect(verb, args, ctx) {
  if (READ_ONLY.has(verb)) return null;
  if (verb === 'sed' && !args.some((a) => /^(--in-place|-[a-zA-Z]*[iI])/.test(a.t))) return null;
  if (COPIES.has(verb)) {  // only the destination is written
    const { dest, srcs } = parseMoveCopy(verb, args);
    if (!dest) return null;
    if (touchesProtected(dest, ctx, false)) return no(SELF);
    if (dest.dyn) return null;
    const abs = realish(path.resolve(ctx.here, expandHome(dest.t, ctx.home)));
    if (statOf(abs)?.isDirectory()) for (const s of srcs) if (!s.dyn && ctx.protect.some((P) => within(path.join(abs, path.basename(s.t.replace(/[\\/]+$/, ''))), P))) return no(SELF);
    return null;
  }
  const anc = ANCESTOR_VERBS.has(verb);
  for (const a of args) {
    if (a.t.startsWith('-') && !a.t.includes('=')) continue;
    if (anc && a.dyn && !SELF_TEXT.test(a.t)) return no(`"${verb}" with a name built from variables cannot be checked here. Use the plain name.`);
    if (touchesProtected(a, ctx, anc)) return no(SELF);
  }
  return null;
}

function parseMoveCopy(verb, args) {
  let noClobber = false; let tdir = null; const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]; const t = a.t;
    if (t === '--') { pos.push(...args.slice(i + 1)); break; }
    if (/^-(destination|dest)$/i.test(t)) { tdir = args[++i] || null; continue; }
    if (/^-(path|literalpath|lp)$/i.test(t)) { if (args[i + 1]) pos.push(args[++i]); continue; }
    if (/^--target-directory=/.test(t)) { tdir = { ...a, t: t.slice(t.indexOf('=') + 1) }; continue; }
    if (t === '--target-directory' || /^-[a-z]{0,3}t$/.test(t)) { if (/^-[a-z]*n/.test(t)) noClobber = true; tdir = args[++i] || null; continue; }
    if (t === '--no-clobber' || /^--update=none/.test(t) || /^-noclobber$/i.test(t) || /^-[a-z]{0,3}n[a-z]{0,3}$/.test(t)) { noClobber = true; continue; }
    if (t.startsWith('-') && t.length > 1) continue;
    if (['copy', 'move'].includes(verb) && /^\/[a-z-]+$/i.test(t)) continue;  // cmd.exe switches (/y)
    pos.push(a);
  }
  const dest = tdir || pos.pop() || null;
  return { dest, srcs: pos, noClobber };
}
function moveCopy(verb, args, ctx) {
  const { dest, srcs, noClobber } = parseMoveCopy(verb, args);
  if (!dest) return OK;
  if (MOVES.has(verb) && /^(\/dev\/null|nul|\$null)$/i.test(dest.t)) return no('Moving a file to /dev/null destroys it.');
  if (noClobber) return OK;
  if (dest.dyn || dest.glob) return no('The destination is built from a variable or a wildcard, so the guard cannot check whether it would overwrite an existing file. Use the plain folder or file name.');
  const dabs = realish(path.resolve(ctx.here, expandHome(dest.t, ctx.home)));
  const st = statOf(dabs);
  let targets = [];
  if (st?.isDirectory()) targets = srcs.filter((s) => !s.dyn && !s.glob).map((s) => path.join(dabs, path.basename(s.t.replace(/[\\/]+$/, ''))));
  else if (st) targets = [dabs];
  for (const t of targets) {
    const s2 = statOf(t);
    if (s2 && !s2.isDirectory() && !ctx.zones.some((z) => inside(t, z.dir))) return no(OVERWRITE(path.relative(ctx.here, t) || t));
  }
  return OK;
}

function judgeSeg(segWords, redirs, ctx, depth, info) {
  const { home } = ctx;
  const norm = (w) => {  // $HOME/… and $CLAUDE_PROJECT_DIR/… are known, so they count as plain names
    const m = /^(\$HOME|\$\{HOME\}|\$CLAUDE_PROJECT_DIR|\$\{CLAUDE_PROJECT_DIR\})(?=[\\/]|$)/.exec(w.t);
    if (!w.dyn || !m) return w;
    const rest = w.t.slice(m[0].length); const base = /PROJECT/.test(m[0]) ? ctx.projectDir : home;
    return base && !/[$`]/.test(rest) ? { ...w, t: base + rest, dyn: false } : w;
  };
  let words = segWords.map(norm);
  // 1 · redirects: writing over an existing file, or into the safety settings
  const stdin = { text: null, textDyn: false, file: null };
  for (const r0 of redirs) {
    const r = { ...r0, target: norm(r0.target) }; const t = r.target;
    if (/^(>|>>|>\||&>|&>>|>&)$/.test(r.op)) {
      if (r.op === '>&' && /^(\d+|-)$/.test(t.t)) continue;
      if (isNullDevice(t.t)) continue;
      const append = r.op.endsWith('>>');
      if (t.dyn || t.glob) {
        if (SELF_TEXT.test(t.t)) return no(SELF);
        if (!append) return no('Writing to a file whose name is built from variables or wildcards cannot be checked, so it is not allowed. Use the plain file name.');
        continue;
      }
      const abs = realish(path.resolve(ctx.here, expandHome(t.t, home)));
      if (ctx.protect.some((P) => within(abs, P))) return no(SELF);
      const st = statOf(abs);
      if (!append && st && !st.isDirectory() && !/^\/dev\//.test(abs)) return no(OVERWRITE(t.t));
    } else if (r.op === '<') stdin.file = t;
    else if (r.op === '<<' || r.op === '<<-') stdin.text = r0.body ?? '';
    else if (r.op === '<<<') { stdin.text = t.t; stdin.textDyn = t.dyn; }
  }
  const fed = info.pipedIn || stdin.text != null || !!stdin.file;
  if (!words.length) return OK;
  // 2 · wrappers and the real command word
  const u = unwrap(words);
  if (u.fail) return no(u.fail);
  if (u.lookup) return OK;
  words = u.words;
  if (u.chdir) ctx = { ...ctx, here: path.resolve(ctx.here, expandHome(u.chdir, home)) };
  if (!words.length) return OK;
  const w0 = words[0];
  if (w0.dyn) return no('The command name is built from a variable or another command, so what it runs cannot be checked. Write the command out in plain words.');
  const verb = verbOf(w0.t);
  let args = words.slice(1);
  // recycle-bin moves on Windows are a Trash move, not a delete
  if (/SendToRecycleBin/i.test(info.text) && /\[Microsoft\.VisualBasic\.FileIO\.FileSystem\]::Delete(File|Directory)/i.test(words.map((w) => w.t).join(' ')) && !/DeletePermanently/i.test(info.text)) return OK;
  if (w0.glob && !['[', '[['].includes(w0.t) && !w0.t.startsWith('[')) return no('The command name contains a wildcard or braces, so what it runs cannot be checked. Write the command out in plain words.');
  if (verb === 'cd' || verb === 'set-location' || verb === 'pushd' || verb === 'chdir' || verb === 'sl') {
    const to = args.find((a) => !a.t.startsWith('-'));
    if (to && !to.dyn && !to.glob) return { ok: true, here: path.resolve(ctx.here, expandHome(to.t, home)) };
    return OK;
  }
  // 3 · the safety settings
  const sp = selfProtect(verb, args, ctx); if (sp) return sp;
  const sub = (text) => judgeText(text, ctx, depth + 1);
  // 4 · commands that run other commands
  if (verb === 'eval') return args.length ? sub(args.map((a) => a.t).join(' ')) : OK;
  if (verb === 'iex' || verb === 'invoke-expression') return no('Invoke-Expression (iex) runs text as a command, which cannot be checked, so it is not allowed.');
  if (verb === 'start-process' || verb === 'saps' || verb === 'invoke-command' || verb === 'icm') return args.length ? sub(args.filter((a) => !/^-(filepath|argumentlist|scriptblock|wait|nonewwindow|passthru)$/i.test(a.t)).map((a) => a.t).join(' ')) : OK;
  if (SHELLS.has(verb)) {
    let hasC = false; let code = null; let script = null; let stdinMode = false;
    for (let i = 0; i < args.length; i++) {
      const t = args[i].t;
      if (t === '--') { const n = args[i + 1]; if (n) { if (hasC) code = n; else script = n; } break; }
      if (/^[-+][oO]$/.test(t) || t === '--rcfile' || t === '--init-file') { i++; continue; }
      if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(t)) { hasC = true; continue; }
      if (/^-[a-zA-Z]*s[a-zA-Z]*$/.test(t)) { stdinMode = true; continue; }
      if (t.startsWith('-') || t.startsWith('+')) continue;
      if (hasC) code = args[i]; else script = args[i];
      break;
    }
    if (hasC) return code ? sub(code.t) : OK;
    if (script && !stdinMode) return checkScript(script, 'shell', ctx, depth);
    if (!fed && onlyInfo(args)) return OK;
    return no(FEED(verb));
  }
  if (verb === 'source' || verb === '.') return args[0] ? checkScript(args[0], 'shell', ctx, depth) : OK;
  if (verb === 'cmd') {
    const i = args.findIndex((a) => /^\/[ck]$/i.test(a.t));
    if (i >= 0) return sub(args.slice(i + 1).map((a) => a.t).join(' '));
    return onlyInfo(args) ? OK : no(FEED(verb));
  }
  if (PWSH.has(verb)) {
    if (args.some((a) => /^-(e|ec|enc|encodedcommand)$/i.test(a.t))) return no('Hidden (encoded) PowerShell commands are not allowed here.');
    const ci = args.findIndex((a) => /^-(c|command)$/i.test(a.t));
    if (ci >= 0) return args[ci + 1] ? sub(args.slice(ci + 1).map((a) => a.t).join(' ')) : no(FEED(verb));
    const fi = args.findIndex((a) => /^-(f|file)$/i.test(a.t));
    if (fi >= 0) return args[fi + 1] ? checkScript(args[fi + 1], 'pwsh', ctx, depth) : no(FEED(verb));
    for (let i = 0; i < args.length; i++) {
      if (/^-(executionpolicy|ep|workingdirectory|wd|configurationname|outputformat|of|inputformat|if|windowstyle|w|settingsfile)$/i.test(args[i].t)) { i++; continue; }
      if (!args[i].t.startsWith('-')) return checkScript(args[i], 'pwsh', ctx, depth);
    }
    return !fed && onlyInfo(args) ? OK : no(FEED(verb));
  }
  if (isInterp(verb)) return interpreter(verb, args, ctx, depth, { ...stdin, piped: info.pipedIn });
  if (AWKS.has(verb)) {
    let prog = null;
    for (let i = 0; i < args.length; i++) {
      const t = args[i].t;
      if (t === '-f') return args[i + 1] ? checkScript(args[i + 1], 'awk', ctx, depth) : OK;
      if (/^-[Fv]$/.test(t)) { i++; continue; }
      if (t.startsWith('-')) continue;
      prog = args[i]; break;
    }
    return prog ? checkCode(prog.t, 'awk', ctx, depth, `This ${verb} program`) : OK;
  }
  if (verb === 'osascript') {
    const es = []; let file = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i].t === '-e') { if (args[i + 1]) es.push(args[++i].t); continue; }
      if (/^-[ls]$/.test(args[i].t)) { i++; continue; }
      if (!args[i].t.startsWith('-')) { file = args[i]; break; }
    }
    if (es.length) return checkCode(es.join('\n'), 'osascript', ctx, depth, 'This AppleScript');
    if (file) return checkScript(file, 'osascript', ctx, depth);
    if (stdin.text != null) return checkCode(stdin.text, 'osascript', ctx, depth, 'This AppleScript');
    return fed ? no(FEED(verb)) : OK;
  }
  if (verb === 'npx' || verb === 'bunx' || verb === 'pnpx') {
    const rest = []; for (let i = 0; i < args.length; i++) { if (/^(-p|--package)$/.test(args[i].t)) { i++; continue; } if (args[i].t.startsWith('-') && !rest.length) continue; rest.push(args[i].t); }
    return rest.length ? sub(rest.join(' ')) : OK;
  }
  if (['npm', 'pnpm', 'yarn'].includes(verb)) {
    const a = args.filter((x) => !x.t.startsWith('-'));
    if (a[0] && ['exec', 'x', 'dlx'].includes(a[0].t)) return a.length > 1 ? sub(a.slice(1).map((x) => x.t).join(' ')) : OK;
    let name = null;
    if (a[0] && ['run', 'run-script', 'rum', 'urn'].includes(a[0].t)) name = a[1]?.t;
    else if (a[0] && ['test', 't', 'tst', 'start', 'stop', 'restart'].includes(a[0].t)) name = ({ t: 'test', tst: 'test' })[a[0].t] || a[0].t;
    if (name) {
      let dir = ctx.here; let pkg = null;
      for (let k = 0; k < 12 && !pkg; k++) { try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { const up = path.dirname(dir); if (up === dir) break; dir = up; } }
      for (const n of [`pre${name}`, name, `post${name}`]) {
        const s = pkg?.scripts?.[n];
        if (typeof s === 'string') { const r = judgeText(s, { ...ctx, here: dir }, depth + 1); if (!r.ok) return no(`The package script "${n}": ${r.why}`); }
      }
    }
    return OK;
  }
  if (verb === 'xargs' || verb === 'parallel') {
    if (args.some((a) => { const v = verbOf(a.t); return SHELLS.has(v) || PWSH.has(v) || isInterp(v) || AWKS.has(v) || ['eval', 'cmd', 'xargs', 'parallel', 'env', 'sudo'].includes(v); })) return no('Running a shell or an interpreter on a list made by another command (xargs) cannot be checked, so it is not allowed.');
    if (args.some((a) => DELETE_VERBS.has(verbOf(a.t)) || TRASH_VERBS.has(verbOf(a.t)))) return no('Removing a list made by another command (xargs) is not allowed. Name each item.');
    return OK;
  }
  if (verb === 'find') {
    if (args.some((a) => a.t === '-delete')) return no('"find -delete" deletes in bulk.');
    for (let k = 0; k < args.length; k++) {
      if (!/^-(exec|execdir|ok|okdir)$/.test(args[k].t)) continue;
      const inner = []; let j = k + 1;
      for (; j < args.length && args[j].t !== ';' && args[j].t !== '+'; j++) inner.push(args[j]);
      k = j;
      if (!inner.length) continue;
      const v = verbOf(inner[0].t);
      if (DELETE_VERBS.has(v)) return no('"find -exec rm" deletes a list made by another command (bulk).');
      if (SHELLS.has(v) || PWSH.has(v) || isInterp(v) || AWKS.has(v) || ['xargs', 'parallel', 'cmd', 'env', 'sudo', 'eval'].includes(v)) return no('"find -exec sh -c …" runs a shell on a list made by another command, which cannot be checked, so it is not allowed.');
      const r = judgeSeg(inner, [], ctx, depth + 1, { ...info, pipedIn: false }); if (!r.ok) return r;
    }
    return OK;
  }
  // 5 · destructive git
  if (verb === 'git') {
    const g = gitParse(args);
    if (g.fail) return no(`Cannot tell for certain which git command this is (at "${g.fail}"), so it is stopped. Run git without that option.`);
    if (g.configs.some((c) => /^alias\./i.test(c))) return no('A git alias made on the spot can run any command, so it is not allowed.');
    const gctx = g.chdirs.length ? { ...ctx, here: g.chdirs.reduce((h, d) => path.resolve(h, expandHome(d, home)), ctx.here) } : ctx;
    const rest = g.rest; const has = (re) => rest.some((a) => re.test(a.t));
    if (g.sub === 'clean') return no('"git clean" deletes files for good. Move them to the Archive instead.');
    if (g.sub === 'rm' && !has(/^--cached$/)) return no('"git rm" deletes files for good. Move them to the Archive instead.');
    if (g.sub === 'reset' && has(/^--(hard|merge|keep)$/)) return no(`"git reset ${rest.find((a) => /^--(hard|merge|keep)$/.test(a.t)).t}" throws away changes to files for good. Commit or stash them, or copy the files to the Archive first.`);
    if (g.sub === 'restore') return no('"git restore" throws away changes to files for good. Copy the files to the Archive first, and let the person run it.');
    if (g.sub === 'checkout' && (has(/^(--|\.|-f|--force|-p|--patch|--theirs|--ours)$/) ||
      rest.some((a, k) => !a.t.startsWith('-') && !(k > 0 && /^-[bBt]$|^--orphan$/.test(rest[k - 1].t)) && !a.dyn && fs.existsSync(path.resolve(gctx.here, expandHome(a.t, home)))))) {
      return no('"git checkout" on files throws away their changes for good. Copy the files to the Archive first, and let the person run it.');
    }
    if (g.sub === 'switch' && has(/^(-f|--force|--discard-changes)$/)) return no('"git switch --discard-changes" throws away changes for good.');
    if (g.sub === 'stash' && rest[0] && ['drop', 'clear'].includes(rest[0].t)) return no(`"git stash ${rest[0].t}" deletes saved changes for good.`);
    if (g.sub === 'worktree' && rest[0]?.t === 'remove') return no('"git worktree remove" deletes a working folder.');
    if (g.sub === 'config' && rest.some((a) => /^alias\./i.test(a.t))) return no('Making a git alias can hide any command, so it is not allowed.');
    if (g.sub === 'mv') for (const a of rest) if (!a.t.startsWith('-') && touchesProtected(a, gctx, true)) return no(SELF);
    return OK;
  }
  if (verb === 'rsync' && args.some((a) => /^--(delete|remove-source-files)/.test(a.t))) return no('"rsync --delete" deletes in bulk.');
  // 6 · overwrites
  if (verb === 'truncate') return no('"truncate" empties a file for good. Move the old one to the Archive first.');
  if (verb === 'dd') { const of = args.find((a) => /^of=/i.test(a.t)); if (of && !isNullDevice(of.t.slice(3))) return no('"dd of=…" writes straight over a file or a disk. Not allowed.'); return OK; }
  if (verb === 'tee') {
    if (args.some((a) => /^(-a|--append)$/.test(a.t))) return OK;
    for (const a of args) {
      if (a.t.startsWith('-') || isNullDevice(a.t)) continue;
      if (a.dyn || a.glob) return no('Writing to a file whose name is built from variables or wildcards cannot be checked, so it is not allowed. Use the plain file name.');
      const abs = realish(path.resolve(ctx.here, expandHome(a.t, home))); const st = statOf(abs);
      if (st && !st.isDirectory()) return no(OVERWRITE(a.t));
    }
    return OK;
  }
  if (MOVES.has(verb) || COPIES.has(verb)) return moveCopy(verb, args, ctx);
  if (['set-content', 'sc', 'clear-content', 'clc', 'out-file', 'new-item', 'ni'].includes(verb)) {
    if (['out-file'].includes(verb) && args.some((a) => /^-(append|noclobber)$/i.test(a.t))) return OK;
    if (['new-item', 'ni'].includes(verb) && !args.some((a) => /^-force$/i.test(a.t))) return OK;
    let target = null;
    for (let i = 0; i < args.length; i++) {
      if (/^-(path|literalpath|lp|filepath)$/i.test(args[i].t)) { target = args[i + 1]; break; }
      if (/^-(value|encoding|itemtype|type|name|inputobject|width|stream|filter|include|exclude)$/i.test(args[i].t)) { i++; continue; }
      if (args[i].t.startsWith('-')) continue;
      if (!target) target = args[i];
    }
    if (!target) return OK;
    if (target.dyn || target.glob) return no('Writing to a file whose name is built from variables or wildcards cannot be checked, so it is not allowed. Use the plain file name.');
    const abs = realish(path.resolve(ctx.here, expandHome(target.t, home))); const st = statOf(abs);
    if (st && !st.isDirectory()) return no(OVERWRITE(target.t));
    return OK;
  }
  // 7 · deletes and Trash moves
  const isTrash = TRASH_VERBS.has(verb) && (verb !== 'gio' || args[0]?.t === 'trash');
  const isDelete = DELETE_VERBS.has(verb);
  if (!isTrash && !isDelete) {
    // a script run by its path (./x.sh, ../tools/x, ~/bin/x): read it and judge what it does
    if (/^(\.{1,2}[\\/]|[\\/]|~[\\/]|[A-Za-z]:[\\/])/.test(w0.t) && !SYSTEM_DIRS.test(w0.t)) return checkScript(w0, 'auto', ctx, depth);
    return OK;
  }
  const targets = targetsOf(verb, verb === 'gio' ? args.slice(1) : args);
  if (info.bulkWords || info.pipedIn) return no('Removing a list made by another command (xargs, a loop, a pipe) is not allowed. Name each item.');
  if (targets.some((t) => t.glob)) return no('Wildcards (* ? [ ]) are not allowed when removing files. Name each item.');
  if (targets.some((t) => t.dyn)) return no('Names built from variables or other commands are not allowed when removing files. Name each item.');
  if (targets.length > MAX_ITEMS) return no(`More than ${MAX_ITEMS} items in one go is bulk. Name a few at a time.`);
  if (isTrash) return OK;  // a Trash move of named items is a removal, not a delete — allowed
  // permanent delete: every target must sit inside the Archive or the Trash …
  for (const t of targets) {
    const abs = realish(path.resolve(ctx.here, expandHome(t.t, home)));
    const zone = ctx.zones.find((z) => inside(abs, z.dir)) || (inRecycleBin(abs) ? { name: 'Trash' } : null);
    if (!zone) return no(`"${t.t}" is not in the Archive or the Trash. Step 2 first: move it there.`);
    if (ctx.zones.some((z) => abs === z.dir)) return no('Deleting the whole Archive or Trash is bulk.');
  }
  // … and the person's own last message must say "permanently delete" and name each item
  const said = lastUserText(ctx.transcriptPath).toLowerCase();
  if (!/permanently\s+delete/.test(said)) return no('Step 3 missing: the person has not typed "permanently delete" with the item names.');
  const unnamed = targets.map((t) => path.basename(t.t.replace(/[\\/]+$/, ''))).filter((b) => !said.includes(b.toLowerCase()));
  if (unnamed.length) return no(`Step 3 incomplete: the person's message does not name ${unnamed.map((b) => `"${b}"`).join(', ')}.`);
  return OK;
}

function judgeText(text, ctx, depth) {
  if (depth > MAX_DEPTH) return no('This command nests too many commands inside each other to check.');
  text = String(text);
  if (/\[(System\.)?IO\.(File|Directory|FileInfo|DirectoryInfo)\]::(Delete|WriteAll\w*|Move|Replace)\s*\(/i.test(text)) return no('.NET file calls that delete or overwrite files cannot be checked, so they are not allowed.');
  const segs = tokenize(text);
  const bulkWords = /(^|[\s;&|(])(xargs|parallel|while\s+read|for\s+\w+\s+in|foreach|ForEach-Object|%\s*\{)(?=[\s{(]|$)/i.test(text);
  let here = ctx.here;
  for (let s = 0; s < segs.length; s++) {
    const pipedIn = s > 0 && segs[s - 1].op === '|';
    const r = judgeSeg(segs[s].words, segs[s].redirs, { ...ctx, here }, depth, { pipedIn, bulkWords, text });
    if (!r.ok) return r;
    if (r.here) here = r.here;
  }
  for (const sb of segs.subs) { const r = judgeText(sb.text, { ...ctx, here }, depth + 1); if (!r.ok) return r; }
  return OK;
}

function makeCtx({ cwd = process.cwd(), transcriptPath = '', home = os.homedir(), projectDir = '' }) {
  const root = findRoot(cwd) || (projectDir && findRoot(projectDir)) || null;
  return { here: cwd, root, zones: safeZones(root, home), protect: protectedPaths({ cwd, projectDir, home }), transcriptPath, home, projectDir };
}

export function judge({ command = '', cwd = process.cwd(), transcriptPath = '', home = os.homedir(), projectDir = '' }) {
  return judgeText(String(command), makeCtx({ cwd, transcriptPath, home, projectDir }), 0);
}

// Write / Edit / MultiEdit / NotebookEdit: the safety settings are the person's to change, by hand.
export const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
export function judgeFile({ filePath = '', cwd = process.cwd(), home = os.homedir(), projectDir = '' }) {
  if (!filePath) return OK;
  const abs = realish(path.resolve(cwd, expandHome(String(filePath), home)));
  const protect = protectedPaths({ cwd, projectDir, home, extra: [path.dirname(abs)] });
  return protect.some((P) => within(abs, P)) ? no(SELF) : OK;
}

// ── run as a hook ───────────────────────────────────────────────────────────────────────────────────
if (/delete-guard\.mjs$/.test(process.argv[1] || '')) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch { /* fall through with the raw text */ }
    const tool = String(input?.tool_name || '');
    const ti = input?.tool_input || {};
    const command = ti.command ?? '';
    const filePath = ti.file_path ?? ti.notebook_path ?? ti.path ?? '';
    const base = { cwd: input.cwd || process.cwd(), projectDir: process.env.CLAUDE_PROJECT_DIR || '' };
    try {
      const r = FILE_TOOLS.has(tool) ? judgeFile({ ...base, filePath }) : judge({ ...base, command, transcriptPath: input.transcript_path || '' });
      if (!r.ok) say(r.why);
      process.exit(0);
    } catch (e) {
      // Fail closed for anything that looks like a delete, an overwrite or a settings change.
      if (FILE_TOOLS.has(tool) ? /\.claude([\\/]|$)|removals\.local/.test(filePath)
        : /(^|[\s;&|(`])(rm|rmdir|unlink|shred|del|erase|rd|ri|Remove-Item|rimraf|eval|iex|truncate|dd|sh|bash|zsh|git)(\s|$)|>|\.claude|removals\.local/i.test(command)) {
        say(`The guard hit an error (${e.message}), so it stopped this command to be safe.`);
      }
      process.exit(0);
    }
  });
}
