# Install on iPhones without a paid account (sideloading)

Distribute both iOS apps to iPhones **for free** using an **unsigned .ipa**
built by CI, signed on-site with **free Apple IDs** by a sideloading tool —
Dadoum's Sideloader, Sideloadly, SideStore, or AltStore.

Read the reality box first — it determines your conference plan.

## ⚠️ Reality check (read before planning around NFC)

- **What sideloaders actually do.** Dadoum's Sideloader (and Sideloadly,
  SideStore, AltStore) automate Apple's own free-provisioning servers — they
  request certificates, App IDs, and profiles from Apple exactly like Xcode
  does, just without a Mac. **They cannot forge or force entitlements.**
- **NFC on a free Apple ID is not guaranteed.** The NFC Tag Reading
  entitlement (`com.apple.developer.nfc.readersession.formats`) is granted
  **by Apple's servers when the profile is created**. Free personal teams
  have historically been **refused** it — Xcode reports *"Personal
  development teams do not support the Near Field Communication Tag Reading
  capability"*, and free-generated profiles have been observed rejecting NDEF
  sessions on Apple's own forums. Claims that free NFC "just works" via
  sideloaders are unverified; treat any such claim as something to **test on
  one phone before committing your plan to it**.
- **This repo is built for both outcomes.** The .ipa declares the NFC
  entitlement and the `NFCReaderUsageDescription` string (so nothing crashes
  if it *is* granted), and the apps **normalize a refused NFC session into
  the standard "NFC unavailable" state** — every station falls back to typed
  alt codes, which hit the same backend routes. Worst case: fully functional
  apps without tap-to-scan.
- **Free-account hard limits** (Apple's developer-account help page):
  **3 devices per Apple ID**, **10 App IDs per 7 days**, profiles **expire
  after 7 days**. The 7-day life comfortably covers a 3-day event from a
  day-0 install; 30 iPhones ⇒ **10 free Apple IDs × 3 devices each**.

## What you need

1. **The unsigned .ipa files** — built automatically by this repo:
   GitHub → **Actions → ios-unsigned-ipa** → latest run → download
   `mianu-organizer-ios-unsigned` and `mianu-admin-ios-unsigned`.
   (Each artifact is a zipped `Payload/` — sideloaders take the `.ipa` as-is.)
2. **Free Apple IDs** — one per 3 iPhones. Create dedicated ones
   (`mianu-station-1@…` … `mianu-station-10@…`) and keep their passwords in a
   private sheet; never commit them.
3. **A signing computer** (Linux, Windows, or macOS) with one of:
   - **Dadoum's Sideloader** (CLI, this guide's namesake):
     `git clone https://github.com/Dadoum/Sideloader --recursive`
     then `dub build -b release` (needs a D toolchain — see the repo README
     for exact flags and current build steps).
   - **Sideloadly** (GUI, Windows/macOS) — the easiest option for a
     non-technical operator; same Apple free-provisioning machinery under
     the hood.
   - **SideStore** — signs and installs *on the iPhone itself* (needs a
     one-time pairing with a computer or WireGuard-based refresh).
4. **The iPhones**: iPhone 7 or newer (CoreNFC hardware), iOS current-ish,
   unlocked, USB cable to the signing computer (not needed for SideStore).
5. **Internet on the phone at first launch** — iOS validates the
   provisioning profile against Apple once before the app can run.

## Step-by-step: sign and install one phone

1. Connect the iPhone by USB; tap **Trust** on the phone when prompted.
2. In your sideloader: select the `.ipa`, enter the **Apple ID for this
   batch of 3 phones** + password, start signing. The tool contacts Apple,
   registers the device (consumes 1 of that ID's 3 slots), generates the
   certificate + profile, and installs.
3. On the phone: **Settings → General → VPN & Device Management** → tap the
   Apple-ID developer profile → **Trust**.
4. Launch the app once **with internet** (one-time profile validation).
   Log in with the staff phone + PIN (provisioned out-of-band).
5. **NFC verdict test**: open a scan screen and hold a badge.
   - NFC system sheet slides up → **the free team was granted NFC** — full
     tap-to-scan works. 🎉
   - Message says NFC unavailable / prompts for the alt code → Apple refused
     the entitlement for free provisioning. The app is still fully usable
     via typed codes; for tap-to-scan see *If NFC is refused* below.
6. Repeat per phone; each phone eats one device slot of its batch's Apple ID.

## The 30-iPhone, 3-day plan

| Item | Value |
|---|---|
| Apple IDs | 10 free IDs, 3 devices each |
| Install day | Day 0 — profiles valid 7 days, covers the event |
| During event | Nothing to do, unless a phone is wiped/reinstalled → re-sign with its batch ID |
| After event | Apps stop launching after day 7 (profile expiry); re-sign to revive |
| NFC | Unknown until step 5 on the first phone — test it day −2, not day 0 |

### If NFC is refused (likely, based on the record)

Your three realistic options, all already supported by this repo:

1. **Typed alt codes on iPhones** — zero extra work. Every scan screen
   already falls back; enrollment/top-up/lookup accept codes and badge-UID
   lookups identically. Slower at doors than a tap, fully traceable.
2. **Android station phones** — the **existing APKs** (Actions → android-apk)
   have **full NFC, free, unlimited devices, no 7-day expiry**. Mixed fleet:
   Android at meal/hall stations, iPhones for comms/inbox/board/water.
3. **Paid Apple Developer Program ($99)** — the only path to NFC on all 30
   iPhones; then use TestFlight instead (docs/TESTFLIGHT_GUIDE.md, or
   docs/TESTFLIGHT_NO_API_KEY.md for the no-API-key flow).

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| Scan screen says NFC unavailable on a native (non-Expo-Go) install | Apple refused the NFC entitlement for the free profile → this is the *expected* free-tier behavior; the app fell back to alt codes by design. Use the options above. |
| App quits immediately on launch after ~7 days | Profile expired → re-sign with the batch's Apple ID (re-uses the same App ID slot). |
| **Untrusted Developer** alert on launch | Settings → General → VPN & Device Management → Trust (step 3). |
| App launches only with internet | One-time profile validation — connect once, then offline works. |
| Signing fails: device limit / App ID limit for this Apple ID | The batch ID already has 3 devices (or 10 App IDs in 7 days) → use a fresh Apple ID or unregister a device in the tool. |
| Signing fails with anisette/`Error 500`-style messages | Apple's machine-verification endpoints are flaky/rotating — update the sideloader to the latest commit/release and retry; sideloader issues track this closely. |
| Install says the app can't be opened on this iPhone | iPhone 5s/6/6s have no NFC reader hardware; also verify iOS isn't below the app's minimum. |
| "Missing Entitlement" in device console at scan time | Same as row 1 — the entitlement didn't make it into the free profile. |

## Route comparison

| | Sideload (this guide) | Android APK | Paid + TestFlight |
|---|---|---|---|
| Cost | Free | Free | $99/yr |
| NFC | **Apple's choice — test it** | ✅ always | ✅ always |
| Devices | 3 per Apple ID, ~10 IDs → 30 | Unlimited | 10k testers |
| Expiry | 7 days (re-sign) | None | 90 days per build |
| Install effort | USB + trust + ID per batch | Open link | Public link |
