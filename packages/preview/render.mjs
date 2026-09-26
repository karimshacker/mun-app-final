/**
 * Renders the RN screens to static HTML+SVG via react-native-web, then writes
 * a PNG with headless Chrome. This is how the UI is verified in this
 * environment: there is no macOS (so no iOS simulator) and no Android
 * emulator, so the browser is the closest available renderer. Layout and type
 * are what we are checking — native chrome (status bar, NFC sheets) is not.
 */
import { build } from 'esbuild';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

// esbuild resolves react-native -> react-native-web via this alias.
// nodePaths must include this package's own node_modules: react-native-web
// lives here (it is a dev-time dependency of this preview package only), and
// esbuild resolves the alias relative to nodePaths, not the entry file.
const opts = {
  alias: { 'react-native': 'react-native-web' },
  bundle: true,
  format: 'esm',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  loader: { '.js': 'jsx' },
  define: { 'process.env.EXPO_PUBLIC_API_URL': '"http://localhost:8787"' },
  absWorkingDir: root,
  nodePaths: [join(here, 'node_modules'), join(root, 'node_modules')],
  // React must stay external: the server renderer imports its own copy, and a
  // second copy inside the bundle is what breaks hooks ("invalid hook call").
  external: ['react', 'react/jsx-runtime'],
  // The compiled screens reference the React global (jsx: classic); inject it.
  inject: [join(here, 'react-shim.js')],
  legalComments: 'none',
};

const SIZES = {
  ios: { w: 390, h: 844 }, // iPhone 14 / 15 point size
  android: { w: 412, h: 915 }, // Pixel-class density-independent size
};

async function bundle(entry, outfile) {
  await build({
    ...opts,
    entryPoints: [join(here, entry)],
    outfile,
  });
}

function page(body, w, h, label) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#fff;}
  *{box-sizing:border-box;}
  #phone{
    width:${w}px;height:${h}px;overflow:hidden;position:relative;
    background:#fff;
  }
  #label{font:700 11px/1 monospace;color:#6E6E6E;padding:0 0 6px 0;letter-spacing:1px;}
</style></head><body>
<div id="label">${label} · ${w}×${h}</div>
<div id="phone">${body}</div>
</body></html>`;
}

async function shot(name, html, osName) {
  const dir = join(here, 'shots');
  mkdirSync(dir, { recursive: true });
  const htmlPath = join(dir, `${name}.${osName}.html`);
  const pngPath = join(dir, `${name}.${osName}.png`);
  writeFileSync(htmlPath, html);
  const { w } = SIZES[osName];
  const h = SIZES[osName].h + 20;
  execFileSync('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--window-size=${w},${h}`,
    `--screenshot=${pngPath}`,
    `--default-background-color=FFFFFFFF`,
    htmlPath,
  ], { stdio: 'pipe' });
  return pngPath;
}

export async function render(name, entry, label) {
  const outfile = join(here, '.preview', `${name}.mjs`);
  await bundle(entry, outfile);
  const mod = await import(outfile);
  const Component = mod.default ?? mod.App;
  for (const osName of Object.keys(SIZES)) {
    const body = renderToString(React.createElement(Component));
    await shot(name, page(body, SIZES[osName].w, SIZES[osName].h, label), osName);
    console.log(`  ${name} · ${osName} ok`);
  }
}
