/**
 * Content check: each rendered shot must contain the copy that screen exists
 * to show. Catches a silent empty render or a screen that rendered the wrong
 * branch (e.g. a scan screen stuck in the receipt state).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'shots');

// Must be present in BOTH the ios and android render.
const EXPECT = {
  'organizer-shell': ['Hold badge to scan', 'Type code instead', 'Scan'],
  'organizer-inbox': ['INBOX', 'unread', 'Opening ceremony moved'],
  'organizer-chat': ['HEAD ↔ DEPUTY', 'Message the head', 'Send'],
  'organizer-board': ['PRESENCE BOARD', 'on duty', 'IN HALL 3', 'ON BREAK'],
  'organizer-receipt': ['No balance left', 'Sami Benali', 'BALANCE 0'],
  // step 1 of the link flow — 'Confirm link' only appears after a chip read
  'admin-link': ['LINK BADGE', 'Hold badge to scan', 'Type code instead'],
  'admin-topup': ['BALANCE · TOP-UP', 'Amount', 'Commit top-up', 'Refund · complaint'],
};

let fail = 0;
for (const [name, needles] of Object.entries(EXPECT)) {
  for (const osName of ['ios', 'android']) {
    const file = join(shots, `${name}.${osName}.html`);
    let html;
    try {
      html = readFileSync(file, 'utf8');
    } catch {
      console.log(`✗ ${name}.${osName} missing`);
      fail++;
      continue;
    }
    const missing = needles.filter((n) => !html.includes(n));
    if (missing.length) {
      console.log(`✗ ${name}.${osName} missing copy: ${missing.join(', ')}`);
      fail++;
    } else {
      console.log(`  ${name}.${osName} ok`);
    }
  }
}

console.log(`\n${fail === 0 ? 'all screens render expected copy' : `${fail} problems`}`);
process.exit(fail ? 1 : 0);
