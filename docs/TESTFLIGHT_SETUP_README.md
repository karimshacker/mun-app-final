# Setup: upload the Organizer app to TestFlight

The account holder provided everything needed for a paid Apple deployment of
the **MIANU Organizer** app (`com.mianu.paymentapp`). This guide turns those
five items into a TestFlight upload with **no Mac and no app-specific
password** — the App Store Connect API key does the upload, and nothing
secret ever enters the repo.

> **Scope:** materials exist for the organizer app only. The IT Admin app
> (`com.mianu.paymentapp.admin`) has no profile or App Store Connect record
> yet — the same steps apply once the account holder creates them.

## What you were given (and where it goes)

Keep all four files in `.secrets/apple/` at the repo root — **gitignored,
never committed, never zipped into a chat or a shared drive**:

| # | Item | File | Used for |
|---|---|---|---|
| 1 | Distribution certificate (+ private key) | `apple.p12` | Signing the app in the EAS cloud build |
| 2 | Provisioning profile | `MIANUOrganizer.mobileprovision` | Binds cert + App ID + NFC entitlement |
| 3 | Bundle ID | `com.mianu.paymentapp` | Already matches `apps/organizer/app.json` — nothing to change |
| 4 | App Store Connect record | (exists on ASC) | Referenced in `eas.json` as `ascAppId` |
| 5 | App Store Connect API key | `AuthKey_<KEYID>.p8` + Issuer ID + Key ID | Uploading the build to ASC |

## Step 0 — Put the files in place

1. Create `.secrets/apple/` and drop in the four files.
2. Rename the API key to the EAS convention: `AuthKey_<KEYID>.p8`
   (e.g. `AuthKey_AB12CD34EF.p8`).
3. Verify nothing is tracked: `git status` must not list the folder, and
   `git check-ignore -v .secrets/apple/apple.p12` must print a match.
4. If you received a `.cer` but **no** `.p12`, stop — see the pairing note in
   Step 2; a `.cer` alone cannot sign anything.

## Step 1 — EAS login

```bash
pnpm install
npx eas-cli login        # Expo account: karimelazab (owns the EAS project)
npx eas-cli whoami       # must print karimelazab
```

## Step 2 — Import the credentials into EAS (once)

From `apps/organizer`:

```bash
cd apps/organizer
npx eas-cli credentials --platform ios
```

| Prompt | Answer |
|---|---|
| Which build profile | **production** |
| How would you like to set up credentials | **Import credentials from a local machine** (the bring-your-own route) |
| Distribution certificate | `.secrets/apple/apple.p12` + its password |
| Provisioning profile | `.secrets/apple/MIANUOrganizer.mobileprovision` |

EAS uploads both to Expo's servers and reuses them for every future build —
this is the only step that touches the files.

**Certificate pairing note.** A `.cer` alone is not a signing identity — it
must be paired with the **private key** generated alongside it. If you only
got a `.cer`, the private key is on the machine where the account holder
created the certificate; ask them to export a `.p12` (macOS Keychain Access →
My Certificates → Export). Without the private key, no one can sign with that
certificate.

**NFC entitlement check (once, before building).** The profile must contain
the NFC Tag Reading entitlement, or builds sign fine but NFC refuses at
runtime:

```bash
security cms -D -i .secrets/apple/MIANUOrganizer.mobileprovision > /tmp/pp.plist
grep -A3 "nfc.readersession" /tmp/pp.plist
```

Expected: `com.apple.developer.nfc.readersession.formats` with `NDEF`/`TAG`.
If it's missing, the App ID needs the *Near Field Communication Tag Reading*
capability enabled and a **new profile generated** — go back to the account
holder. Linux/Windows instead of macOS (`security` is Apple-only):

```bash
openssl smime -inform DER -verify -nosigs -noverify \
  -in .secrets/apple/MIANUOrganizer.mobileprovision -out /tmp/pp.plist
grep -A3 "nfc.readersession" /tmp/pp.plist
```

## Step 3 — Fill the identifiers in `apps/organizer/eas.json`

Three values go into the `submit.production.ios` block (placeholders are
already there):

