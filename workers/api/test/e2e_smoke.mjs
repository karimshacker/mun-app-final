/**
 * Local E2E smoke test against `wrangler dev` (D1 local, .dev.vars secret).
 * Exercises: login → refresh → scan flow → badge linking → badge scan →
 * notifications → chat → presence → board → location → logout revocation.
 *
 * Setup (from workers/api):
 *   rm -rf .wrangler/state
 *   npx wrangler d1 migrations apply mianu-app-db --local
 *   npx wrangler d1 execute mianu-app-db --local --file test/fixtures/e2e_seed.sql -y
 *   printf '%s' 'JWT_SECRET=local-smoke-secret' > .dev.vars
 *   npx wrangler dev --port 8799 --local
 *   node test/e2e_smoke.mjs
 *
 * The meal grid and scan state persist across runs against the same local DB;
 * reset .wrangler/state for a fully deterministic run.
 */
const BASE = 'http://127.0.0.1:8799';
// The public worker runs alongside (port 8798) with --persist-to the same
// local D1, so water orders created over the real public endpoint are
// visible to the API — the production topology, minus the network.
const PUB = 'http://127.0.0.1:8798';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  ✗  ${name} ${extra}`); }
};
const j = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const authed = (token) => (opts = {}) => ({ ...opts, headers: { ...(opts.headers ?? {}), Authorization: `Bearer ${token}` } });

console.log('auth');
const login = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '+213999000001', pin: '424242' }) });
ok('login 200', login.status === 200, JSON.stringify(login.body));
ok('login returns user', login.body.user?.role === 'HEAD');
const T = login.body.accessToken;
const withT = authed(T);

const badLogin = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '+213999000001', pin: '000000' }) });
ok('wrong pin 401', badLogin.status === 401);

const refresh = await j('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: login.body.refreshToken }) });
ok('refresh 200', refresh.status === 200 && !!refresh.body.accessToken);

console.log('committees + scan flow (alt code first, chip after linking)');
const comms = await j('/api/committees', withT());
ok('committees 200 with 8 rows, one hall each', comms.status === 200 && comms.body.committees?.length === 8 && new Set(comms.body.committees.map((c) => c.hallName)).size === 8, JSON.stringify(comms.body));

console.log('free item (journal) — handed out before any meal today');
// Journal: once per conference day, on any plan, never touching the meal
// grid. Served BEFORE the first meal scan below, so meal1's "5 remaining"
// assertion doubles as the guarantee that the journal consumed no meal slot.
const jScan = (clientScanId) => j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'FREE_ITEM', clientScanId }) });
const j1 = await jScan(`smoke-journal-d1-${Date.now()}`);
ok('journal served', j1.body.outcome === 'ITEM_SERVED', JSON.stringify(j1.body));
const j1again = await jScan(`smoke-journal-d1b-${Date.now()}`);
ok('journal twice same day → ITEM_ALREADY_SERVED', j1again.body.outcome === 'ITEM_ALREADY_SERVED', JSON.stringify(j1again.body));

const mealScanId = `smoke-meal-${Date.now()}`;
const meal1 = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c_ag1', clientScanId: mealScanId }) });
ok('meal served, 5 remaining', meal1.body.outcome === 'MEAL_SERVED' && meal1.body.mealsRemaining === 5, JSON.stringify(meal1.body));
const mealRetry = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c_ga', clientScanId: mealScanId }) });
ok('retried scan idempotent', mealRetry.body.outcome === 'MEAL_SERVED', JSON.stringify(mealRetry.body));
const meal2 = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c_ga', clientScanId: `smoke-meal2-${Date.now()}` }) });
ok('second same-day lunch blocked', meal2.body.outcome === 'MEAL_ALREADY_SERVED', JSON.stringify(meal2.body));
const zeroBal = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK2', stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c_cs', clientScanId: `smoke-zero-${Date.now()}` }) });
ok('zero balance + wrong meal plan → MEAL_NOT_IN_PLAN', zeroBal.body.outcome === 'MEAL_NOT_IN_PLAN', JSON.stringify(zeroBal.body));

// Regression: conference-wide meal lines send no committeeId — the app's
// picker does this on purpose, so a MEAL scan must not require it.
const mealNoCommittee = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'MEAL', mealType: 'BREAKFAST', clientScanId: `smoke-nocomm-${Date.now()}` }) });
ok('meal scan without committeeId → MEAL_SERVED', mealNoCommittee.body.outcome === 'MEAL_SERVED', JSON.stringify(mealNoCommittee.body));

// Halls are still scoped: a hall scan without a committee is a bad request.
const hallNoCommittee = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_IN', clientScanId: `smoke-hallnocomm-${Date.now()}` }) });
ok('hall scan without committeeId → 400', hallNoCommittee.status === 400, JSON.stringify(hallNoCommittee.body));

const cin = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'CONFERENCE_IN', clientScanId: `smoke-in-${Date.now()}` }) });
// Hall check-in for the committee whose hall SMK1's delegate sits in.
ok('conference in via alt code → CHECKED_IN or ALREADY_IN', cin.body.outcome === 'CHECKED_IN' || cin.body.outcome === 'ALREADY_IN', JSON.stringify(cin.body));

console.log('admin routes: roster, link, badge scan, topup');
const adminLogin = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '+213999000003', pin: '424242' }) });
ok('admin login', adminLogin.status === 200);
const A = adminLogin.body.accessToken;
const withA = authed(A);

const search = await j('/api/admin/participants?q=Smoke', withA());
ok('roster search finds both', search.status === 200 && search.body.participants?.length === 2, JSON.stringify(search.body));

const link = await j('/api/admin/link-badge', { method: 'POST', ...withA(), body: JSON.stringify({ participantId: 'p_smoke1', badgeUid: '04a1b2c3', altCode: 'SMK1' }) });
ok('link badge ok', link.status === 200 && link.body.ok === true, JSON.stringify(link.body));

// Only after linking does the chip resolve — the exact production order. The
// participant may already be in (or already out on a re-run); both are fine.
const badgeIn = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ badgeUid: '04a1b2c3', stationType: 'CONFERENCE_OUT', clientScanId: `smoke-out-${Date.now()}` }) });
ok('badge scan resolves after linking → CHECKED_OUT or ALREADY_OUT', badgeIn.body.outcome === 'CHECKED_OUT' || badgeIn.body.outcome === 'ALREADY_OUT', JSON.stringify(badgeIn.body));

const dup = await j('/api/admin/link-badge', { method: 'POST', ...withA(), body: JSON.stringify({ participantId: 'p_smoke2', badgeUid: '04a1b2c3', altCode: 'SMK2' }) });
ok('duplicate UID 409', dup.status === 409, JSON.stringify(dup.body));

// Enrollment: scan a blank chip, submit details — participant created and
// chip bound in one call. Conflict paths are hard stops.
const enroll = await j('/api/admin/enroll', { method: 'POST', ...withA(), body: JSON.stringify({ badgeUid: '04ee0001', name: 'Test Delegate', committeeId: 'c_ag4', altCode: 'TS01' }) });
ok('enroll creates participant + links chip', enroll.status === 200 && enroll.body.ok === true && typeof enroll.body.participantId === 'string', JSON.stringify(enroll.body));
const byNewUid = await j('/api/admin/lookup?badgeUid=04ee0001', withA());
ok('enrolled chip resolves via lookup', byNewUid.status === 200 && byNewUid.body.participant?.name === 'Test Delegate', JSON.stringify(byNewUid.body));

// The participant IT just enrolled is immediately usable at every station —
// here the journal desk: once today, then blocked.
const enrolledJournal = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'TS01', stationType: 'FREE_ITEM', clientScanId: `smoke-journal-enrolled-${Date.now()}` }) });
ok('enrolled delegate gets the journal', enrolledJournal.body.outcome === 'ITEM_SERVED', JSON.stringify(enrolledJournal.body));
const enrolledJournal2 = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'TS01', stationType: 'FREE_ITEM', clientScanId: `smoke-journal-enrolled2-${Date.now()}` }) });
ok('enrolled delegate journal once per day', enrolledJournal2.body.outcome === 'ITEM_ALREADY_SERVED', JSON.stringify(enrolledJournal2.body));
const dupEnroll = await j('/api/admin/enroll', { method: 'POST', ...withA(), body: JSON.stringify({ badgeUid: '04ee0001', name: 'Test Delegate 2', committeeId: 'c_ag4', altCode: 'TS02' }) });
ok('re-enrolling a linked chip → 409', dupEnroll.status === 409, JSON.stringify(dupEnroll.body));
const dupCode = await j('/api/admin/enroll', { method: 'POST', ...withA(), body: JSON.stringify({ badgeUid: '04ee0002', name: 'Test Delegate 3', committeeId: 'c_ag4', altCode: 'TS01' }) });
ok('re-using a taken alt code → 409', dupCode.status === 409, JSON.stringify(dupCode.body));
const badComm = await j('/api/admin/enroll', { method: 'POST', ...withA(), body: JSON.stringify({ badgeUid: '04ee0003', name: 'Test Delegate 4', committeeId: 'c_nope', altCode: 'TS04' }) });
ok('enroll with unknown committee → 400', badComm.status === 400, JSON.stringify(badComm.body));

const topup = await j('/api/admin/topup', { method: 'POST', ...withA(), body: JSON.stringify({ altCode: 'SMK2', amountCents: 2500, reason: 'TOPUP' }) });
ok('topup returns a balance number', topup.status === 200 && typeof topup.body.balanceCents === 'number', JSON.stringify(topup.body));

// Regression: the Balance screen's tap-to-top-up resolves participants by
// linked badge UID through the same lookup route.
const byUid = await j('/api/admin/lookup?badgeUid=04a1b2c3', withA());
ok('lookup by linked badge UID finds participant', byUid.status === 200 && byUid.body.participant?.id === 'p_smoke1', JSON.stringify(byUid.body));
const byUnknownUid = await j('/api/admin/lookup?badgeUid=ffffffff', withA());
ok('lookup by unlinked UID returns null', byUnknownUid.status === 200 && byUnknownUid.body.participant === null, JSON.stringify(byUnknownUid.body));
const byBoth = await j('/api/admin/lookup?badgeUid=04a1b2c3&altCode=SMK1', withA());
ok('lookup rejects two identifiers', byBoth.status === 400, JSON.stringify(byBoth.body));

console.log('meal allowance integrity after the journal handout');
// The precise per-day cap still holds after the journal went out: today's
// lunch (served earlier) stays blocked — the journal neither reset nor
// consumed anything on the meal grid.
const capHeld = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'MEAL', mealType: 'LUNCH', clientScanId: `smoke-capheld-${Date.now()}` }) });
ok('per-day meal cap holds after journal → MEAL_ALREADY_SERVED', capHeld.body.outcome === 'MEAL_ALREADY_SERVED', JSON.stringify(capHeld.body));

console.log('notifications + chat');
const note = await j('/api/notifications', { method: 'POST', ...withT(), body: JSON.stringify({ title: 'Smoke broadcast', body: 'Ignite the grills.', audience: 'ALL' }) });
ok('broadcast created', note.status === 200, JSON.stringify(note.body));
const inbox = await j('/api/notifications', withT());
ok('inbox lists broadcast', inbox.body.notifications?.some((n) => n.title === 'Smoke broadcast'), JSON.stringify(inbox.body.notifications?.slice(0, 2)));
const firstNote = inbox.body.notifications?.[0];
ok('inbox rows carry sender name', !!firstNote?.from);
const read = await j(`/api/notifications/${firstNote.id}/read`, { method: 'POST', ...withT() });
ok('mark read ok', read.status === 200);

const chat = await j('/api/chat', { method: 'POST', ...withT(), body: JSON.stringify({ body: 'smoke message' }) });
ok('chat send', chat.status === 200 && chat.body.message?.body === 'smoke message');
const chatGet = await j('/api/chat', withT());
ok('chat history', chatGet.body.messages?.some((m) => m.body === 'smoke message'));

console.log('deputy: comms parity + broadcast fan-out');
const depLogin = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '+213999000004', pin: '424242' }) });
ok('deputy login', depLogin.status === 200 && depLogin.body.user?.role === 'DEPUTY', JSON.stringify(depLogin.body));
const D = depLogin.body.accessToken;
const withD = authed(D);

const depChat = await j('/api/chat', { method: 'POST', ...withD(), body: JSON.stringify({ body: 'deputy checking in' }) });
ok('deputy can send on the head↔deputy channel', depChat.status === 200, JSON.stringify(depChat.body));
const headSees = await j('/api/chat', withT());
ok('head sees the deputy message', headSees.body.messages?.some((m) => m.body === 'deputy checking in'));

const depNote = await j('/api/notifications', { method: 'POST', ...withD(), body: JSON.stringify({ title: 'Deputy broadcast', body: 'Water for Hall 2.', audience: 'ALL' }) });
ok('deputy can broadcast', depNote.status === 200, JSON.stringify(depNote.body));

const scopedNote = await j('/api/notifications', { method: 'POST', ...withT(), body: JSON.stringify({ title: 'CS only', body: 'Session shift.', audience: 'c_cs' }) });
ok('committee-scoped broadcast accepted', scopedNote.status === 200, JSON.stringify(scopedNote.body));
const badAud = await j('/api/notifications', { method: 'POST', ...withT(), body: JSON.stringify({ title: 'x', body: 'y', audience: 'c_ghost' }) });
ok('unknown audience → 404', badAud.status === 404, JSON.stringify(badAud.body));

console.log('presence + board + location');
const orgLogin = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: '+213999000002', pin: '424242' }) });
ok('organizer login', orgLogin.status === 200);
const O = orgLogin.body.accessToken;
const withO = authed(O);

// The earlier CONFERENCE_OUT scan removed the participant; bring them back and
// put them in a hall so the board has something to show.
await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'CONFERENCE_IN', clientScanId: `smoke-rein-${Date.now()}` }) });
const hallIn = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_IN', committeeId: 'c_ag1', clientScanId: `smoke-hallin-${Date.now()}` }) });
ok('hall check-in accepted', hallIn.body.outcome === 'CHECKED_IN', JSON.stringify(hallIn.body));

const presence = await j('/api/presence', withT());
ok('presence shows smoke participant in Hall 1', presence.body.rows?.some((r) => r.participantId === 'p_smoke1' && r.hallName === 'Hall 1'), JSON.stringify(presence.body.rows?.slice(0, 2)));

console.log('hall check-out cycle');
// A hall-out at a different hall must never clear the participant's hall.
const wrongHallOut = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_OUT', committeeId: 'c_cs', clientScanId: `smoke-wrongout-${Date.now()}` }) });
ok('hall-out for a different hall never checks out', wrongHallOut.body.outcome !== 'CHECKED_OUT', JSON.stringify(wrongHallOut.body));
const hallOut = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_OUT', committeeId: 'c_ag1', clientScanId: `smoke-hallout-${Date.now()}` }) });
ok('hall check-out accepted', hallOut.body.outcome === 'CHECKED_OUT', JSON.stringify(hallOut.body));
const presenceAfterOut = await j('/api/presence', withT());
ok('presence clears after hall-out', !(presenceAfterOut.body.rows ?? []).some((r) => r.participantId === 'p_smoke1' && r.hallName === 'Hall 1'), JSON.stringify(presenceAfterOut.body.rows?.slice(0, 2)));
const hallOutTwice = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_OUT', committeeId: 'c_ag1', clientScanId: `smoke-hallout2-${Date.now()}` }) });
ok('hall-out with nobody inside → ALREADY_OUT', hallOutTwice.body.outcome === 'ALREADY_OUT', JSON.stringify(hallOutTwice.body));
const hallInAgain = await j('/api/scan', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK1', stationType: 'HALL_IN', committeeId: 'c_ag1', clientScanId: `smoke-hallin2-${Date.now()}` }) });
ok('re-entry after hall-out → CHECKED_IN', hallInAgain.body.outcome === 'CHECKED_IN', JSON.stringify(hallInAgain.body));

const loc = await j('/api/location', { method: 'POST', ...withO(), body: JSON.stringify({ lat: 36.7538, lng: 3.0588 }) });
ok('location ping ok', loc.status === 200);
const board = await j('/api/board', withT());
ok('board shows organizer with GPS fix', board.status === 200 && board.body.rows?.some((r) => r.userId === 'u_test_org' && r.lat !== null), JSON.stringify(board.body.rows?.slice(0, 3)));
const brk = await j('/api/me/break', { method: 'POST', ...withO(), body: JSON.stringify({ onBreak: true }) });
ok('break toggle ok', brk.status === 200);
const board2 = await j('/api/board', withT());
ok('board reflects break flag', board2.body.rows?.some((r) => r.userId === 'u_test_org' && r.onBreak === true), JSON.stringify(board2.body.rows?.slice(0, 3)));

const orgInbox = await j('/api/notifications', withO());
ok('organizer inbox receives head and deputy broadcasts',
  orgInbox.body.notifications?.some((n) => n.title === 'Smoke broadcast') &&
  orgInbox.body.notifications?.some((n) => n.title === 'Deputy broadcast'));

console.log('role guardrails');
const orgBoard = await j('/api/board', withO());
ok('organizer denied the head board', orgBoard.status === 403, String(orgBoard.status));
const orgAdmin = await j('/api/admin/lookup?altCode=SMK1', withO());
ok('organizer denied admin lookup', orgAdmin.status === 403, String(orgAdmin.status));
const orgBroadcast = await j('/api/notifications', { method: 'POST', ...withO(), body: JSON.stringify({ title: 'nope', body: 'nope', audience: 'ALL' }) });
ok('organizer cannot broadcast', orgBroadcast.status === 403, String(orgBroadcast.status));
const headTopup = await j('/api/admin/topup', { method: 'POST', ...withT(), body: JSON.stringify({ altCode: 'SMK2', amountCents: 100, reason: 'COMP' }) });
ok('head denied admin topup', headTopup.status === 403, String(headTopup.status));

console.log('water orders: public endpoint → staff loop');
const orderRes = await fetch(`${PUB}/order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ committee: 'c_cs', quantity: 12, note: 'e2e run', from: 'e2e-runner' }),
});
const waterOrder = await orderRes.json().catch(() => ({}));
ok('public water order created', orderRes.status === 201 && typeof waterOrder.ref === 'string', JSON.stringify(waterOrder));

