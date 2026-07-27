#!/usr/bin/env node
// Renders the home-screen icons from one SVG, so there is a single source of truth
// for the icon and no hand-exported PNGs to drift from it. Run manually; the output
// is committed.
//
//   npm run build:icons
//
// Android's launcher crops a maskable icon to whatever shape the device uses, so the
// maskable variant keeps its artwork inside the safe circle with felt bleeding to the
// edges — otherwise the tile gets its corners shaved off.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SVG = resolve('public/favicon.svg');
const OUT = resolve('public/icons');
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SVG, 'utf8');
const browser = await chromium.launch();

const ICONS = [
  { file: 'icon-192.png', size: 192, inset: 0 },
  { file: 'icon-512.png', size: 512, inset: 0 },
  // ~20% inset keeps the tile inside the safe zone of any mask shape.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.2 },
];

for (const icon of ICONS) {
  const page = await browser.newPage({
    viewport: { width: icon.size, height: icon.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><style>
       html,body{margin:0;padding:0;width:100%;height:100%;background:#12301F;}
       .wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
       svg{width:${(1 - icon.inset * 2) * 100}%;height:${(1 - icon.inset * 2) * 100}%;}
     </style><div class="wrap">${svg}</div>`
  );
  const buffer = await page.screenshot({ omitBackground: false });
  writeFileSync(resolve(OUT, icon.file), buffer);
  console.log(`  ${icon.file} (${icon.size}×${icon.size}${icon.inset ? ', maskable' : ''})`);
  await page.close();
}

await browser.close();
console.log('\n✓ icons written to public/icons/');
