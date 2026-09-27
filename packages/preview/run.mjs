import { render } from './render.mjs';

const CASES = [
  ['organizer-shell', './cases/organizer-shell.tsx', 'ORGANIZER APP · SIGN IN'],
  ['organizer-station', './cases/organizer-station.tsx', 'ORGANIZER APP · STATIONS'],
  ['organizer-inbox', './cases/organizer-inbox.tsx', 'ORGANIZER APP · INBOX'],
  ['organizer-chat', './cases/organizer-chat.tsx', 'ORGANIZER APP · COMMS'],
  ['organizer-broadcast', './cases/organizer-broadcast.tsx', 'ORGANIZER APP · BROADCAST'],
  ['organizer-board', './cases/organizer-board.tsx', 'ORGANIZER APP · BOARD'],
  ['organizer-water', './cases/organizer-water.tsx', 'ORGANIZER APP · WATER'],
  ['organizer-receipt', './cases/organizer-receipt.tsx', 'ORGANIZER APP · RECEIPT'],
  [
    'organizer-grid-receipts',
    './cases/organizer-grid-receipts.tsx',
    'ORGANIZER APP · GRID OUTCOMES',
  ],
  ['admin-link', './cases/admin-link.tsx', 'IT ADMIN · LINK BADGE'],
  ['admin-topup', './cases/admin-topup.tsx', 'IT ADMIN · BALANCE'],
  ['admin-roster', './cases/admin-roster.tsx', 'IT ADMIN · ROSTER'],
];

for (const [name, entry, label] of CASES) {
  console.log(name);
  try {
    await render(name, entry, label);
  } catch (e) {
    console.log(`  FAILED ${e && e.message ? e.message.split('\n')[0] : e}`);
  }
}
