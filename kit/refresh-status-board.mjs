#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(root, 'status-board.json');
const jsPath = path.join(root, 'status-board.js');

try {
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const feed = `window.__STATUS_BOARD__ = ${JSON.stringify(parsed, null, 2)};\n`;
  const temporary = `${jsPath}.spineos-partial-${process.pid}`;
  fs.writeFileSync(temporary, feed, 'utf8');
  fs.renameSync(temporary, jsPath);
  console.log(`PASS · status-board.js regenerated from status-board.json · ${Buffer.byteLength(feed)} bytes`);
} catch (error) {
  console.error(`FAIL · dashboard feed was not changed · ${error.message}`);
  process.exit(1);
}
