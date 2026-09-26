# MIANU-SM IV — Water Order API (public)

Order water delivery to a committee hall from any external system — a
dashboard, a Slack bot, a spreadsheet macro, anything that can POST JSON.

**Base URL:** `https://mianu-public.karimshacker1234.workers.dev`

**Authentication:** every request sends an API key as a bearer token:

```
Authorization: Bearer msk_live_8f3a...c1
```

Keys are issued by the MIANU-SM IV IT admin team. A key is scoped to
`water.order` only — it cannot read or modify participant data, balances, or
any other conference record. Keys can be rotated or revoked at any time; treat
them as a secret and store them in a secret manager, never in client-side code.

## Place an order

`POST /order`

| Field | Type | Required | Notes |
|---|---|---|---|
| `committee` | string | yes | Committee **id** or committee **name** (e.g. `UNSC`, "Security Council") |
| `quantity` | integer | yes | Number of water units. Must be 1–200. |
| `note` | string | no | Free text, max 500 characters |

### Request

```bash
curl -X POST https://mianu-public.karimshacker1234.workers.dev/order \
  -H "Authorization: Bearer $MIANU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"committee": "UNSC", "quantity": 24, "note": "for the unmoderated caucus"}'
```

```python
import os, requests

requests.post(
    "https://mianu-public.karimshacker1234.workers.dev/order",
    headers={"Authorization": f"Bearer {os.environ['MIANU_API_KEY']}"},
    json={"committee": "UNSC", "quantity": 24},
).raise_for_status()
```

```javascript
await fetch("https://mianu-public.karimshacker1234.workers.dev/order", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.MIANU_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ committee: "UNSC", quantity: 24 }),
});
```

### Response — `201 Created`

```json
{
  "ref": "WO-7F3K",
  "committee": "Security Council",
  "quantity": 24,
  "status": "RECEIVED",
  "createdAt": "2026-09-26T13:40:12.000Z"
}
```

The order immediately appears on the committee's organizers' phones and on the
head-of-organizers dashboard. Keep `ref` — it is the only way to query the
order later.

## Track an order

`GET /order/:ref`

```bash
curl -H "Authorization: Bearer $MIANU_API_KEY" \
  https://mianu-public.karimshacker1234.workers.dev/order/WO-7F3K
```

```json
{
  "ref": "WO-7F3K",
  "committee_id": "c_unsc",
  "quantity": 24,
  "note": "for the unmoderated caucus",
  "status": "ACKNOWLEDGED",
  "requester_system": "msk_live_8f3a",
  "created_at": "2026-09-26T13:40:12.000Z"
}
```

Status moves `RECEIVED` → `ACKNOWLEDGED` → `DELIVERED` (or `CANCELLED`).
You will also be able to register a webhook URL with your key to receive these
transitions as POSTs (phase 5).

## Errors

| Status | `error` | Meaning |
|---|---|---|
| 400 | `bad_request` | Missing/invalid `committee` or `quantity` |
| 401 | `unauthorized` | Missing or unknown key |
| 403 | `insufficient_scope` | Key does not include `water.order` |
| 404 | `unknown_committee` / `not_found` | Committee does not exist, or `ref` is not yours |
| 429 | `rate_limited` | Over your key's hourly quota |

Errors always return JSON: `{"error": "rate_limited"}`.

## Rate limits

Default **60 orders per hour per key**. Your limit is shown in the IT admin
console when your key is issued. If you expect burst traffic (e.g. syncing a
batch at once), ask for a raised quota rather than creating multiple keys.

## Sandbox

A sandbox key (`msk_test_...`) runs against a staging database so you can
integrate before the conference. Sandbox orders never reach a real organizer.
Request one from the IT admin team.

## Support

IT admin team — `#mianu-it` during the conference.
