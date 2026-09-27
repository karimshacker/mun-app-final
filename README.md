# MIANU-SM IV — Organizing Team App

Mobile + backend platform for the organizing team of the **MIANU-SM IV** MUN conference.

See **[PLAN.md](./PLAN.md)** for the full design: features, data model, phases, and risks.

## Deliverables

| Package | Path | Purpose |
|---|---|---|
| Organizer app | `apps/organizer` | React Native — check-in/out, meal scanning, notifications & chat, location dashboard |
| IT Admin app | `apps/admin` | React Native — badge↔participant linking, balance top-ups |
| API worker | `workers/api` | Cloudflare Workers + Hono — auth, scans, meals, presence |
| Public worker | `workers/public` | Public water-order endpoint (API-key gated) |
| Shared types | `packages/types` | Domain types shared by apps and workers |
| API client | `packages/api-client` | Typed SDK mirroring the worker routes |
| UI kit | `packages/ui` | The monochrome "secret agent" design system |
| Preview | `packages/preview` | Renders the RN screens in a browser and audits them |
| Build scripts | `packages/build` | iOS NFC-entitlement strip/check helpers for free vs paid Apple-ID builds |

> Realtime (Durable Objects for chat/presence) is designed in PLAN.md but not
> yet implemented.

## Backend

Cloudflare: Workers (API + public endpoint), D1 (SQLite), KV (rate limits),
Web Push (notifications), R2 (assets).

**Deployed** (account `karimshacker1234`):

| Worker | URL |
|---|---|
| `mianu-api` | <https://mianu-api.karimshacker1234.workers.dev> |
| `mianu-public` | <https://mianu-public.karimshacker1234.workers.dev> |

Both bind the D1 database `mianu-app-db` and the KV namespace
`MIANU_APP_KV`; the ids are already committed in each `wrangler.toml`.

### Getting started

```bash
pnpm install

# apply migrations to your local copy of the database
pnpm db:migrate

# run the API locally
pnpm dev:api
```

To apply migrations to the deployed database instead: `pnpm db:migrate:remote`.

### Secrets

One secret is required at runtime and is **not** in this repo — set it with
`wrangler secret put` from the api worker directory:

```bash
cd workers/api && printf '%s' '<random>' | npx wrangler secret put JWT_SECRET
```

`JWT_SECRET` signs access/refresh tokens. Without it, `/api/auth/login` fails.

The public water-order endpoint is **unauthenticated** by design — it runs
inside the conference's closed network, so there is no key to manage. See
[`docs/WATER_API.md`](./docs/WATER_API.md).

### Seeded data

The database ships with the three operational accounts, the eight committees,
and a five-participant demo roster, applied via `wrangler d1 migrations apply
--remote`:

| Account | Role | Phone |
|---|---|---|
| Yacine Amrani | `HEAD` | `+213555000001` |
| Sara Benali | `ORGANIZER` | `+213555000002` |
| Mehdi Haddad | `IT_ADMIN` | `+213555000003` |

Dry-run PIN for all three accounts: **`424242`** (set by migration `0007`,
distinct salts, stored as `SHA-256(pin:salt)`). These are dry-run
credentials — rotate to private PINs before the real event. Committees
(migrations `0008` + `0010`): **one committee per hall** — `AG1` (Hall 1),
`AG4` (Hall 2), `CS` (Hall 3), `CSH` (Hall 4), `AMS` (Hall 5), `HRC`
(Hall 6), `CIJ` (Hall 7), `ECOSOC` (Hall 8).

The demo roster (migration `0006`) has one participant per meal-plan branch,
so every station receipt is reachable with no setup:

| Alt code | Name | Plan | Balance |
|---|---|---|---|
| `DM01` | Amina Kerboubi | `FULL` (grid already full) | 500.00 |
| `DM02` | Yacine Brahimi | `BREAKFAST_ONLY` | 120.00 |
| `DM03` | Nadir Belkacem | `LUNCH_ONLY` | 80.00 |
| `DM04` | Lina Mokrani | `NONE` | 0.00 |
| `DM05` | Sofiane Ouali | `FULL` | 35.00 |

Scanning `DM01` lands on `MEAL_PLAN_EXHAUSTED`, `DM04` is refused outright,
and `DM05` walks the FULL grid cell by cell. Replace these when the real
roster is imported.

## Mobile apps

```bash
pnpm --filter @mianu/organizer start   # or: pnpm --filter @mianu/admin start
```

Both apps need a **custom dev client** (EAS), not Expo Go — NFC and
background location require native modules.

Installable Android APKs (sideload onto a phone) — build **locally**, free
and independent of any EAS quota (needs JDK 17 + the Android SDK; one-time
setup steps are in [docs/IOS_XCODE_INSTALL.md](./docs/IOS_XCODE_INSTALL.md)):

```bash
cd apps/organizer
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo run:android --variant release
cd ../admin
EXPO_PUBLIC_API_URL=https://mianu-api.karimshacker1234.workers.dev \
  npx expo run:android --variant release
# → apps/*/android/app/build/outputs/apk/release/app-release.apk
```

Or via EAS cloud builds when free quota is available:

```bash
cd apps/organizer && npx eas-cli build --platform android --profile preview
cd apps/admin    && npx eas-cli build --platform android --profile preview
```

The apps are on **Expo SDK 57** (React Native 0.86, React 19, new
architecture). The `preview` profile bakes the deployed API URL in via
`EXPO_PUBLIC_API_URL`. Three project settings make these builds work — don't
remove them: `node-linker=hoisted` in the root `.npmrc` (pnpm's isolated
layout hides `@react-native/gradle-plugin` from Gradle), each app's
`metro.config.js` (workspace packages resolve through the root
`node_modules`), and the `expo-splash-screen` plugin block with
`assets/splash-logo.png` in each `app.json` (the Android splash theme
references the logo drawable unconditionally, so a config without an image
fails resource linking).

