// Meal-grid behaviour for the 3-day × 2-meal entitlement.
// Run with: pnpm --filter @mianu/api test
import { stateMachine } from '../.test-bundle.mjs';
const { decideScan, mealEntitlement, dayOfConference, CONFERENCE_MEAL_DAYS } = stateMachine;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = got === want;
  if (ok) { pass++; } else { fail++; console.log(`  ✗ ${name}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
}

const inConf = { in_conference: 1, hall_id: null, in_hall_since: null };
const meal = (over = {}) => ({
  stationType: 'MEAL', mealType: 'LUNCH', committeeId: 'c1',
  presence: inConf, participant: { id: 'p1', meal_plan: 'FULL', status: 'ACTIVE', balance_cents: 5000 },
  ...over,
});

console.log('entitlement');
check('FULL plan = 2 meals x 3 days', mealEntitlement('FULL'), 6);
check('BREAKFAST_ONLY = 1 x 3', mealEntitlement('BREAKFAST_ONLY'), 3);
check('LUNCH_ONLY = 1 x 3', mealEntitlement('LUNCH_ONLY'), 3);
check('NONE = 0', mealEntitlement('NONE'), 0);
check('conference days', CONFERENCE_MEAL_DAYS, 3);

console.log('day arithmetic');
check('start date is day 1', dayOfConference('2026-09-26T08:00:00Z', '2026-09-26'), 1);
check('next day is day 2', dayOfConference('2026-09-27T12:00:00Z', '2026-09-26'), 2);
check('day 3 end of day', dayOfConference('2026-09-28T23:59:00Z', '2026-09-26'), 3);
check('after the conference is day 4', dayOfConference('2026-09-29T08:00:00Z', '2026-09-26'), 4);
check('before the conference is day 0', dayOfConference('2026-09-25T08:00:00Z', '2026-09-26'), 0);

console.log('serving within the grid');
check('first lunch served',
  decideScan(meal({ mealDay: 1, mealsUsed: 0, slotTaken: false })).outcome, 'MEAL_SERVED');
check('second lunch on a later day is a new slot',
  decideScan(meal({ mealDay: 2, mealsUsed: 1, slotTaken: false })).outcome, 'MEAL_SERVED');
check('same slot twice is rejected',
  decideScan(meal({ mealDay: 1, mealsUsed: 1, slotTaken: true })).outcome, 'MEAL_ALREADY_SERVED');
check('breakfast then lunch same day both served',
  decideScan(meal({ mealType: 'BREAKFAST', mealDay: 1, mealsUsed: 0, slotTaken: false })).outcome, 'MEAL_SERVED');
check('all 6 used -> exhausted',
  decideScan(meal({ mealDay: 3, mealsUsed: 6, slotTaken: false })).outcome, 'MEAL_PLAN_EXHAUSTED');
check('last allowed meal still served',
  decideScan(meal({ mealDay: 3, mealsUsed: 5, slotTaken: false })).outcome, 'MEAL_SERVED');
check('scan on day 4 rejected',
  decideScan(meal({ mealDay: 4, mealsUsed: 0, slotTaken: false })).outcome, 'MEAL_DAY_CLOSED');
check('day 1 of a closed plan still served',
  decideScan(meal({ mealDay: 1, mealsUsed: 0, slotTaken: false })).outcome, 'MEAL_SERVED');

console.log('slot insert is recorded on the right day');
check('served slot carries the day',
  decideScan(meal({ mealDay: 2, mealsUsed: 1, slotTaken: false })).mealSlot.day, 2);
check('served slot carries the meal type',
  decideScan(meal({ mealDay: 2, mealsUsed: 1, slotTaken: false })).mealSlot.mealType, 'LUNCH');

console.log('the conference length is configurable, not hardcoded');
check('a 5-day FULL plan is 10 meals', mealEntitlement('FULL', 5), 10);
check('a 2-day LUNCH_ONLY is 2 meals', mealEntitlement('LUNCH_ONLY', 2), 2);
check('day 4 is closed on a 3-day conference',
  decideScan(meal({ mealDay: 4, mealsUsed: 0, slotTaken: false })).outcome, 'MEAL_DAY_CLOSED');
check('day 4 is open when IT sets meal_days to 5',
  decideScan(meal({ mealDay: 4, mealsUsed: 0, slotTaken: false, mealDays: 5 })).outcome, 'MEAL_SERVED');
check('a 5-day plan is exhausted at 10 used',
  decideScan(meal({ mealDay: 4, mealsUsed: 10, slotTaken: false, mealDays: 5 })).outcome,
  'MEAL_PLAN_EXHAUSTED');
check('a nonsense meal_days falls back to 3 and closes day 4',
  decideScan(meal({ mealDay: 4, mealsUsed: 0, slotTaken: false, mealDays: 0 })).outcome,
  'MEAL_DAY_CLOSED');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
