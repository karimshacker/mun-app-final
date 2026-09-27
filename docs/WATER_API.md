# MIANU-SM IV — Water Order API (public)

Order water delivery to a committee hall from any internal system — a
dashboard, a Slack bot, a spreadsheet macro, anything that can POST JSON.

**Base URL:** `https://mianu-public.karimshacker1234.workers.dev`

**Authentication:** none. The endpoint is unauthenticated because it runs
inside the conference's closed network and is consumed only by internal
systems. There is no key to obtain, rotate, store, or leak — the integration
is just a POST.

> If you ever expose this endpoint beyond the conference network, add auth
> back before you do. There is no rate limit either, for the same reason.

## Integration in 30 seconds

1. Find the committee you are ordering for. You can use either its id or its
   name — both work. Current committees (one per hall): `AG1`, `AG4`, `CS`,
   `CSH`, `AMS`, `HRC`, `CIJ`, `ECOSOC`.
2. POST to `/order` with `committee` and `quantity`.
3. Keep the `ref` from the response. That is your only handle on the order
   afterwards.

```bash
curl -X POST https://mianu-public.karimshacker1234.workers.dev/order \
  -H "Content-Type: application/json" \
  -d '{"committee": "UNSC", "quantity": 24, "note": "for the unmoderated caucus"}'
```

That is the whole integration. No headers to configure beyond `Content-Type`,
no token to fetch first, no retry-on-auth-expiry logic to write.

## Place an order

`POST /order`

| Field | Type | Required | Notes |
|---|---|---|---|
| `committee` | string | yes | Committee **id** or committee **name** (e.g. `UNSC` or `GA`) |
| `quantity` | integer | yes | Number of water units. Must be 1–200. |
| `note` | string | no | Free text, max 500 characters |
| `from` | string | no | Name of the calling system, so the kitchen knows who asked. Max 100 characters. |

### Request

```bash
curl -X POST https://mianu-public.karimshacker1234.workers.dev/order \
  -H "Content-Type: application/json" \
  -d '{"committee": "UNSC", "quantity": 24, "note": "for the unmoderated caucus"}'
```

```python
import requests

resp = requests.post(
    "https://mianu-public.karimshacker1234.workers.dev/order",
    json={"committee": "UNSC", "quantity": 24, "from": "kitchen-display"},
)
resp.raise_for_status()
order = resp.json()
print(order["ref"])  # WO-7F3K
```

```javascript
const res = await fetch("https://mianu-public.karimshacker1234.workers.dev/order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ committee: "UNSC", quantity: 24 }),
});
const order = await res.json();
console.log(order.ref); // WO-7F3K
```

### Response — `201 Created`

```json
{
  "ref": "WO-7F3K",
  "committee": "UNSC",
  "quantity": 24,
  "status": "RECEIVED",
  "createdAt": "2026-09-26T13:40:12.000Z"
}
```

The order immediately appears in every staff member's inbox in the apps
(one notice per person) and on the **WATER RUNS** tab, where head/deputy
walk it RECEIVED → ACKNOWLEDGED → DELIVERED. Keep `ref` — it is the only way
to query the order afterwards.

## Track an order

`GET /order/:ref`

```bash
curl https://mianu-public.karimshacker1234.workers.dev/order/WO-7F3K
```

```json
{
  "ref": "WO-7F3K",
  "committee_id": "c_unsc",
  "quantity": 24,
  "note": "for the unmoderated caucus",
  "status": "ACKNOWLEDGED",
  "requester_system": "kitchen-display",
  "created_at": "2026-09-26T13:40:12.000Z"
}
```

Status moves `RECEIVED` → `ACKNOWLEDGED` → `DELIVERED` (or `CANCELLED`).
Poll `GET /order/:ref` if you need to know when it lands; a webhook option is
planned for phase 5.

## Errors

| Status | `error` | Meaning |
|---|---|---|
| 400 | `bad_request` | Missing/invalid `committee` or `quantity` |
| 404 | `unknown_committee` | `committee` matches no committee id or name |
| 404 | `not_found` | No order with that `ref` |

Errors always return JSON: `{"error": "unknown_committee"}`.

## Committees

Orders resolve `committee` against the committee table by id *or* name, so
either form works. The seeded set:

| id | name | hall |
|---|---|---|
| `c_ag1` | `AG1` | Hall 1 |
| `c_ag4` | `AG4` | Hall 2 |
| `c_cs` | `CS` | Hall 3 |
| `c_csh` | `CSH` | Hall 4 |
| `c_ams` | `AMS` | Hall 5 |
| `c_hrc` | `HRC` | Hall 6 |
| `c_cij` | `CIJ` | Hall 7 |
| `c_ecosoc` | `ECOSOC` | Hall 8 |

## Support

IT admin team — `#mianu-it` during the conference.
