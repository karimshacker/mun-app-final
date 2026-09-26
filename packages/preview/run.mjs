import { render } from './render.mjs';

const CASES = [
  ['organizer-shell', './cases/organizer-shell.tsx', 'ORGANIZER APP · SCAN'],
  ['organizer-inbox', './cases/organizer-inbox.tsx', 'ORGANIZER APP · INBOX'],
  ['organizer-chat', './cases/organizer-chat.tsx', 'ORGANIZER APP · COMMS'],
  ['organizer-board', './cases/organizer-board.tsx', 'ORGANIZER APP · BOARD'],
  ['organizer-receipt', './cases/organizer-receipt.tsx', 'ORGANIZER APP · RECEIPT'],
  ['admin-link', './cases/admin-link.tsx', 'IT ADMIN · LINK BADGE'],
  ['admin-topup', './cases/admin-topup.tsx', 'IT ADMIN · BALANCE'],
];

for (const [name, entry, label] of CASES) {
  console.log(name);
  try {
    await render(name, entry, label);
  } catch (e) {
    console.log(`  FAILED ${e && e.message ? e.message.split('\n')[0] : e}`);
  }
}
