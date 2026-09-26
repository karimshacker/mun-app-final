/**
 * Renders the scan receipt in the DENIED tone — the inverted white-on-black
 * state, which is the highest-stakes screen in the app (a refused meal).
 */
import { Receipt, toneFor, messageFor, kindFor } from '@mianu/organizer/src/screens/ScanScreen';
import type { ScanResult } from '@mianu/types';

const RESULT: ScanResult = {
  outcome: 'INSUFFICIENT_BALANCE',
  participant: {
    id: 'p1',
    name: 'Sami Benali',
    committeeId: 'GA',
    badgeUid: '04a1b2c3',
    altCode: 'A4F2',
    balanceCents: 0,
    mealPlan: 'FULL',
    status: 'ACTIVE',
  },
  balanceCents: 0,
  at: '2026-09-26T09:41:00Z',
};

export default function Denied() {
  return (
    <Receipt
      result={RESULT}
      stationLabel="MEAL STATION · LUNCH"
      onDone={() => {}}
    />
  );
}
export { toneFor, messageFor, kindFor };
