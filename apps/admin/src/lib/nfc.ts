/**
 * NFC badge reading for the IT admin app — same real read path as the
 * organizer app: poll NDEF and the raw tag technologies together, bound every
 * read by a timeout, normalize the UID to lowercase hex, and always release
 * the technology request in a finally block so the reader never wedges
 * between badges at the linking desk.
 *
 * The native require is guarded: Expo Go does not ship react-native-nfc-
 * manager, and requiring it there throws at import time (crash on launch).
 * In Expo Go every read surfaces NfcUnavailableError and every flow falls
 * back to the typed alt code. Full NFC needs the EAS dev-client/APK build.
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

export async function ensureNfcRegistered(): Promise<void> {
  if (!NfcManager || registered) return;
  try {
    await NfcManager.start();
    registered = true;
  } catch {
    // device without any NFC support; isNfcEnabled() reports the same below
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
  tech: string | null;
}

/**
 * Hold a badge to the phone and resolve with its UID. Rejects with
 * NfcUnavailableError / NfcTimeoutError; always releases the request.
 */
export async function readBadgeUid(): Promise<NfcRead> {
  if (!NfcManager) throw new NfcUnavailableError();
  await ensureNfcRegistered();

  if (!(await isNfcEnabled())) {
    throw new NfcUnavailableError();
  }

  let techName: string | null = null;
  try {
    let tech: string;
    try {
      tech = await Promise.race([
        NfcManager.requestTechnology(TECHS),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new NfcTimeoutError()), READ_TIMEOUT_MS),
        ),
      ]);
    } catch (e) {
      // Free-signed installs (personal Apple ID via Xcode or a sideloader
      // like Dadoum's) lack the NFC Tag Reading entitlement: CoreNFC refuses
      // the session with "Missing Entitlement". Normalize every such hardware
      // refusal to NfcUnavailableError so screens fall back to the typed alt
      // code instead of surfacing a raw scan failure.
      if (e instanceof NfcTimeoutError) throw e;
      throw new NfcUnavailableError(
        e instanceof Error ? e.message : 'nfc_start_failed',
      );
    }
    techName = String(tech);

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
      // nothing pending
    }
  }
}

export async function releaseNfc(): Promise<void> {
  if (!NfcManager) return;
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {
    // nothing pending
  }
}

export const NfcAdapter = NfcManager?.NfcAdapter ?? null;