const wList = await j('/api/water', withT());
ok('staff water list shows the order', wList.status === 200 && wList.body.orders?.some((o) => o.ref === waterOrder.ref), JSON.stringify(wList.body));
const wOrgList = await j('/api/water', withO());
ok('organizer sees the water list too', wOrgList.status === 200 && Array.isArray(wOrgList.body.orders));
const wAck = await j(`/api/water/${waterOrder.ref}/status`, { method: 'POST', ...withT(), body: JSON.stringify({ status: 'ACKNOWLEDGED' }) });
ok('head acknowledges the order', wAck.status === 200, JSON.stringify(wAck.body));
const wDel = await j(`/api/water/${waterOrder.ref}/status`, { method: 'POST', ...withT(), body: JSON.stringify({ status: 'DELIVERED' }) });
ok('head marks it delivered', wDel.status === 200, JSON.stringify(wDel.body));
const wAgain = await j(`/api/water/${waterOrder.ref}/status`, { method: 'POST', ...withT(), body: JSON.stringify({ status: 'DELIVERED' }) });
ok('double-delivery rejected 409', wAgain.status === 409, JSON.stringify(wAgain.body));
const wOrgSet = await j(`/api/water/${waterOrder.ref}/status`, { method: 'POST', ...withO(), body: JSON.stringify({ status: 'CANCELLED' }) });
ok('organizer cannot change water status', wOrgSet.status === 403, String(wOrgSet.status));
const wBad = await j('/api/water/WO-ZZZZ/status', { method: 'POST', ...withT(), body: JSON.stringify({ status: 'DELIVERED' }) });
ok('unknown ref → 404', wBad.status === 404, JSON.stringify(wBad.body));

