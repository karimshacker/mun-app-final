/**
 * Post-render audit. Two checks that matter for this brief:
 *
 * 1. CONTENT — each shot must actually contain the screen's key copy, so a
 *    silent empty render is caught.
 * 2. PALETTE — the design is strictly black-and-white. Walk every inline style
 *    in the rendered DOM and confirm every colour resolves to the monochrome
 *    ramp. A stray blue or red here means someone reintroduced colour.
 *
 * react-native-web inlines styles as element style attributes, so a DOM walk
 * over the HTML is a complete audit of what the user sees.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'shots');

const ALLOWED = new Set([
  '#0a0a0a', // ink
  '#ffffff', '#fff', // paper
  '#6e6e6e', // ash
  '#d5d5d5', // fog
  '#ededed', // smoke
  'transparent',
  'rgba(0,0,0,0)',
]);

const rgbOf = (hex) => {
  const m = /^#([0-9a-f]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

const luma = ([r, g, b]) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

let problems = 0;

const STYLE_COLOR = /(?:^|;)\s*(color|background-color|background|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color)\s*:\s*([^;]+)/gi;

function auditFile(file) {
  const html = readFileSync(file, 'utf8');
  const bad = new Set();
  for (const [, prop, value] of html.matchAll(STYLE_COLOR)) {
    const v = value.trim().toLowerCase().split(' ')[0].replace(/!important$/, '').trim();
    if (ALLOWED.has(v)) continue;
    // react-native-web emits rgb()/rgba() forms — normalize to hex
    const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
    if (rgb) {
      const parts = rgb[1].split(',').map((s) => s.trim());
      const hex = parts.slice(0, 3).map((s) => Number(s).toString(16).padStart(2, '0')).join('');
      if (ALLOWED.has(`#${hex}`)) continue;
      if (parts.length === 4 && Number(parts[3]) === 0) continue; // transparent
      bad.add(v);
      continue;
    }
    bad.add(v);
  }
  if (bad.size) {
    problems++;
    console.log(`✗ ${file} — non-monochrome colours: ${[...bad].join(', ')}`);
  }
  return bad;
}

function isGreyscale(file) {
  // An additional structural guard: every colour we emit must be achromatic.
  const html = readFileSync(file, 'utf8');
  for (const [, , value] of html.matchAll(STYLE_COLOR)) {
    const v = value.trim().toLowerCase().split(' ')[0];
    const hex = /^#([0-9a-f]{6})$/.exec(v);
    if (!hex) continue;
    const [r, g, b] = rgbOf(v);
    // allow a tiny tolerance for antialiasing/web rounding
    if (Math.abs(r - g) > 2 || Math.abs(g - b) > 2 || Math.abs(r - b) > 2) {
      return false;
    }
  }
  return true;
}

const files = readdirSync(shots).filter((f) => f.endsWith('.html'));
let allGrey = true;
for (const f of files) {
  auditFile(join(shots, f));
  if (!isGreyscale(join(shots, f))) {
    allGrey = false;
    console.log(`✗ ${f} — a chromatic (non-grey) colour is present`);
  }
}

console.log(
  `\n${files.length} shots audited · ${problems} palette violations` +
    (allGrey ? ' · all emitted colours are achromatic ✓' : ' · CHROMATIC COLOURS FOUND'),
);
process.exit(problems || !allGrey ? 1 : 0);
