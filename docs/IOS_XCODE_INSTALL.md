# Installing the apps on iPhone with Xcode

This guide gets **MIANU Organizer** and **MIANU IT Admin** running on a
physical iPhone via Xcode.

**Pick your lane first:**

| Lane | Apple account | NFC | Cost | Best for |
|---|---|---|---|---|
| **A. Free build** | Free Apple ID (Personal Team) | ❌ no NFC — alt codes everywhere | $0 | Most organizer iPhones (30-device plan below) |
| **B. Paid build** | Apple Developer Program ($99/yr) | ✅ full NFC | $99 | Station iPhones at doors & meal lines |
| **C. Android stations** | none | ✅ full NFC | $0 | Extra/full NFC capacity for free |

> **Reality check (why lane A has no NFC):** Apple does not let free
> (personal team) accounts sign apps that carry the NFC Tag Reading
> capability. Xcode fails with *"Personal development teams … do not support
> the Near Field Communication Tag Reading capability."* No setting changes
> this — the entitlement itself requires a paid team. The app is otherwise
> 100% functional without it: every scan screen ships with a typed alt-code
> fallback (the pre-printed code on each badge).

## What you need

- A Mac with **Xcode 16+** (App Store) and **CocoaPods**
  (`sudo gem install cocoapods`, or `brew install cocoapods`)
- An **iPhone** with iOS 17+, its cable, and the passcode handy
- An **Apple ID** (free is fine for lane A) — same one logged into the App Store
- This repo cloned on the Mac, with **Node 20+** and **pnpm**
  (`npm i -g pnpm`) installed

## 1. Prepare the project

Both apps are Expo (CNG) projects: there is no committed `ios/` folder, so
generate it. Choose the command that matches your lane.

**Lane A — free Apple ID (strip the NFC entitlement, no NFC):**

```bash
pnpm install
cd apps/organizer && pnpm ios:free && cd ../..
cd apps/admin    && pnpm ios:free && cd ../..
```

`pnpm ios:free` runs `expo prebuild --platform ios -c` and then removes the
NFC entitlements, usage string, and Pod entitlement entries from the
generated project (via `packages/build/strip-ios-nfc-entitlements.mjs`), and
drops a `.ios-free-mode` marker in each app directory. It also bakes the
deployed API URL into the bundle, so a free build needs no other setup.
Verify before opening Xcode:

```bash
cd apps/organizer && pnpm ios:nfc-check && cd ../..
cd apps/admin    && pnpm ios:nfc-check && cd ../..
```

Each check must print `OK: no NFC entitlement — free (personal team) signing
will be accepted.` If it prints `FAIL`, do not continue to Xcode.

**Lane B — paid team, full NFC:**

```bash
pnpm install
cd apps/organizer
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo prebuild --platform ios -c
rm -f .ios-free-mode   # marker from an earlier free build, if present
cd ../admin
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo prebuild --platform ios -c
rm -f .ios-free-mode
cd ../..
cd apps/organizer && pnpm ios:nfc-check -- --expect-nfc && cd ../..
cd apps/admin    && pnpm ios:nfc-check -- --expect-nfc && cd ../..
```

The checks must print `OK: NFC entitlement present`.

> Re-run prebuild any time `app.json` changes. Never hand-edit `ios/` —
> your edits will be overwritten at the next prebuild. (`app.json` itself
> always keeps the NFC config; stripping only ever touches the generated
> `ios/` directory, so a paid build needs no code changes.)

## 2. Open in Xcode and configure signing

1. Launch Xcode → **File ▸ Open…** → pick
   `apps/organizer/ios/MIANUOrganizer.xcworkspace`
   (created by the prebuild's pod install; the **.xcworkspace**, not the
   `.xcodeproj` — pods live in the workspace)
2. In the left Project navigator click the blue project icon
   (**MIANUOrganizer**) → select the **target** → **Signing & Capabilities**
3. Tick **Automatically manage signing**
4. **Team:** choose your team — the **Personal Team (your Apple ID)** on
   lane A, your **paid team** on lane B. First time: Xcode ▸ Settings ▸
   Accounts ▸ **+** ▸ sign in, then return here and pick the team