// The public worker stamps a notification into every inbox on insert; the
// sender is not a user, so this also proves the SYSTEM-sender fallback.
const inboxAfterWater = await j('/api/notifications', withO());
ok('water order landed in the organizer inbox as a SYSTEM notice',
  inboxAfterWater.body.notifications?.some((n) => n.from === 'SYSTEM' && n.title.startsWith('Water for')),
  JSON.stringify(inboxAfterWater.body.notifications?.slice(0, 2)));

console.log('public order tracking + health');
const track = await fetch(`${PUB}/order/${waterOrder.ref}`);
const tracked = await track.json().catch(() => ({}));
// By this point the water block above has walked the order to DELIVERED —
// the public tracking endpoint must reflect exactly that.
ok('public order GET tracks status changes → DELIVERED', track.status === 200 && tracked.status === 'DELIVERED', JSON.stringify(tracked));
const missing = await fetch(`${PUB}/order/WO-ZZZZ`);
ok('unknown public ref → 404', missing.status === 404, String(missing.status));
const apiHealth = await fetch(`${BASE}/health`);
ok('api health ok', apiHealth.status === 200);
const pubHealth = await fetch(`${PUB}/health`);
ok('public health ok', pubHealth.status === 200);

console.log('logout + session revocation');
const out = await j('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: refresh.body.refreshToken }) });
ok('logout ok', out.status === 200);
const afterOut = await j('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: refresh.body.refreshToken }) });
ok('refresh revoked after logout', afterOut.status === 401, JSON.stringify(afterOut.body));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
