# TestFlight without an App Store Connect API key

Deploy both apps (MIANU Organizer + MIANU IT Admin) to TestFlight using
**only your Apple ID and an app-specific password** — no `.p8` key, no
Issuer ID, no Key ID. Works from Windows, Linux, or macOS; all builds run on
Expo's servers, so no Mac is ever needed.

The other guides ([Windows](./IOS_WINDOWS_TESTFLIGHT.md),
[Linux](./IOS_LINUX_TESTFLIGHT.md), [general](./TESTFLIGHT_GUIDE.md)) use the
API-key path. This one is for when you don't want to create an API key at all.

## How authentication works without an API key

| What | API-key path | **This guide (no API)** |
|---|---|---|
| Build signing (certs + profiles) | EAS asks once, stores on Expo's servers | **Same** — Apple ID login with 2FA, one time |
| Uploading the .ipa to App Store Connect | ASC API key (JWT) | **Apple ID + app-specific password** (env var) |
| TestFlight / tester management | ASC web UI | **Same** — browser, appleid.apple.com not needed after setup |

---

## Step 0 — One-time App Store Connect setup (~15 min)

Do this once in a browser; every later release skips it.

1. **Enroll in the Apple Developer Program** ($99/yr) if you haven't:
   <https://developer.apple.com/programs/>. TestFlight does not exist on free
   accounts — this is the only step that costs money, and there is no way
   around it for 30 iPhones.
2. **Turn on two-factor authentication** for your Apple ID if it isn't
   already: <https://account.apple.com> → Sign-In and Security. App-specific
   passwords (Step 2) are *only* available on 2FA-protected accounts.
3. **Sign the latest Program License Agreement**: App Store Connect →
   Agreements, Tax, and Banking. An unsigned agreement silently fails every
   upload with a confusing error (see troubleshooting).
4. **Create the two app records** (App Store Connect → Apps → **+** → New App):
   - Name `MIANU Organizer`, bundle ID `com.mianu.organize`, SKU `MIANUOrganization`
   - Name `MIANU IT Admin`, bundle ID `com.mianu.paymentapp.admin`
   If the bundle IDs don't appear in the dropdown yet, that's fine — the
   first EAS build registers them (Step 3). Come back and create the records
   afterwards, before submitting.
5. While you're there: fill in **Test Information** under App Store Connect →
   your app → TestFlight for each app (a sentence is enough — external
   testers see it, and Beta App Review reads it).

## Step 1 — Repo + Expo account (~5 min)

```bash
git clone https://github.com/karimshacker/mun-app-final
cd mun-app-final
pnpm install

npm install --global eas-cli@latest
eas login          # Expo account (karimelazab), NOT your Apple ID
```

Nothing else to configure: both `eas.json` files already have the
`production` profile with the deployed API URL baked in
(`EXPO_PUBLIC_API_URL`) and version auto-increment enabled — do not set any
environment variables for the build.

## Step 2 — Generate the app-specific password (~2 min)

This replaces the API key for uploads.

1. Go to <https://account.apple.com> → Sign-In and Security → **App-Specific
   Passwords** → **+**.
2. Label it `eas-submit-mianu`, copy the generated password — it looks like
   `abcd-efgh-ijkl-mnop` (with dashes, exactly as shown).
3. Store it in your password manager. Treat it like your Apple ID password:
   it can upload apps to your account. **Never commit it** and never put it
   in `eas.json` (the repo is public). We pass it as an environment variable.

If you ever suspect it leaked: revoke it on the same page and generate a new
one (Step 4 uses the new value).

## Step 3 — Build the two production IPAs (~25 min, cloud builds)

```bash
cd apps/organizer
eas build --platform ios --profile production

cd ../admin
eas build --platform ios --profile production
```

- **First iOS build only**: EAS asks to set up credentials — choose
  **Log in with your Apple Developer account** and enter your Apple ID + 2FA
  code. EAS registers the bundle ID, creates the distribution certificate and
  provisioning profile, and stores them on Expo's servers. This is Apple ID
  authentication, not an API key — exactly what we want.
- If it asks which role to use, pick **App Store distribution**.
- Each build page (`https://expo.dev/accounts/karimelazab/projects/…/builds/<id>`)
  shows progress; the finished artifact is a `.ipa`. Free-tier EAS queues
  move slowly — the queue position is normal, not an error.
- Note the **build number** each build reports (auto-incremented since
  `appVersionSource: "remote"`); App Store Connect must never see the same
  build number twice, and you never manage that by hand.

## Step 4 — Submit to App Store Connect (no API key)

For each app, from its directory:

```bash
cd apps/organizer
EXPO_APPLE_APP_SPECIFIC_PASSWORD='abcd-efgh-ijkl-mnop' \
  eas submit --platform ios --latest
```

