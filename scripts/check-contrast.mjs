// Verifies WCAG AA contrast for the theme's text/background pairs.
// Usage: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/ui/theme/index.ts', import.meta.url), 'utf8');

function block(name) {
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  const out = {};
  for (const [, k, v] of m[1].matchAll(/^\s*(\w+):\s*'([^']+)'/gm)) out[k] = v;
  return out;
}

function parse(c) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number);
  return { r, g, b, a };
}
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

let failed = 0;
for (const scheme of ['light', 'dark']) {
  const t = block(scheme === 'light' ? 'light' : 'dark');
  const c = (k) => parse(t[k]);
  const bg = c('background');
  const surface = c('surface');
  const pairs = [
    ['text / background', c('text'), bg, 4.5],
    ['text / surface', c('text'), surface, 4.5],
    ['textMuted / background', c('textMuted'), bg, 4.5],
    ['textMuted / surface', c('textMuted'), surface, 4.5],
    ['accent / background', c('accent'), bg, 4.5],
    ['accent / surface', c('accent'), surface, 4.5],
    ['onAccent / accent', c('onAccent'), c('accent'), 4.5],
    ['danger / surface', c('danger'), surface, 4.5],
    ['warning / warningMuted', c('warning'), over(c('warningMuted'), surface), 4.5],
    ['text / accentSoft', c('text'), over(c('accentSoft'), surface), 4.5],
    ['onHero / heroStart', c('onHero'), c('heroStart'), 4.5],
    ['onHero / heroEnd', c('onHero'), c('heroEnd'), 4.5],
    ['heroRing / heroStart (UI 3:1)', c('heroRing'), c('heroStart'), 3],
    ['heroRing / heroEnd (UI 3:1)', c('heroRing'), c('heroEnd'), 3],
    ...['Steps', 'Energy', 'Time', 'Workouts'].map((m) => [
      `metric${m} / metric${m}Soft`,
      c(`metric${m}`),
      over(c(`metric${m}Soft`), surface),
      3,
    ]),
  ];
  for (const [name, fg, back, min] of pairs) {
    const r = ratio(fg, back);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${scheme.padEnd(5)} ${name.padEnd(34)} ${r.toFixed(2)} (min ${min})`);
  }
}
process.exit(failed ? 1 : 0);