NFC requires a usage string on iOS (`Info.plist` `NFCReaderUsageDescription`)
and the NFC tag-reading entitlement — both configured in each `app.json`.
For a native iPhone install via Xcode, see
**[docs/IOS_XCODE_INSTALL.md](./docs/IOS_XCODE_INSTALL.md)**. It covers both
lanes: a **free Apple ID** (installs fine, but Apple bars personal teams from
the NFC entitlement, so those builds fall back to typed alt codes) and a
**paid account** (full NFC) — plus the 30-iPhone conference plan and the
free full-NFC **Android station** route. For over-the-air iOS distribution
to testers (paid account), see **[docs/TESTFLIGHT_GUIDE.md](./docs/TESTFLIGHT_GUIDE.md)**.

### Running in Expo Go (iOS or Android)

Both apps run in Expo Go: they are on the SDK current Expo Go ships, and the
NFC native module (which Expo Go cannot load) is guarded — the apps boot
normally and every scan screen falls back to the typed alt code (which
exercises the same worker routes). The EAS builds above are the ones with
full NFC.

```bash
pnpm --filter @mianu/organizer go   # or: pnpm --filter @mianu/admin go
```

`go` runs `expo start --tunnel` with the deployed API URL baked into the
bundle, so the QR code works in Expo Go on any network. `pnpm start` instead
expects a custom dev-client build.

IT Admin accounts: see [Seeded data](#seeded-data) — the IT_ADMIN phone signs
into the admin app; badge linking and top-ups then hit the live roster
(`DM01`–`DM05`).

## Verifying the UI

There is no iOS simulator or Android emulator in the build environment, so the
UI is verified by rendering each screen through `react-native-web` into
headless Chrome, at both an iPhone (390×844) and an Android (412×915) viewport.

```bash
pnpm --filter @mianu/preview test
```

That renders 18 shots (9 cases × iOS + Android viewports) and runs two audits
over them:

- **palette** — every colour emitted by the render must be part of the
  monochrome ramp and strictly achromatic, so no accidental blue/red sneaks
  back into the black-and-white design.
- **content** — each shot must contain the copy its screen exists to show, so
  an empty render or a wrong-branch render is caught.

Screens covered: sign-in, station picker, scan (idle + denied receipt), the
two meal-grid outcomes (plan exhausted, outside the grid), inbox, head↔deputy
comms, presence board, badge linking, balance top-up.

## End-to-end test

The worker is also covered by a 31-assertion smoke test that runs against a
real `wrangler dev` server with a local D1 database — login and refresh,
session revocation after logout, the full scan flow (idempotent retries,
meal-grid rejections, hall check-in), badge linking and chip resolution,
roster search, top-ups, notifications, chat, presence, the board, and GPS
pings.

From `workers/api`:

```bash
rm -rf .wrangler/state
npx wrangler d1 migrations apply mianu-app-db --local
npx wrangler d1 execute mianu-app-db --local --file test/fixtures/e2e_seed.sql -y
printf '%s' 'JWT_SECRET=local-smoke-secret' > .dev.vars
npx wrangler dev --port 8799 --local        # in one terminal
node test/e2e_smoke.mjs                     # in another
```

The meal grid and scan state persist across runs against the same local DB;
reset `.wrangler/state` for a fully deterministic run.

## Features

1. **Check-in / check-out** — conference-level and per-hall, by NFC badge scan or typed alt code.
2. **Meal traceability** — see [Meal entitlement](#meal-entitlement) below.
3. **Notifications & chat** — one-way head → organizers; two-way head ↔ deputies.
4. **Organizer location** — hybrid GPS + hall-level, shown on the head's dashboard.
5. **Public water-order endpoint** — see [`docs/WATER_API.md`](./docs/WATER_API.md).

## Design language

Strictly black and white. Information is carried by type weight, hairline
rules, and inversion — never by colour. The single exception is the DENIED
scan verdict, which inverts to white-on-black so a refused meal is
unmissable in a doorway. All primary actions are ≥56pt and bottom-anchored so
a thumb reaches them while the other hand holds a stack of badges. Tokens
live in `packages/ui/src/theme.ts`.

## Meal entitlement

The conference runs 3 days with two meals a day — breakfast and lunch — so the
grid is `(participant, day, meal_type)` and each cell may be consumed exactly
once. A FULL plan is 6 meals; BREAKFAST_ONLY and LUNCH_ONLY are 3; NONE blocks
the station outright.

- Day 1 lunch then a second day-1 lunch → `MEAL_ALREADY_SERVED`.
- Day 2 lunch after day 1's → served, because it is a different cell.
- All 6 cells filled → `MEAL_PLAN_EXHAUSTED`.
- A scan on day 4 or later → `MEAL_DAY_CLOSED`.

The grid is enforced by the primary key of `meal_serve_log`, not by application
logic, so even two devices racing on the same badge cannot serve one meal
twice — the second `INSERT` fails the constraint.

### Free items (the journal)

The journal desk hands one copy per delegate per conference day, on any meal
plan (including `NONE`). It is a *daily handout, not a meal*: it never
consumes a meal-grid slot, never touches the balance ledger, and cannot
grant an extra meal. The once-per-day rule is enforced by the primary key of
`free_item_log` `(participant, item, day)` — same double-handout guard as
the meal grid. Day 1 is the row in
`conference_config` (`start_date`, currently `2026-09-26`); IT can move the
dates there if the schedule shifts.

Scans are idempotent on `client_scan_id`, so a retry over a flaky network never
double-commits, and no scan is ever accepted without a server response — if the
device is offline the scan is refused, never queued locally.
