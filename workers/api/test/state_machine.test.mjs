// Path is rewritten by the `test` script after esbuild bundles src/index.ts.
// Run with: pnpm --filter @mianu/api test
import { decideScan } from '../.test-bundle.mjs';

// participants for the fixtures
const P = (over = {}) => ({
  id: 'p1', name: 'Test', committee_id: 'c1',
  badge_uid: 'UID1', alt_code: 'A4F2',
  balance_cents: 5000, meal_plan: 'FULL', status: 'ACTIVE',
  ...over,
});

let pass = 0, fail = 0;
function check(name, got, want) {
  const norm=(o)=>JSON.stringify(o,Object.keys(o).sort());
  const ok=norm(got)===norm(want);
  if (ok) { pass++; } else { fail++; console.log(`  ✗ ${name}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
}

const OUT = (outcome, extra = {}) => ({
  outcome, commit: true, balanceDeltaCents: 0, mealRow: false,
  presenceAfter: { in_conference: 1, hall_id: null, in_hall_since: null },
  ...extra,
});

console.log('conference state machine');
check('first conference check-in',
  decideScan({ stationType: 'CONFERENCE_IN', mealType: null, committeeId: null, presence: { in_conference: 0, hall_id: null, in_hall_since: null }, participant: P() }),
  OUT('CHECKED_IN', { presenceAfter: { in_conference: 1, hall_id: null, in_hall_since: null } }));
check('double check-in rejected',
  decideScan({ stationType: 'CONFERENCE_IN', mealType: null, committeeId: null, presence: { in_conference: 1, hall_id: null, in_hall_since: null }, participant: P() }).outcome,
  'ALREADY_IN');
check('check-out without check-in rejected',
  decideScan({ stationType: 'CONFERENCE_OUT', mealType: null, committeeId: null, presence: { in_conference: 0, hall_id: null, in_hall_since: null }, participant: P() }).outcome,
  'ALREADY_OUT');
check('conference check-out clears hall presence',
  decideScan({ stationType: 'CONFERENCE_OUT', mealType: null, committeeId: null, presence: { in_conference: 1, hall_id: 'c2', in_hall_since: 'x' }, participant: P() }),
  OUT('CHECKED_OUT', { presenceAfter: { in_conference: 0, hall_id: null, in_hall_since: null } }));

console.log('hall state machine');
check('hall check-in requires conference check-in first',
  decideScan({ stationType: 'HALL_IN', mealType: null, committeeId: 'c1', presence: { in_conference: 0, hall_id: null, in_hall_since: null }, participant: P() }).outcome,
  'NOT_IN_CONFERENCE');
check('hall check-in to a different hall moves the participant',
  decideScan({ stationType: 'HALL_IN', mealType: null, committeeId: 'c1', presence: { in_conference: 1, hall_id: 'c2', in_hall_since: null }, participant: P() }).outcome,
  'CHECKED_IN');
check('re-check-in to same hall rejected',
  decideScan({ stationType: 'HALL_IN', mealType: null, committeeId: 'c1', presence: { in_conference: 1, hall_id: 'c1', in_hall_since: null }, participant: P() }).outcome,
  'ALREADY_IN');
check('hall check-out keeps conference presence',
  decideScan({ stationType: 'HALL_OUT', mealType: null, committeeId: 'c1', presence: { in_conference: 1, hall_id: 'c1', in_hall_since: null }, participant: P() }),
  OUT('CHECKED_OUT', { presenceAfter: { in_conference: 1, hall_id: null, in_hall_since: null } }));
check('hall check-out from the wrong hall rejected',
  decideScan({ stationType: 'HALL_OUT', mealType: null, committeeId: 'c1', presence: { in_conference: 1, hall_id: 'c2', in_hall_since: null }, participant: P() }).outcome,
  'ALREADY_OUT');

console.log('meal state machine');
const MEAL = (presence, over = {}) => ({
  stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c1', presence, participant: P(over),
});
const inConf = { in_conference: 1, hall_id: null, in_hall_since: null };
check('lunch served when in plan and funded',
  decideScan(MEAL(inConf)).outcome, 'MEAL_SERVED');
check('lunch denied on a breakfast-only plan',
  decideScan(MEAL(inConf, { meal_plan: 'BREAKFAST_ONLY' })).outcome, 'MEAL_NOT_IN_PLAN');
check('lunch denied with no meal plan',
  decideScan(MEAL(inConf, { meal_plan: 'NONE' })).outcome, 'MEAL_NOT_IN_PLAN');
check('breakfast allowed on breakfast-only plan',
  decideScan({ ...MEAL(inConf), mealType: 'BREAKFAST', participant: P({ meal_plan: 'BREAKFAST_ONLY' }) }).outcome, 'MEAL_SERVED');
check('meal denied at zero balance',
  decideScan(MEAL(inConf, { balance_cents: 0 })).outcome, 'INSUFFICIENT_BALANCE');
check('meal denied for a blocked participant',
  decideScan(MEAL(inConf, { status: 'BLOCKED' })).outcome, 'BLOCKED');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
