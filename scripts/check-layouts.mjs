#!/usr/bin/env node
// Proves every board shape is playable before it ships: 144 tiles (even, so it can be
// cleared in pairs), no two tiles sharing a cell on a layer, and nothing floating with
// no tile beneath it. Run while authoring a shape — the ASCII masks make the picture
// readable but say nothing about whether it stands up.
//
//   npm run check:layouts

import { LAYOUTS } from '../src/board/Layouts.js';

let bad = 0;
for (const [id, layout] of Object.entries(LAYOUTS)) {
  const byLayer = new Map();
  for (const t of layout.tiles) {
    if (!byLayer.has(t.layer)) byLayer.set(t.layer, []);
    byLayer.get(t.layer).push(t);
  }
  const counts = [...byLayer.keys()].sort((a, b) => a - b).map((l) => `${l}:${byLayer.get(l).length}`);
  const problems = [];

  if (layout.tiles.length % 2 !== 0) problems.push(`odd tile count ${layout.tiles.length}`);

  const overlaps = (a, b) => a.x < b.x + 2 && b.x < a.x + 2 && a.y < b.y + 2 && b.y < a.y + 2;
  for (const [layer, tiles] of byLayer) {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (overlaps(tiles[i], tiles[j])) problems.push(`layer ${layer} overlap at ${tiles[i].x},${tiles[i].y}`);
      }
    }
  }
  for (const t of layout.tiles) {
    if (t.layer === 0) continue;
    const below = (byLayer.get(t.layer - 1) || []).filter((b) => overlaps(t, b));
    if (below.length === 0) problems.push(`floating tile at ${t.x},${t.y} layer ${t.layer}`);
  }

  const width = Math.max(...layout.tiles.map((t) => t.x)) + 2 - Math.min(...layout.tiles.map((t) => t.x));
  const depth = Math.max(...layout.tiles.map((t) => t.y)) + 2 - Math.min(...layout.tiles.map((t) => t.y));
  const flag = problems.length ? '✗' : '✓';
  if (problems.length) bad++;
  console.log(
    `${flag} ${id.padEnd(14)} ${String(layout.tiles.length).padStart(3)} tiles  ` +
      `layers ${counts.join(' ').padEnd(26)} ${width / 2}×${depth / 2} tiles wide/deep` +
      (problems.length ? `\n    ${[...new Set(problems)].slice(0, 4).join('\n    ')}` : '')
  );
}
process.exit(bad ? 1 : 0);
