/**
 * NFC badge reading — the real read path used at every station and at the
 * linking desk.
 *
 * Design notes:
 *  - MIANU badges are plain MIFARE-class chips. Some carry an NDEF container,
 *    many do not, so we poll for NDEF *and* the raw tag technologies (NfcA/
 *    NfcB/NfcV/NfcF/IsoDep) in one request and take whichever answers first.
 *    A UID is a UID whether or not the chip speaks NDEF.
 *  - Every read is bounded by a timeout: `requestTechnology` blocks until a
 *    tag appears, so an unbounded wait would strand the operator on a door.
 *  - Android can answer "NFC is on but the system settings toggle is off" in
 *    three different shapes; all are normalized to `enabled: false` so the
 *    screen can show one consistent "turn NFC on" state.
 *  - Expo Go does not ship the native module, and requiring it there throws
 *    at import time (crashing the app on launch). The require is guarded:
 *    in Expo Go every read surfaces NfcUnavailableError and every flow falls
 *    back to the typed alt code. Full NFC needs the EAS dev-client/APK build.
 */
import { readNfcUid } from '@mianu/api-client';

let NfcManager: any = null;
let NfcTech: any = null;
try {
  const nfc = require('react-native-nfc-manager');
  NfcManager = nfc.default ?? nfc.NfcManager ?? nfc;
  NfcTech = nfc.NfcTech ?? null;
} catch {
  // native module absent (Expo Go) — reads report unavailable below
}

const TECHS: any[] = NfcTech
  ? [
      NfcTech.Ndef,
      NfcTech.NfcA,
      NfcTech.NfcB,
      NfcTech.NfcV,
      NfcTech.NfcF,
      NfcTech.IsoDep,
    ]
  : [];

const READ_TIMEOUT_MS = 20_000;

export class NfcUnavailableError extends Error {
  constructor(message = 'nfc_disabled') {
    super(message);
    this.name = 'NfcUnavailableError';
  }
}

export class NfcTimeoutError extends Error {
  constructor() {
    super('nfc_timeout');
    this.name = 'NfcTimeoutError';
  }
}

let registered = false;

/** Idempotent device-level setup. Cheap; safe to call on every screen mount. */
export async function ensureNfcRegistered(): Promise<void> {
  if (!NfcManager || registered) return;
  try {
    await NfcManager.start();
    registered = true;
  } catch {
    // start() throws on devices without any NFC support; reads below will
    // surface the same condition through isNfcEnabled().
  }
}

export async function isNfcSupported(): Promise<boolean> {
  if (!NfcManager) return false;
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function isNfcEnabled(): Promise<boolean> {
  if (!NfcManager) return false;
  try {
    return (await NfcManager.isEnabled()) === true;
  } catch {
    return false;
  }
}

export interface NfcRead {
  uid: string;
  /** Lowercase tech name that produced the UID, for the traceability log. */
  tech: string | null;
}

/**
 * Hold a badge to the phone and resolve with its UID. Rejects with
 * NfcUnavailableError / NfcTimeoutError; always releases the technology
 * request, so a failed read never wedges the reader for the next badge.
 */
export async function readBadgeUid(): Promise<NfcRead> {
  if (!NfcManager) throw new NfcUnavailableError();
  await ensureNfcRegistered();

  if (!(await isNfcEnabled())) {
    throw new NfcUnavailableError();
  }

  let techName: string | null = null;
  try {
    const tech = await Promise.race([
      NfcManager.requestTechnology(TECHS),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new NfcTimeoutError()), READ_TIMEOUT_MS),
      ),
    ]);
    techName = String(tech);

    // NDEF wraps the real tag: drill through getNdefTag() if present.
    let tag: any = await NfcManager.getTag();
    if (tag && typeof tag.getNdefTag === 'function') {
      try {
        tag = (await tag.getNdefTag()) ?? tag;
      } catch {
        // fall through with the outer tag
      }
    }

    const uid = readNfcUid(tag);
    if (!uid) throw new Error('unreadable_tag');
    return { uid, tech: techName };
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // no pending request — nothing to release
    }
  }
}

/** Best-effort cleanup on screen unmount. */
export async function releaseNfc(): Promise<void> {
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // nothing pending
  }
}

export const NfcAdapter = NfcManager?.NfcAdapter ?? null;
