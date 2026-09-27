/**
 * The station picker — the first screen an operator sees after sign-in. In
 * the headless render the committee fetch cannot resolve, which is exactly
 * the degraded state the screen must survive: the conference, meal, and
 * free-item rows still render, the halls card shows its error line.
 */
import { StationScreen } from '@mianu/organizer/src/screens/StationScreen';
export default StationScreen;
