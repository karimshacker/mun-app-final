# iOS build on Windows → TestFlight on 30 iPhones (with NFC)

You have this repo on a **Windows** PC and want the two apps running on 30
iPhones for the conference, with **NFC working**. This guide is written for
exactly that: no Mac, no Xcode, everything through **EAS Build** (Expo's
cloud Macs) and **TestFlight** (Apple's over-the-air distribution).

> **Why this works from Windows:** the iOS build never runs on your PC —
> EAS compiles it on macOS servers. Your PC only signs in, uploads the
> project, and downloads/upload artifacts. What is *impossible* on Windows:
> `eas build --local` (needs macOS) and any Xcode steps. Ignore
> `docs/IOS_XCODE_INSTALL.md` — that's the Mac/free-account path.

> **Why NFC will work:** NFC Tag Reading requires a **paid** Apple Developer
> team. This guide assumes you have one ($99/yr). On a paid team the apps
> build with the NFC entitlement out of the box — do **not** run the
> free-mode strip scripts (`pnpm ios:free`); those exist only for free
> Apple IDs.

---

## 0. What you need

| Thing | Where to get it | Cost |
|---|---|---|
| Windows 10/11 with internet | — | — |
| **Apple Developer Program membership** | <https://developer.apple.com/programs> | $99/yr |
| Expo account **`karimelazab`** credentials (owner of the EAS projects) | <https://expo.dev> | free |
| App Store Connect API key (for uploads) — Issuer ID, Key ID, `.p8` file | App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate with **Admin** role | free |
| Node.js 20+ LTS | <https://nodejs.org> | free |
| Git | <https://git-scm.com> | free |
| The 30 iPhones, iOS 16+ | — | — |

**One-time Apple admin tasks (browser, ~15 min):**

1. Complete the Developer Program enrollment and **sign the latest
   Developer Program License Agreement** when prompted in App Store Connect
   (an unsigned agreement silently blocks every upload later).
2. Generate the **App Store Connect API key** (Admin role). Download the
   `.p8` file **once** — Apple never lets you download it again. Save all
   three values: Issuer ID, Key ID, the `.p8` file.
3. Create the two app records: App Store Connect → Apps → **+** → New App
   - *MIANU Organizer* — Bundle ID: `com.mianu.paymentapp` — SKU: `com.mianu.paymentapp`
   - *MIANU IT Admin* — Bundle ID: `com.mianu.paymentapp.admin` — SKU: `com.mianu.paymentapp.admin`
   (If the bundle IDs show as unavailable, someone registered them; create
   the records under those exact IDs — they are already in `app.json`.)

---

## 1. Prepare the project on Windows

Open **PowerShell** (or Git Bash — commands below are identical except where
noted) and run:

```powershell
git clone https://github.com/karimshacker/mun-app-final.git
cd mun-app-final
npm i -g pnpm@9
pnpm install
npm i -g eas-cli
eas login            # sign in as karimelazab (the project owner)
eas whoami           # must print karimelazab
```

No other setup is needed:

- The API URL is **already baked in** — each `eas.json` profile sets
  `EXPO_PUBLIC_API_URL` to the deployed worker. Never set it by hand; do not
  add it to the command line.
- The EAS project IDs are already linked in both `app.json` files — there is
  no `eas init` step on a fresh clone.

---

## 2. Create Apple signing credentials (one time, interactive)

EAS needs Apple to issue a distribution certificate + provisioning profile
for each app. This step **must be interactive** (Apple 2FA), so run it in
your terminal and answer the prompts.

```powershell
cd apps/organizer
npx eas-cli credentials
```

- Platform → **iOS**
- When asked to log in to Apple, use the Apple ID of the **paid team**
  and complete two-factor authentication
- Choose **"Generate new credentials"** — EAS creates the distribution
  certificate and the provisioning profile for `com.mianu.paymentapp`
  automatically

Repeat from the `apps/admin` directory for the second app:

```powershell
cd ..\admin
npx eas-cli credentials
```

That's it — credentials are stored on Expo's servers and reused by every
future build, on any machine.

---

## 3. Build both apps for iOS

```powershell
cd ..\organizer
npx eas-cli build --platform ios --profile production
```

- Each build takes **~20–35 minutes**; the CLI prints a
  `https://expo.dev/accounts/karimelazab/projects/.../builds/<id>` page —
  watch progress there.
- Build numbers auto-increment, so you can rerun builds any time without
  touching version keys.
- When it finishes, the page shows the **.ipa** — you do **not** need to
  download it; the submit step (next) fetches it for you.

Repeat for the admin app:

```powershell
cd ..\admin
npx eas-cli build --platform ios --profile production
```

> **Free-plan quota:** EAS free accounts get a limited number of cloud
> builds per month. If you hit the wall, either wait for the monthly reset
> or upgrade at <https://expo.dev/accounts/karimelazab/settings/billing>
> (Starter removes the pain for the 4+ builds this event needs).

---

## 4. Upload to TestFlight

```powershell
cd ..\organizer
npx eas-cli submit --platform ios --latest
```

First time it will ask how to authenticate to App Store Connect — choose
**App Store Connect API Key** and give it the Issuer ID / Key ID / `.p8`
from step 0. EAS remembers it (`eas submit` reuses the stored key).

Repeat from `apps/admin` for the second app.

Then in the browser (App Store Connect):

1. Open each app → **TestFlight** tab.
2. The build shows **Processing** for 10–30 minutes. Export-compliance
   questions are skipped automatically (`ITSAppUsesNonExemptEncryption` is
   already set in both apps). If anything is missing, Apple emails you —
   every usage string the reviewers ask about is already configured.

---

## 5. Put the app on 30 iPhones

TestFlight needs **no UDIDs and no device registration** — that's exactly
why it's the right distribution path for 30 phones.

**One-time setup (browser):**

1. In the app's TestFlight tab → **+** next to *External Testing* → create a
   group named e.g. `MIANU Staff` → enable **Public Link** (limit 10,000).
2. The first external build requires a light **Beta App Review** (~1–2 days,
   once per app). Submit it early — do this a week before the conference.
3. Copy the public link for each app.

**On each of the 30 iPhones (~2 minutes per phone):**

1. Install **TestFlight** from the App Store.
2. Open the organizer app's public link → **Accept** → the app installs
   over the air.
3. Open the admin app's link the same way (two apps end up on the phone).
4. Launch → sign in with the staff phone + PIN (credentials are private —
   the IT lead holds them; they are **not** in this repo).
5. **NFC check:** Scan tab → *Hold badge to scan* → tap a linked badge. If
   it reads and the receipt appears, NFC works — this is the paid-team
   entitlement doing its job. Alt-code entry exists as the fallback on the
   same screen.

**Renewal:** TestFlight builds expire after **90 days**. For a 3-day
conference you're fine; rebuild + resubmit (steps 3–4) whenever it lapses.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to set up credentials … couldn't find any credentials suitable for internal distribution` | You ran a build non-interactively before credentials existed — run step 2 (`eas-cli credentials`) interactively, then rebuild |
| `ERR! The Apple Developer Program License Agreement has changed…` | Sign in at <https://appstoreconnect.apple.com> and accept the updated agreement, then retry |
| Build succeeds, TestFlight shows *Missing Compliance* forever | Wait — processing takes 10–30 min; the encryption key in the plist auto-answers it |
| `ITMS-90186` / invalid bundle (no app icon) | Regenerate icons: `bash packages/build/make-icons.sh` (or WSL), commit, rebuild |
| `ITMS-91053` privacy-manifest email | Rebuild — `expo.ios.privacyManifests` is configured; if Apple names a specific API, add its category+reason to `app.json` and rebuild |
| Upload rejected: bundle ID mismatch | The ASC record must be exactly `com.mianu.paymentapp` / `com.mianu.paymentapp.admin` (step 0.3) |
| EAS quota exhausted | Wait for the monthly reset or subscribe to Starter |
| App installs but shows *No connection* | Should not happen — the API URL comes from the EAS profile. If you built with a custom profile, add `env.EXPO_PUBLIC_API_URL` to it |
| NFC does not react on a phone | iPhone XS or newer for background tag reads; hold the badge flat against the top edge; Settings ▸ General ▸ NFC must be on |
| 7 days passed and… nothing broke | Nothing — TestFlight builds last 90 days, unlike free-account installs (7 days) |

---

## Where everything lives

| Artifact | Location |
|---|---|
| Build pages (logs, .ipa) | `https://expo.dev/accounts/karimelazab/projects/mianu-organizer/builds` (and `mianu-admin`) |
| TestFlight builds | App Store Connect → your app → TestFlight |
| Tester invite | The External Testing **public link** (step 5) |
| Credentials (certs/profiles) | Expo servers — managed by `eas-cli credentials`, shared by all future builds |
| Local credential sheet for logins | `workers/api/.staff-credentials.txt` (gitignored, on the IT lead's machine only) |