| Field | Value | Where to find it |
|---|---|---|
| `ascAppId` | Numeric Apple ID of the app record | ASC → Apps → MIANU Organizer → App Information → General Information → **Apple ID** |
| `ascApiKeyIssuerId` | UUID | Given with the API key (ASC → Users and Access → Integrations) |
| `ascApiKeyId` | 10-char Key ID | Same place; also part of the `.p8` filename |

The block looks like:

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "<numeric Apple ID>",
      "ascApiKeyPath": "../../.secrets/apple/AuthKey_<KEYID>.p8",
      "ascApiKeyIssuerId": "<Issuer ID UUID>",
      "ascApiKeyId": "<KEYID>"
    }
  }
}
```

`ascApiKeyPath` is relative to the app directory — `../../` reaches the repo
root's `.secrets/apple/` from `apps/organizer`. These identifiers are inert
without the `.p8` file, which never leaves `.secrets/apple/`.

## Step 4 — Build and submit (one command per release)

```bash
cd apps/organizer
npx eas-cli build --platform ios --profile production --auto-submit
```

One command: builds the `.ipa` on EAS cloud with the imported cert + profile,
then uploads it to App Store Connect with the `.p8`. Track progress via the
printed build-page URL or `npx eas-cli build:list --platform ios --limit 1`.

Version numbers manage themselves: `appVersionSource: "remote"` +
`autoIncrement` are already configured — EAS bumps the build number every
release; you never hand-edit versions.

## Step 5 — TestFlight: testers and the 30 iPhones

1. ASC → MIANU Organizer → **TestFlight**: the build appears after 10–30 min
   of processing. The first build shows **Missing Compliance** — answer the
   export question **No** once (the app already ships
   `ITSAppUsesNonExemptEncryption: false`); later builds skip it.
2. **Internal testing** (minutes, no Apple review): create a group, add up to
   100 ASC users (Users and Access → **+**), add the build. Testers install
   the TestFlight app, sign in, tap Install.
3. **External testing** for the 30 iPhones: create an External group, add the
   build — triggers a one-time **Beta App Review** (~1–2 days; start a week
   before the conference) — then enable the **public link**. Each iPhone:
   open the link → TestFlight app → Install.
4. **NFC smoke test per phone**: open a scan screen and hold a badge — the
   system NFC sheet proves the entitlement landed via the imported profile.
   If the app prompts for an alt code instead, re-run Step 2's entitlement
   check.

## Step 6 — Every later release

```bash
git pull && pnpm install
cd apps/organizer
npx eas-cli build --platform ios --profile production --auto-submit
```

The submit profile is already filled — nothing per-release.

## Security rules (non-negotiable)

- `.secrets/apple/` is gitignored. Anything under it never enters git, chat,
  screenshots, or ticket systems.
- The `.p8` **cannot be re-downloaded** — treat it like a password. If it
  leaks: **revoke** that key in ASC → Users and Access → Integrations, and
  have the account holder issue a new one.
- If the `.p12` leaks, the account holder should revoke the distribution
  certificate on the developer portal and issue a fresh cert + profile pair.
- After the conference, revoke the API key if the account is shared.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `eas build` fails: no credentials suitable for distribution | Step 2 wasn't done for the **production** profile — run `eas credentials --platform ios` from `apps/organizer` |
| Submit fails on authentication | The three `FILL_ME` fields are unfilled, or `ascApiKeyPath` doesn't resolve — `ls ../../.secrets/apple/` from `apps/organizer` |
| EAS asks for an Apple password at submit | The `.p8` replaces passwords entirely — if a password prompt appears, the key fields are wrong; never enter an Apple password |
| `invalid profile` / codesign mismatch at build | Profile's App ID ≠ `com.mianu.paymentapp`, or cert and profile are from different teams — verify the file pair |
| Codesign mismatch mentioning **associated domains** | Stale generated `ios/` dir — `rm -rf apps/organizer/ios` and rebuild (associated-domains was removed from `app.json`; the profile doesn't grant it) |
| NFC refuses at runtime | Profile lacks the NFC entitlement → Step 2's check, request a new profile |
| "Build number already exists" | Two builds raced — `eas build:cancel`, rebuild; autoIncrement picks the next number |
| App installs but shows *No connection* | Built with a profile lacking `env.EXPO_PUBLIC_API_URL` — use the `production` profile as written |
| Build stuck *Processing* > 1 h | Look for an ITMS email in ASC (icons/encryption are already configured in this repo) |
