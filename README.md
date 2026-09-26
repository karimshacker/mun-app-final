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

Two secrets are required at runtime and are **not** in this repo — set them
with `wrangler secret put` from the relevant worker directory:

```bash
cd workers/api      && printf '%s' '<random>' | wrangler secret put JWT_SECRET
cd workers/public   && printf '%s' '<random>' | wrangler secret put PUBLIC_API_KEY_SALT
```

`JWT_SECRET` signs access/refresh tokens; `PUBLIC_API_KEY_SALT` salts the
SHA-256 hash of each public API key so a DB leak cannot forge an order.

## Mobile apps

```bash
pnpm --filter @mianu/organizer start   # or: pnpm --filter @mianu/admin start
```

Both apps need a **custom dev client** (EAS), not Expo Go — NFC and
background location require native modules.

NFC requires a usage string on iOS (`Info.plist` `NFCReaderUsageDescription`)
and the NFC tag-reading entitlement.

## Verifying the UI

There is no iOS simulator or Android emulator in the build environment, so the
UI is verified by rendering each screen through `react-native-web` into
headless Chrome, at both an iPhone (390×844) and an Android (412×915) viewport.

```bash
pnpm --filter @mianu/preview test
```

That renders 14 shots and runs two audits over them:

- **palette** — every colour emitted by the render must be part of the
  monochrome ramp and strictly achromatic, so no accidental blue/red sneaks
  back into the black-and-white design.
- **content** — each shot must contain the copy its screen exists to show, so
  an empty render or a wrong-branch render is caught.

Screens covered: scan (idle + denied receipt), inbox, head↔deputy comms,
presence board, badge linking, balance top-up.

## Features

1. **Check-in / check-out** — conference-level and per-hall, by NFC badge scan or typed alt code.
2. **Meal traceability** — breakfast & lunch scanning deducts from a per-participant balance.
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
