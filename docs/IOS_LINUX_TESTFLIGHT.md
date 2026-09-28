# iOS build on Linux → TestFlight on 30 iPhones (with NFC)

You have this repo on a **Linux** machine and want the two apps running on 30
iPhones for the conference, with **NFC working**. Everything goes through
**EAS Build** (Expo's cloud Macs) and **TestFlight** (Apple's over-the-air
distribution) — no Mac, no Xcode, no Windows.

> **Why this works from Linux:** the iOS build never runs on your machine —
> EAS compiles it on macOS servers. Your Linux box only signs in, uploads the
> project, and drives the submission. What is *impossible* on Linux:
> `eas build --local` (needs macOS) and any Xcode steps. Ignore
> `docs/IOS_XCODE_INSTALL.md` — that's the Mac/free-account path.

> **Why NFC will work:** NFC Tag Reading requires a **paid** Apple Developer
> team. This guide assumes you have one ($99/yr). On a paid team the apps
> build with the NFC entitlement out of the box — do **not** run the
> free-mode strip scripts (`pnpm ios:free`); those exist only for free
> Apple IDs.

> **Already have Windows instructions?** The flow is identical — only the
> one-time tooling install differs. See `docs/IOS_WINDOWS_TESTFLIGHT.md` for
> the Windows-flavoured version of the same steps.

---

## 0. What you need

| Thing | Where to get it | Cost |
|---|---|---|
| Linux (Fedora/Ubuntu/Debian/Arch) with internet | — | — |
| **Apple Developer Program membership** | <https://developer.apple.com/programs> | $99/yr |
| Expo account **`karimelazab`** credentials (owner of the EAS projects) | <https://expo.dev> | free |
| App Store Connect API key — Issuer ID, Key ID, `.p8` file | App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate with **Admin** role | free |
| Node.js 20+ LTS | <https://nodejs.org> or your distro | free |
| Git + curl (already present on most distros) | — | free |
| The 30 iPhones, iOS 16+ | — | — |

**One-time Apple admin tasks (browser, ~15 min):**

1. Complete the Developer Program enrollment and **sign the latest
   Developer Program License Agreement** when prompted in App Store Connect
   (an unsigned agreement silently blocks every upload later).
2. Generate the **App Store Connect API key** (Admin role). Download the
   `.p8` file **once** — Apple never lets you download it again. Save all
   three values: Issuer ID, Key ID, the `.p8` file.
3. Create the two app records: App Store Connect → Apps → **+** → New App
   - *MIANU Organizer* — Bundle ID: `com.mianu.organize` — SKU: `MIANUOrganization`
   - *MIANU IT Admin* — Bundle ID: `com.mianu.paymentapp.admin` — SKU: `com.mianu.paymentapp.admin`
   (If the bundle IDs show as unavailable, someone registered them; create
   the records under those exact IDs — they are already in `app.json`.)

---

## 1. Prepare the machine (one time)

**Fedora / RHEL:**

```bash
sudo dnf install -y nodejs git curl
npm i -g pnpm@9 eas-cli
```

**Ubuntu / Debian:**

```bash
sudo apt update && sudo apt install -y nodejs npm git curl
npm i -g pnpm@9 eas-cli
```

**Arch:**

```bash
sudo pacman -S nodejs npm git curl
npm i -g pnpm@9 eas-cli
```

Verify the versions:

```bash
node --version    # must be 20 or newer
pnpm --version    # 9.x
eas --version     # any recent 11+
```

---

## 2. Prepare the project

```bash
git clone https://github.com/karimshacker/mun-app-final.git
cd mun-app-final
pnpm install

eas login         # sign in as karimelazab (the project owner)
eas whoami        # must print karimelazab
```

No other setup is needed:

- The API URL is **already baked in** — each `eas.json` profile sets
  `EXPO_PUBLIC_API_URL` to the deployed worker. Never set it by hand; do not
  add it to the command line.
- The EAS project IDs are already linked in both `app.json` files — there is
  no `eas init` step on a fresh clone.

---

## 3. Create Apple signing credentials (one time, interactive)

EAS needs Apple to issue a distribution certificate + provisioning profile
for each app. This step **must be interactive** (Apple 2FA), so run it in
your terminal and answer the prompts.

```bash
cd apps/organizer
npx eas-cli credentials
```

- Platform → **iOS**
- When asked to log in to Apple, use the Apple ID of the **paid team**
  and complete two-factor authentication
- Choose **"Generate new credentials"** — EAS creates the distribution
  certificate and the provisioning profile for `com.mianu.organize`
  automatically

Repeat from the `apps/admin` directory for the second app:

```bash
cd ../admin
npx eas-cli credentials
```

That's it — credentials are stored on Expo's servers and reused by every
future build, on any machine.

---

## 4. Build both apps for iOS

```bash
cd ../organizer
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

```bash
cd ../admin
npx eas-cli build --platform ios --profile production
```

> **Free-plan quota:** EAS free accounts get a limited number of cloud
> builds per month. If you hit the wall, either wait for the monthly reset
> or upgrade at <https://expo.dev/accounts/karimelazab/settings/billing>
> (Starter removes the pain for the 4+ builds this event needs).

---

## 5. Upload to TestFlight

```bash
cd ../organizer
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

## 6. Put the app on 30 iPhones

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
conference you're fine; rebuild + resubmit (steps 4–5) whenever it lapses.

---

## Linux-specific notes

- **`.p8` file permissions:** keep it outside the repo (e.g. `~/.secrets/`)
  with `chmod 600`. If you ever copy it to a Windows machine first, line
  endings may get mangled — regenerate a new key rather than debugging a
  CRLF `.p8`.
- **Watch a build from the terminal** while it runs:

  ```bash
  cd apps/organizer
  npx eas-cli build:list --platform ios --limit 1 --non-interactive --json \
    | grep -o '"status":"[A-Z]*"'
  ```

- **Why no Android Studio/SDK is needed:** iOS builds happen on EAS's macOS
  fleet; nothing native compiles on your machine. (The Android APKs in the
  README are built the same way.)
- **WSL users:** don't — this guide is for real Linux. WSL paths and
  credential helpers only add failure modes; the Windows guide covers WSL
  hosts properly.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to set up credentials … couldn't find any credentials suitable for internal distribution` | You ran a build non-interactively before credentials existed — run step 3 (`eas-cli credentials`) interactively, then rebuild |
| `ERR! The Apple Developer Program License Agreement has changed…` | Sign in at <https://appstoreconnect.apple.com> and accept the updated agreement, then retry |
| Build succeeds, TestFlight shows *Missing Compliance* forever | Wait — processing takes 10–30 min; the encryption key in the plist auto-answers it |
| `ITMS-90186` / invalid bundle (no app icon) | Regenerate icons: `bash packages/build/make-icons.sh`, commit, rebuild |
| `ITMS-91053` privacy-manifest email | Rebuild — `expo.ios.privacyManifests` is configured; if Apple names a specific API, add its category+reason to `app.json` and rebuild |
| Upload rejected: bundle ID mismatch | The ASC record must be exactly `com.mianu.organize` / `com.mianu.paymentapp.admin` (step 0.3) |
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
| Tester invite | The External Testing **public link** (step 6) |
| Credentials (certs/profiles) | Expo servers — managed by `eas-cli credentials`, shared by all future builds |
| Local credential sheet for logins | `workers/api/.staff-credentials.txt` (gitignored, on the IT lead's machine only) |