5. **Bundle Identifier:** must be unique across all of Apple. If the default
   `tn.mianu.smiv.organizer` is taken or signing complains, set
   `tn.mianu.smiv.organizer.<yourname>` (and the admin equivalent
   `tn.mianu.smiv.admin.<yourname>`)
6. Repeat 1–5 for the admin app
   (`apps/admin/ios/MIANUITAdmin.xcworkspace`)

> **Free-account limits:** one app per bundle id, max ~10 App IDs per week,
> **max 3 devices per Apple ID**, installs expire after **7 days** (just
> re-plug and press Run). Paid accounts: 100 devices per year, 1-year
> installs.

## 3. Put the iPhone into Developer Mode

iOS 16+ requires this once:

1. Plug the iPhone into the Mac with the cable
2. Unlock the phone; when asked **"Trust this computer?"** → **Trust**,
   enter the passcode
3. On the phone: **Settings ▸ Privacy & Security ▸ Developer Mode ▸ On** →
   restart the phone when prompted, then confirm the toggle

(If the toggle is missing, open Xcode once with the phone connected —
iOS shows it only after Xcode has "seen" the device.)

## 4. Build and run

1. In Xcode's device menu (next to the scheme) select your **iPhone**
2. Scheme **MIANUOrganizer** → destination your iPhone → press **⌘R**
3. **First run will fail** with *"Untrusted developer"* — that is expected:
   - On the iPhone: **Settings ▸ General ▸ VPN & Device Management**
     (or **Profiles & Device Management**) → tap your Apple ID under
     **Developer App** → **Trust**
4. Press **⌘R** again — the organizer app launches
5. Repeat (open workspace → select device → ⌘R) for the **admin** app

## 5. Sign in and test

- API: the deployed worker `https://mianu-api.karimshacker1234.workers.dev`
  is baked into the JS bundle by `EXPO_PUBLIC_API_URL` at prebuild time —
  keep the env var set (see step 1)
- Accounts (dry run): all PINs `424242`
  - Organizer app: `+213555000001` (head) or `+213555000002` (organizer)
  - Admin app: `+213555000003` (IT admin)
- **NFC test** (lanes B/C only): Scan tab → *Hold badge to scan* → tap a
  linked badge. On lane A the scan screen shows *"NFC is off. Turn it on in
  settings, or type the code on the badge"* — that is correct free-build
  behaviour; use the typed code instead
- Type a demo alt code to test any flow without chips: the demo roster is
  `DM01`…`DM05` (DM01 = grid exhausted, DM04 = no plan)
- The journal desk hands one copy per delegate per day (any plan)

If the app shows *No connection*: the bundle was built without the API URL —
re-run step 1 with `EXPO_PUBLIC_API_URL` set and press ⌘R again.

## Free Apple ID: 30 iPhones for the 3 days

The constraints, exactly:

1. **NFC cannot work on a free account.** The Tag Reading entitlement is
   paid-only (see the reality check above). The 30 free iPhones run on typed
   alt codes — the same server routes, zero functional loss except tap speed.
2. **Each free Apple ID installs on max 3 iPhones.** 30 iPhones ⇒ **10 free
   Apple IDs**, 3 phones each. Apps expire after 7 days — irrelevant for a
   3-day conference if you build **the day before day 1**.
3. Free accounts may register ~10 App IDs per week. We need only 2 (one per
   app, per bundle id suffix) — nowhere near the cap.

Recommended sequence (all on one Mac):

1. **Day −1:** create/collect 10 free Apple IDs and set up Developer Mode +
   *Trust this computer* on all 30 phones.
2. Run the lane A flow (step 1) with `EXPO_PUBLIC_API_URL` set.
3. For each Apple ID: sign in in Xcode, plug its 3 phones, set the team,
   change the bundle id suffix if required, **⌘R** the organizer app, then
   the admin app. Trust the developer profile on each phone (step 4.3).
   Budget **~15 minutes per Apple ID** (3 phones × 2 apps), about 2.5–3
   hours for all 10.
4. Smoke-test one phone per Apple ID: log in with a real account, run one
   alt-code scan against the demo roster (`DM01`…`DM05`).
