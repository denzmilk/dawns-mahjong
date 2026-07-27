#!/usr/bin/env node
// Chris downloads art straight into Assets/ with whatever filename it arrived
// with. Vite can only serve from public/, and spaces/brackets/apostrophes in
// filenames break URLs — so this normalises and moves them.
//
// Usage: npm run assets:sync

import { readdirSync, renameSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const DROP_ZONE = 'Assets';
const DESTINATION = join('public', 'assets', 'elvis');
const KEEP = new Set(['README.md', '.DS_Store']);

const kebab = (name) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'"()]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

if (!existsSync(DROP_ZONE)) {
  console.log(`No ${DROP_ZONE}/ folder — nothing to sync.`);
  process.exit(0);
}
mkdirSync(DESTINATION, { recursive: true });

const files = readdirSync(DROP_ZONE).filter(
  (f) => !KEEP.has(f) && statSync(join(DROP_ZONE, f)).isFile()
);

if (files.length === 0) {
  console.log(`${DROP_ZONE}/ is empty. Nothing to sync.`);
  process.exit(0);
}

for (const file of files) {
  const ext = extname(file).toLowerCase().replace('.jpeg', '.jpg');
  let target = `${kebab(basename(file, extname(file)))}${ext}`;
  let n = 2;
  while (existsSync(join(DESTINATION, target))) {
    target = `${kebab(basename(file, extname(file)))}-${n++}${ext}`;
  }
  renameSync(join(DROP_ZONE, file), join(DESTINATION, target));
  console.log(`  ${file}  →  ${DESTINATION}/${target}`);
}

console.log(`\nSynced ${files.length} file(s). Remember these are third-party photographs
going onto a public URL — see docs/tech.md → Asset pipeline → Licensing.`);
