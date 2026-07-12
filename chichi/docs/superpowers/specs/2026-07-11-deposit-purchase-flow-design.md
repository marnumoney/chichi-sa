# Deposit / Full-Payment Purchase Flow — Design

**Date:** 2026-07-11
**Scope:** chichi (frontend) + chichi-api (backend)
**Status:** Approved

## Goal

A buyer can purchase a puppy in one of two ways:

1. **Full payment** — pays the full price via Yoco; the puppy immediately shows **Sold**.
2. **50% deposit** — pays half the price via Yoco to hold the puppy; it shows **Booked**. The buyer later pays the remaining 50% through the site, and the puppy automatically flips to **Sold** (no seller confirmation step).

Bookings never expire automatically. The seller (for their own puppies) or admin can manually cancel a booking, returning the puppy to **Available**. Deposit refunds after cancellation are handled off-platform by admin (recorded via the wallet's manual adjustments if needed).

## Decisions made

- Balance is paid **online via Yoco** (not off-platform).
- Booked → Sold is **automatic** on balance payment; no seller confirmation.
- The **deposit option requires a buyer account**; full-price purchase remains open to guests.
- **Manual cancel only** — no auto-expiry of bookings.
- Modeled with a **status field on puppies + typed transactions** (no separate bookings table).

## Data model

### puppies (new columns)

| Column | Type | Notes |
|---|---|---|
| `status` | TEXT DEFAULT 'available' | `available` \| `booked` \| `sold` |
| `booked_by` | TEXT DEFAULT '' | buyer id holding the booking |
| `booked_at` | TEXT DEFAULT NULL | ISO timestamp of deposit payment |

- The existing `sold` flag is kept in sync: `sold = 1` ⇔ `status = 'sold'`. All existing reads of `sold` keep working.
- Migration (via existing `_add_column` helper) backfills `status = 'sold'` where `sold = 1`, else `'available'`.

### transactions (new column)

| Column | Type | Notes |
|---|---|---|
| `type` | TEXT DEFAULT 'full' | `full` \| `deposit` \| `balance` |

## Backend (chichi-api)

### `POST /yoco/puppy-checkout`

New request field `payment_option` (default `'full'`):

- **`full`** — current behavior. Guests allowed. Rejected with 409 unless puppy `status = 'available'`. Amount = full price.
- **`deposit`** — requires a valid `buyer_id` (buyer must exist in DB → 401/403 otherwise). Rejected with 409 unless `status = 'available'`. Amount = `round(price * 0.5, 2)`.
- **`balance`** — requires `buyer_id` matching the puppy's `booked_by` (403 otherwise). Rejected with 409 unless `status = 'booked'`. Amount = `price − deposit already paid` (from the recorded deposit transaction), so the two payments sum exactly to the full price.

`payment_option` is carried in Yoco checkout `metadata` alongside the existing fields.

### Webhook (`/yoco/webhook`) and `POST /yoco/verify-puppy`

Both settlement paths handle the three payment options identically and idempotently:

- **full** → insert `type='full'` transaction; set `status='sold'`, `sold=1`, `sold_at`.
- **deposit** → insert `type='deposit'` transaction; set `status='booked'`, `booked_by`, `booked_at`.
- **balance** → insert `type='balance'` transaction; set `status='sold'`, `sold=1`, `sold_at`.

Idempotency: before processing, check the puppy's current status (e.g. a deposit event for an already-booked/sold puppy is a no-op; a balance event for an already-sold puppy is a no-op). `verify-puppy`'s existing "already sold → ok" shortcut extends to these states.

### Commission

Each transaction takes commission at the kennel's rate **on its own amount**. A 50% deposit + 50% balance therefore yields the same total commission and seller payout as one full-price sale. Existing wallet/payout screens need no changes — they already sum transactions.

### Cancel booking

- **`POST /seller/puppies/{id}/cancel-booking`** — seller auth; puppy must belong to seller's kennel and be `booked`.
- **`POST /admin/puppies/{id}/cancel-booking`** — admin auth; puppy must be `booked`.
- Effect: `status='available'`, `booked_by=''`, `booked_at=NULL`. The deposit transaction remains on record for the audit trail. Refunds are off-platform (admin wallet manual adjustment).

### Public API

`GET /puppies` / puppy detail responses include `status`, `booked_by` (needed by the frontend to show "Pay balance" to the right buyer).

## Frontend (chichi)

- **PuppyCard**: amber **Booked** badge (alongside existing red **Sold** badge), driven by `status`.
- **PuppyDetailPage**:
  - Available: two buttons — **Buy Now – R{price}** and **Reserve with 50% deposit – R{price/2}**. Deposit button requires login; guests are prompted to sign up / log in (reusing the existing login-prompt block).
  - Booked: shows a "Booked" state instead of the purchase form. If the logged-in buyer is `booked_by`, they instead see **Pay remaining balance – R{price/2}** which starts a `balance` checkout.
  - Sold: unchanged.
  - The post-payment `verify-puppy` call passes the payment option through so verification settles correctly.
- **BuyerDashboard**: "Booked puppies" section listing puppies the buyer holds, each with a **Pay balance** button linking into the balance checkout.
- **SellerPuppies**: booked puppies show status + buyer name, with a **Cancel booking** button behind a confirm dialog.
- **AdminPuppies**: same booked visibility + cancel button.

## Edge cases

| Case | Behavior |
|---|---|
| Second buyer tries deposit/full on a booked puppy | 409 at checkout creation |
| Non-booking buyer attempts balance payment | 403 |
| Balance webhook arrives twice | idempotent no-op the second time |
| Deposit succeeds but webhook and verify both miss | same exposure as today's full-payment flow (verify on return + webhook as backup) |
| Booking cancelled while buyer holds a stale "pay balance" page | balance checkout creation fails with 409 |

## Testing

Pytest in `chichi-api/tests/`:

- deposit checkout → webhook → puppy `booked`, deposit transaction with correct commission
- balance checkout by booking buyer → webhook → puppy `sold`, totals equal full-price sale
- balance attempt by different buyer → 403
- deposit/full attempt on booked puppy → 409
- seller + admin cancel-booking → puppy `available`, `booked_by` cleared; cancel on non-booked puppy → 409
- deposit without buyer account → rejected
- webhook idempotency (duplicate delivery)

Frontend verified manually against the local API (buy full, reserve, pay balance, cancel).