5. **During the event** nothing re-signs; phones stay offline-tolerant
   because the API URL is baked in. If a phone is replaced mid-event, it
   must belong to an Apple ID that still has a free device slot.

**Restoring NFC later (paid account):** delete the `.ios-free-mode` marker in
each app dir and re-run the lane B prebuild — `app.json` still carries the
full NFC config, so nothing in the repo changes.

## Android station phones (free, full NFC)

Any Android 8+ phone with NFC (volunteers' phones, school spares) becomes a
full-NFC station by sideloading the APK. Sideloaded builds are unlimited and
free — no EAS quota, no store review. Build **locally** so the APKs are
independent of Expo/EAS quotas and always carry the latest code:

**One-time setup on the Mac:**

1. **JDK 17** — `brew install --cask temurin@17`
2. **Android SDK** — install Android Studio once, or just the command line:
   `brew install --cask android-commandlinetools`, then:
   ```bash
   sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;27.1.12297006"
   ```
3. Add to `~/.zshrc` and restart the shell:
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   export JAVA_HOME=$(/usr/libexec/java_home -v 17)
   ```

**Build the APKs (no accounts, no quotas):**

```bash
cd apps/organizer && npx expo run:android --variant release
cd ../admin    && npx expo run:android --variant release
```

`expo run:android --variant release` builds installable release APKs locally
at `apps/*/android/app/build/outputs/apk/release/app-release.apk`. Set
`EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev` in the
same shell first, or the APK will point at localhost and show *No connection*
(same gotcha as iOS). The first Gradle build downloads dependencies and can
take 20–40 minutes; later builds are much faster.

**Install on a station phone:** copy the APK to the phone (AirDrop doesn't do
Android — use a cable, Google Drive, or a local upload), open it, allow
*Install unknown apps* for that source when prompted, done. Or plug the phone
in with USB debugging enabled and let `expo run:android` install directly.

**Station roles:** the organizer app (check-in/out, meals, journal) on door
and meal-line phones; the admin app (badge linking, top-ups) on the IT desk
phone. On Android, NFC just works — no entitlement gate, and the same
alt-code fallback exists for chips that fail to read.

> The older APK links in the README were built by EAS **before** the
> journal/committee changes; treat them as stale. Locally built APKs are the
> source of truth.

## Paid account (lane B) summary

$99/year buys: NFC on iOS (the only way), up to 100 devices/year via Ad Hoc,
1-year installs, TestFlight. With a paid account skip the stripping step
entirely — the plain prebuild already carries the NFC entitlements, and the
rest of this guide (signing with the paid team, Developer Mode, ⌘R) is
unchanged.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **"Personal development teams … do not support the Near Field Communication Tag Reading capability"** | You are signing lane B entitlements with a free team. Either run the lane A flow (`pnpm ios:free`, then re-verify with `pnpm ios:nfc-check`) or sign with a paid team |
| **Signing requires a development team** | Xcode ▸ Settings ▸ Accounts: add the Apple ID, then select the team (step 2.4) |
| **Failed to register bundle identifier** | The id is taken — change it per step 2.5 (both apps) |
| **"Your maximum number of registered devices … reached"** | The current free Apple ID already has 3 iPhones — move to the next Apple ID, or drop a device first at <https://developer.apple.com/account/resources/devices/list> |
| **"Untrusted developer" on launch** | Settings ▸ General ▸ VPN & Device Management → Trust (step 4.3) |
| **Developer Mode missing** | Connect to Xcode first, then check Settings ▸ Privacy & Security |
| **Pod install errors / build fails in Pods** | `cd apps/organizer/ios && pod repo update && pod install`, rebuild |
| **App installs but shows "No connection"** | Prebuild ran without `EXPO_PUBLIC_API_URL` — redo step 1 with it set |
| **7 days passed and the app won't open** | Free provisioning expired — reconnect the phone, ⌘R in Xcode |
| **NFC doesn't react (lane B/C)** | iPhone must be XS or newer for background tag reads; hold the badge flat against the top edge; check Settings ▸ General ▸ NFC is not disabled |
| **Gradle says SDK/JDK missing (Android)** | Re-check step "One-time setup": `ANDROID_HOME`, `JAVA_HOME` (17), and `sdkmanager` installs |
