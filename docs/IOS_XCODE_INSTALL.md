# Installing the apps on iPhone with Xcode

This guide gets **MIANU Organizer** and **MIANU IT Admin** running on a
physical iPhone via Xcode. A free Apple ID works (7-day installs, re-run
when expired); a paid Apple Developer account ($99/yr) gives 1-year installs
and TestFlight. **NFC works**, because this is a real native build, not Expo
Go.

## What you need

- A Mac with **Xcode 16+** (App Store) and **CocoaPods**
  (`sudo gem install cocoapods`, or `brew install cocoapods`)
- An **iPhone** with iOS 17+, its cable, and the passcode handy
- An **Apple ID** (free is fine) — same one logged into the App Store
- This repo cloned on the Mac, with **Node 20+** and **pnpm**
  (`npm i -g pnpm`) installed

## 1. Prepare the project

```bash
pnpm install
```

Both apps are Expo (CNG) projects: there is no committed `ios/` folder, so
generate it. **Run once per app** (organizer first, then admin):

```bash
cd apps/organizer
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo prebuild --platform ios
cd ../admin
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo prebuild --platform ios
```

This creates `apps/*/ios/*.xcworkspace` with the NFC entitlements, usage
strings, and podfiles already applied from each `app.json`.

> Re-run prebuild any time `app.json` changes. Never hand-edit `ios/` —
> your edits will be overwritten at the next prebuild.

## 2. Open in Xcode and configure signing

1. Launch Xcode → **File ▸ Open…** → pick
   `apps/organizer/ios/MianuOrganizer.xcworkspace`
   (the **.xcworkspace**, not the `.xcodeproj` — pods live in the workspace)
2. In the left Project navigator click the blue project icon
   (**MianuOrganizer**) → select the **target** → **Signing & Capabilities**
3. Tick **Automatically manage signing**
4. **Team:** choose your **Personal Team (your Apple ID)**.
   First time: Xcode ▸ Settings ▸ Accounts ▸ **+** ▸ sign in with the
   Apple ID, then return here and pick the team
5. **Bundle Identifier:** must be unique across all of Apple. If the default
   `tn.mianu.smiv.organizer` is taken or signing complains, set
   `tn.mianu.smiv.organizer.<yourname>` (and the admin equivalent
   `tn.mianu.smiv.admin.<yourname>`)
6. Repeat 1–5 for the admin app
   (`apps/admin/ios/MianuAdmin.xcworkspace`)

> **Free-account limits:** one app per bundle id, max ~10 app ids per week,
> installs expire after **7 days** (just re-plug and press Run). Paid
> accounts: 1 year.

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
2. Scheme **MianuOrganizer** → destination your iPhone → press **⌘R**
3. **First run will fail** with *"Untrusted developer"* — that is expected:
   - On the iPhone: **Settings ▸ General ▸ VPN & Device Management**
     (or **Profiles & Device Management**) → tap your Apple ID under
     **Developer App** → **Trust**
4. Press **⌘R** again — the organizer app launches
5. Repeat (open workspace → select device → ⌘R) for the **admin** app

## 5. Sign in and test

- API: the deployed worker `https://mianu-api.karimshacker1234.workers.dev`
  is baked into the JS bundle by the `EXPO_PUBLIC_API_URL` from step 1
- Accounts (dry run): all PINs `424242`
  - Organizer app: `+213555000001` (head) or `+213555000002` (organizer)
  - Admin app: `+213555000003` (IT admin)
- **NFC test** (organizer): Scan tab → *Hold badge to scan* → tap a linked
  badge. Type a demo alt code instead to test without chips: the demo roster
  is `DM01`…`DM05` (DM01 = grid exhausted, DM04 = no plan)
- The journal desk hands one copy per delegate per day (any plan)

If the app shows *No connection*: the bundle was built without the API URL —
re-run step 1's prebuild command and press ⌘R again.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Signing requires a development team** | Xcode ▸ Settings ▸ Accounts: add the Apple ID, then select the Personal Team (step 2.4) |
| **Failed to register bundle identifier** | The id is taken — change it per step 2.5 (both apps) |
| **"Untrusted developer" on launch** | Settings ▸ General ▸ VPN & Device Management → Trust (step 4.3) |
| **Developer Mode missing** | Connect to Xcode first, then check Settings ▸ Privacy & Security |
| **Pod install errors / build fails in Pods** | `cd apps/organizer/ios && pod repo update && pod install`, rebuild |
| **App installs but shows "No connection"** | Prebuild was run without `EXPO_PUBLIC_API_URL` — redo step 1 |
| **7 days passed and the app won't open** | Free provisioning expired — reconnect the phone, ⌘R in Xcode |
| **NFC doesn't react** | iPhone must be XS or newer for background tag reads; hold the badge flat against the top edge; check Settings ▸ General ▸ NFC is not disabled |

## Android alternative

The same apps install from the EAS-built APKs (links in the main README), or
locally: `cd apps/organizer && npx expo run:android` with a device connected.
