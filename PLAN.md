# MIANU-SM IV — Organizing Team App

Plan for the organizing-team app of the MIANU-SM IV MUN conference.

## Scope (three deliverables)

1. **Organizer app** (Android + iOS) — check-in/out, meal scanning, notifications/chat, location dashboard, water-order inbox.
2. **IT Admin app** (Android + iOS) — links pre-printed badge UIDs to participants, tops up meal balances, issues API keys.
3. **Cloudflare backend** — API, real-time, database, and the public water-order endpoint (+ integration README).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | **React Native + Expo** (custom dev client via EAS), TypeScript | NFC and background location need native modules (Expo Go can't run them), and TypeScript is shared with the Workers backend — one language, one team. |
| NFC | `react-native-nfc-manager` | Cross-platform tag reading (UID) + writing; iOS requires an entitlement + a usage string. |
| Location | `expo-location` (task background) | Hybrid GPS + hall-derived position. |
| API | **Cloudflare Workers** + Hono | Edge, cheap, scales; one deploy for app API *and* the public endpoint. |
| DB | **D1** (SQLite) | Relational data fits scans/ledger/orders perfectly. Read replicas per region if needed. |
| Real-time | **Durable Objects** + WebSockets | Chat, notification fan-out, live location/dashboard presence. |
| Cache/limits | **KV** | API-key rate limits, session allowlists, broadcast flags. |
| Push | **Web Push** (VAPID) | One-way notifications reach organizers even when the app is killed. |
| Files | **R2** / Cloudflare Images | Badges, avatars, committee assets. |

## Roles & access

`HEAD` (head of organizers) · `DEPUTY` · `ORGANIZER` · `IT_ADMIN`
Every API request is authenticated (short-lived JWT, refresh token) and authorized per role in Worker middleware — never trust the client. Committee-scoped permissions where relevant (an organizer only sees their own committee's rota, but heads see all).

## Data model (D1)

- **users** — id, name, role, committee_id, phone, push_subscription
- **participants** — id, name, committee_id, `badge_uid` (unique, nullable until linked), `alt_code` (human-typed fallback), `balance_cents`, meal plan, status
- **committees** — id, name, hall_name, `hall_tag_uid`
- **scan_events** — id, participant_id, station_type (`CONFERENCE_IN`/`CONFERENCE_OUT`/`HALL_IN`/`HALL_OUT`/`MEAL`), committee_id, scanned_by, at, client_scan_id, `entry_method` (`NFC`/`ALT_CODE`)
- **meal_ledger** — participant_id, meal_type (`BREAKFAST`/`LUNCH`), amount, at, station — append-only, balance derived
- **notifications** — id, head_id, audience, title, body, at, read_at
- **chat_channels / chat_messages** — head↔deputy two-way channels
- **locations** — user_id, lat, lng, source (`GPS`/`HALL_SCAN`), at (TTL'd / time-windowed)
- **water_orders** — ref, committee, quantity, status, requester_system, api_key_id, at
- **api_keys** — hashed keys, scopes, rate limit, created by IT_ADMIN

---

## Feature specs

### F1 — Check-in / check-out (conference + halls)
- **Badge linking (IT Admin app):** scan a pre-printed badge → its fixed UID is bound to a participant record. Bulk import of the participant roster first (CSV), then walk the queue linking badges.
- **Conference check-in/out:** organizer scans participant badge at the main entrance → `CONFERENCE_IN`. Leaving → `CONFERENCE_OUT`. Guard: reject a second `IN` without an intervening `OUT`; idempotent via `client_scan_id`.
- **Hall check-in/out:** each committee hall has its own mounted NFC tag encoding the hall identity. The *participant's* badge scan at the hall door creates `HALL_IN`; scanning out creates `HALL_OUT`. Heads see a live "who is in which hall" board.
- **Dead-badge fallback — alt codes:** every participant is issued a short `alt_code` (printed on the badge beside the NFC chip). The scan screen has a "Type code instead" button; entering the code performs the exact same server-side flow as an NFC scan, with `entry_method = ALT_CODE` recorded for traceability. This covers dead/damaged chips and phones that won't read the tag.
- **Rules engine:** dedupe scans inside a cooldown window, enforce direction state machine, log every scan with the scanning organizer's identity and entry method for traceability.
- Since you require internet to scan: the app shows a clear offline state and refuses to commit a scan without server confirmation (no local queue), keeping balances authoritative server-side.

### F2 — Meal traceability (breakfast & lunch)
- Scanning (or typing the alt code) at a meal station opens the participant's record: shows photo, name, committee, **balance**, and the meal cost.
- Confirm → server deducts inside a **D1 transaction** (balance check + insert ledger row + update), and emits a success/failure receipt. Double-scan within the same meal window is blocked with an explicit "already served" screen.
- Low-balance and zero-balance states are distinct and loud. IT Admin app can top up balance or flag "comped" meals (reason logged).
- End-of-service report per station: served, denied, remaining balance issues.

### F3 — Notifications & chat
- **One-way:** HEAD composes a broadcast (all organizers, by committee, or by hall) → delivered over Web Push *and* in-app inbox; delivery/read receipts visible to the head.
- **Two-way:** HEAD ↔ DEPUTY channel(s) over Durable Object WebSockets — typing indicators, read receipts, message history persisted to D1.
- Organizers are read-only recipients of notifications; deputies and heads can reply in chat.

### F4 — Organizer location (head dashboard)
- **Hybrid resolution:** background GPS while on duty (configurable accuracy to save battery) **plus** hall-level positioning derived from the organizer's own hall scans and manual duty status.
- Head dashboard: live map + "in Hall X / moving / off-duty" chips, filter by committee, tap to send a notification to that organizer.
- **Privacy by design:** consent prompt at login, location sharing only during shift hours, an explicit "go invisible / break" toggle, and retention TTL (auto-purge after the conference).

### F5 — Public water-order endpoint
- `POST https://mianu-public.karimshacker1234.workers.dev/order` — API-key auth, body `{ committee, quantity, note? }` → validated → row in `water_orders` → pushed to that committee's organizers and the head dashboard → `status` transitions (`received → acknowledged → delivered`), queryable via `GET /order/:ref`.
- API keys are issued/rotated/revoked by the IT Admin app; rate limited in KV; all keys scoped to `water.order` only — never participant data.
- **Integration README** (`/docs/WATER_API.md` + served at the endpoint root): auth scheme, request/response schema, error codes, rate limits, sandbox key, sample curl/Python/JS, webhook option.

---

## Repo layout

```
mun-app-final/
├── apps/
│   ├── organizer/        # RN app (check-in, meals, chat, dashboard)
│   └── admin/            # RN app (badge linking, top-ups, API keys)
├── packages/
│   ├── api-client/       # shared typed SDK (generated from Hono routes)
│   ├── types/            # shared domain types
│   └── ui/               # shared components
├── workers/
│   ├── api/              # Hono app: auth, scans, meals, chat, orders
│   ├── realtime/         # Durable Objects: chat + presence
│   └── public/           # water-order endpoint (public, API-key gated)
├── migrations/           # D1 schema
├── docs/WATER_API.md     # integration README
└── README.md
```

## Phases

0. **Foundation** — repo, D1 schema + migrations, auth/JWT, role middleware, CI via Wrangler. *(~1 wk)*
1. **Badge linking + roster import** (IT Admin app) — unblocks all scanning. *(~1 wk)*
2. **F1 scanning** — conference + hall state machine, scan UI, receipts. *(~2 wks)*
3. **F2 meals** — ledger, balance flow, station reports. *(~1 wk)*
4. **F3** — Web Push + inbox, then chat with Durable Objects. *(~2 wks)*
5. **F4** — background location + dashboard, privacy controls. *(~1.5 wks)*
6. **F5 + docs** — public endpoint, API-key management, README. *(~1 wk)*
7. **Dry run** — a rehearsal event with 10 people and 2 halls before the real day. *(mandatory)*

## Top risks

- **iOS NFC constraints** — background tag reading is limited; keep scanning in a foreground session with the app open and screen on, with the alt-code fallback for a dead badge.
- **Battery** — continuous GPS + NFC will drain phones; provide charging stations and a low-power accuracy mode.
- **Venue WiFi** — you've chosen to require connectivity, so a single failed scan must show a clear retry, and the head must have a cellular fallback (hotspot) plan.
- **Meal-time surge** — hundreds of scans in 20 minutes; D1 + Workers handle it, but test the cooldown/dedupe path under load.
