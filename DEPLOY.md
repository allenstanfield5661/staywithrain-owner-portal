# Deploy the live owner portal

The live site is the existing Netlify site **staywithrain**. It runs the Next.js app on Netlify’s free plan. Sample mode (`DATA_MODE=mock`) and `npm run build:static` stay available for previews.

## Link this Origin repo

The site is a manual Drop deploy today. Connect it to this repository so Netlify builds it:

1. Sign in at [https://app.netlify.com](https://app.netlify.com) and open **staywithrain**.
2. Go to **Project configuration → Build & deploy → Continuous deployment** (the link control may also appear under **Developer settings → Continuous deployment → Repository**).
3. Choose **Link repository**, then **Cursor Origin**. Authorize the Cursor account that can see this repo.
4. Select this repository and branch `main`.
5. Build command: `npm run build`. Leave the publish directory empty so Netlify’s Next.js runtime runs. Node 22 is set in `netlify.toml`.
6. Add the environment variables below, then trigger a deploy.

The public address stays `https://staywithrain.netlify.app`.

Do not add Hostaway keys to the repo. Do not set `PREVIEW_PASSWORD` on this live site. That gate is only for mock mode.

## Environment variables

Set these in **Site configuration → Environment variables** for Production.

| Name | Value |
| --- | --- |
| `DATA_MODE` | `live` |
| `HOSTAWAY_ACCOUNT_ID` | Hostaway account id |
| `HOSTAWAY_API_KEY` | Hostaway API secret. The server exchanges it for a token. It is never sent to the browser. |
| `SESSION_SECRET` | A long random string |
| `ADMIN_EMAIL` | Allen’s sign-in email |
| `ADMIN_PASSWORD_HASH` | Output of the hash script below |
| `OWNERS_JSON` | JSON owner list. Start from `config/owners.example.json` and replace the placeholder listing id. |

Optional:

| Name | Value |
| --- | --- |
| `GOLF_CART_ICS_URLS` | Comma-separated secret iCal URL(s). Today this is the Subedi Realty Golf Cart feed. Cart rentals appear on the house that owns the cart tag in the event title. |
| `GOLF_CART_ICS_URL` | Optional single-feed fallback for the same secret iCal format. |
| `GOLF_CART_PUSH_SECRET` | Bearer secret for `POST /api/golfcart/push`. Required to accept pushed STR Golf Cart Rentals events. |

Hostaway listings and reservations are cached for 10 minutes. Owner records and password hashes are stored in Netlify Blobs.

## What owners see

Shown: shortened guest name (first name and last initial), arrival, departure, nights, status, channel, occupancy, the direct-booking link, and a welcome-guide link when one is on file. Owner stays are on the calendar and left out of the occupancy percentage. Golf cart rentals appear as their own calendar with guest and dates, without prices.

Hidden: full surname, email, phone, address, prices, payouts, card details, door codes, and notes.

Cancelled, declined, inquiry, and expired reservations are omitted.

## Admin password

On your computer, from this repo:

```bash
node scripts/hash-password.mjs "a password of at least 10 characters"
```

Paste the printed hash into `ADMIN_PASSWORD_HASH`. Do not put the password itself in Netlify.

## Owner invites

1. Sign in at the site with `ADMIN_EMAIL` and the password you hashed.
2. Open **Manage owners**.
3. Add each owner’s name, email, and Hostaway listing ids. Save.
4. Choose **Create invite link** and send that URL to the owner.
5. The owner opens the link, sets a password, and then signs in with their email.

Invite links expire after 7 days. Sign-in allows 8 attempts per email and IP every 15 minutes.

## Golf cart push

STR Golf Cart Rentals has no secret iCal address (edit access only). A scheduled job pushes its events every 30 minutes.

- **URL:** `POST https://staywithrain.netlify.app/api/golfcart/push`
- **Auth header:** `Authorization: Bearer <GOLF_CART_PUSH_SECRET>`
- **Secret file (operators):** `/workspace/owner-portal-live/GOLF_CART_PUSH_SECRET.txt` (chmod 600). Never commit or print it.
- **JSON body:** an array of events (or `{ "events": [ ... ] }`). Each event is:

```json
[
  {
    "calendar": "STR Golf Cart Rentals",
    "summary": "Guest Name- Property (7A)",
    "start": "2026-12-01",
    "end": "2026-12-04"
  }
]
```

`start` / `end` are exclusive-end ISO dates (`YYYY-MM-DD`), same as all-day iCal. Each successful push **replaces** the whole STR Golf Cart Rentals set stored in Netlify Blobs (`golfcart:events`). Subedi Realty Golf Cart continues to come from `GOLF_CART_ICS_URLS`. Cart tags map to owning listings: `(19)` → Porter Pulse 597423, `(7A)` → Porter Vibe 484254, `(A)` / `(Donald's)` → Peaceful Pearl 516343, `(11)` → Porter 11 / Five by the Sea 501592. Every Subedi event is treated as cart `(19)`.

Ready-to-run helper: `/workspace/owner-portal-live/push_golfcart.sh <events.json>` — prints only the HTTP status and accepted count.
