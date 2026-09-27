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
  'organizer-shell': ['MIANU-SM IV · ORGANIZER', 'Phone number', 'PIN', 'Sign in'],
  'organizer-station': ['SELECT STATION', 'Conference', 'Meals', 'Free items', 'Halls', 'BREAKFAST LINES', 'LUNCH LINES', 'JOURNAL · ONE PER DAY', 'MAIN ENTRANCE · IN'],
  // Live screens SSR their initial (pre-effect) state: header, not a blank.
  // Their data arrives from effects, which renderToString never fires — the
  // degraded/error copy is asserted by the api tests, not here.
  'organizer-inbox': ['INBOX', 'Loading…'],
  'organizer-broadcast': ['BROADCAST', 'Audience', 'ALL STAFF', 'Title', 'Message'],
  'organizer-water': ['WATER RUNS', 'Loading…'],
  'organizer-chat': ['HEAD ↔ DEPUTY', 'Message the head', 'Send'],
  'organizer-board': ['PRESENCE BOARD', 'Loading…'],
  'organizer-receipt': ['No balance left', 'Sami Benali', 'BALANCE 0'],
  'organizer-grid-receipts': [
    // the exhausted receipt: inverted, and the tag counts the plan's allowance
    'Plan used up',
    '6 OF 6 USED',
    // the day-closed receipt: hold tone, allowance tag does not apply here
    'Not serving now',
    'OUTSIDE THE GRID',
    'Meals left on this plan',
  ],
  // step 1 of the enroll flow — the details form only appears after a chip read
  'admin-link': ['LINK BADGE', 'Hold badge to scan', 'Scan the chip, enter the delegate'],
  'admin-topup': ['BALANCE · TOP-UP', 'Amount', 'Commit top-up', 'Refund · complaint'],
  'admin-roster': ['ROSTER', 'Search by name or alt code'],
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
