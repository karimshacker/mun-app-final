/**
 * Renders the scan receipt for the two grid outcomes that did not exist before
 * the 3-day x 2-meal change: a plan with all its slots used, and a scan outside
 * the conference grid entirely. Both must stay legible under the denial styling.
 */
import { Receipt, toneFor, messageFor, kindFor } from '@mianu/organizer/src/screens/ScanScreen';
import type { ScanResult } from '@mianu/types';

const EXHAUSTED: ScanResult = {
  outcome: 'MEAL_PLAN_EXHAUSTED',
  participant: {
    id: 'p1',
    name: 'Sami Benali',
    committeeId: 'GA',
    badgeUid: '04a1b2c3',
    altCode: 'A4F2',
    balanceCents: 400,
    mealPlan: 'FULL',
    status: 'ACTIVE',
  },
  mealsRemaining: 0,
  at: '2026-09-28T13:02:00Z',
};

const DAY_CLOSED: ScanResult = {
  outcome: 'MEAL_DAY_CLOSED',
  participant: {
    id: 'p2',
    name: 'Nadia Cherif',
    committeeId: 'SOCHUM',
    badgeUid: '04d4e5f6',
    altCode: 'B7C1',
    balanceCents: 3200,
    mealPlan: 'BREAKFAST_ONLY',
    status: 'ACTIVE',
  },
  mealsRemaining: 1,
  at: '2026-09-29T07:15:00Z',
};

export default function GridReceipts() {
  return (
    <>
      <Receipt result={EXHAUSTED} stationLabel="MEAL STATION · LUNCH" onDone={() => {}} />
      <Receipt result={DAY_CLOSED} stationLabel="MEAL STATION · BREAKFAST" onDone={() => {}} />
    </>
  );
}
export { toneFor, messageFor, kindFor };