- On first run EAS asks for your **Apple ID email** — type it once; combined
  with the env var, no other prompts follow.
- `--latest` picks the newest FINISHED build for that project, so there is no
  build-id lookup step.
- A successful submission prints the App Store Connect link where the build
  will appear.

Repeat for the admin app:

```bash
cd ../admin
EXPO_APPLE_APP_SPECIFIC_PASSWORD='abcd-efgh-ijkl-mnop' \
  eas submit --platform ios --latest
```

Optional one-flag helpers:

```bash
# Add the build straight to an internal TestFlight group as part of submit:
EXPO_APPLE_APP_SPECIFIC_PASSWORD='…' eas submit -p ios --latest \
  --auto-testflight-setup -g "Internal" --what-to-test "Conference build - full NFC"

# Or fold submission into the build itself (one command per release):
eas build --platform ios --profile production --auto-submit
```

## Step 5 — TestFlight processing and the 30 iPhones

1. App Store Connect → your app → **TestFlight**: the build shows
   *Processing* for 10–30 minutes. The first build for an app also shows
   **Missing Compliance** — click it and answer **No** to export
   compliance questions (both apps already ship
   `ITSAppUsesNonExemptEncryption: false`, so this disappears from future
   builds).
2. **Internal testing** (fastest, no Apple review): TestFlight → Internal
   Testing → **+** group, add up to 100 App Store Connect users (create them
   under Users and Access — role *App Manager* or *Developer* is fine), then
   add the build. Testers get an email invite; they install the **TestFlight
   app** from the App Store, sign in, tap the app, **Install**.
3. **External testing for 30 iPhones**: TestFlight → External Testing →
   **+** group → add the build (triggers a ~1–2 day one-time **Beta App
   Review**) → enable the **public link**. Share the link; each iPhone opens
   it, installs TestFlight, and installs the app. **Start this at least a
   week before the conference.**
4. Per-phone NFC smoke test on install: scan a badge on the Station screen —
   a full read (no "type the alt code" fallback) proves the entitlement is
   active. Both apps declare the NFC entitlement; on a paid team it just
   works. Do **not** run `pnpm ios:free` for TestFlight builds — that strip
   script is only for free-Apple-ID Xcode builds.
5. Builds expire from TestFlight after **90 days** — irrelevant for a 3-day
   event, but rebuild if you test months later.

## Step 6 — Every later release

```bash
git pull
pnpm install
cd apps/organizer && EXPO_APPLE_APP_SPECIFIC_PASSWORD='…' \
  sh -c 'eas build --platform ios --profile production --auto-submit'
cd ../admin    && EXPO_APPLE_APP_SPECIFIC_PASSWORD='…' \
  sh -c 'eas build --platform ios --profile production --auto-submit'
```

`--auto-submit` hands the finished .ipa straight to EAS Submit; the build
number increments automatically. Only repeat Step 0 items if Apple introduces
a new agreement to sign.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Apple username or password are invalid` | You typed your **Apple ID password** where the **app-specific password** belongs. Use the `abcd-…-mnop` value in `EXPO_APPLE_APP_SPECIFIC_PASSWORD`. |
| App-specific password rejected although copied exactly | 2FA is off on the Apple ID (app-specific passwords don't exist without it), or the password was revoked — regenerate on <https://account.apple.com>. |
| `Please sign in with an app-specific password` | Same as above; EAS fell back to asking for the account password. Set the env var instead of answering the prompt. |
| Upload fails with an **agreement** error | Sign the latest Program License Agreement in App Store Connect → Agreements, Tax, and Banking (Step 0.3). |
| `ERROR ITMS-90000 / duplicate build number` | The build number already exists in ASC. `eas build --platform ios --profile production` again — autoIncrement picks the next number; never reuse. |
| Build stuck in *Processing* over an hour | Check App Store Connect → Apps → your app → TestFlight for an email from Apple; a processing stall almost always has an ITMS email explaining it. |
| `Unable to authenticate` during **first** build's credential setup | That step is interactive Apple ID + 2FA by design — it cannot run with only env vars. Run it once in the terminal and it's stored. |
| App name or bundle ID taken at Step 0.4 | Bundle IDs `com.mianu.organize` (organizer) and `com.mianu.paymentapp.admin` (IT admin) belong to this project — if unavailable, someone on the team already registered them; ask them for the App Store Connect access. |
| Submission logs time out mid-upload | Retry `eas submit --latest`; submissions are idempotent, and `eas submit:list` shows what's in flight. |

## Security notes

- The app-specific password grants broad account access — the env var is the
  only safe place for it. Never commit it, never put it in `eas.json` (this
  repo is public), never paste it into shared docs.
- Revoke it at <https://account.apple.com> when the conference is over.
- EAS credentials (certs/profiles) stay on Expo's servers; you can list or
  remove them any time with `eas credentials --platform ios`.
