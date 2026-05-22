# Chichi Backend Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Stack:** Python + FastAPI + SQLite  

---

## Overview

Add a real backend to the Chichi Chihuahua marketplace. The frontend (React + Vite) stays unchanged visually. `AppContext.jsx` is refactored to call a FastAPI server instead of reading from `mockData.js`. Data persists in a SQLite file (`chichi.db`).

---

## Architecture

```
React (localhost:5173)
        │
        │  HTTP / JSON
        ▼
FastAPI (localhost:8000)
        │
        │  SQL
        ▼
  chichi.db (SQLite)
```

The backend lives in a new `chichi-api/` folder alongside the existing `chichi/` frontend folder.

---

## Database — Tables

### `kennels`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | e.g. `k1` |
| name | TEXT | |
| slug | TEXT UNIQUE | URL-safe name |
| registry | TEXT | KUSA or Canine SA |
| initials | TEXT | |
| color | TEXT | hex color |
| description | TEXT | |
| location | TEXT | |
| contact | TEXT | email |
| phone | TEXT | |
| membership_status | TEXT | active / pending_payment |
| membership_expiry | TEXT | ISO date or NULL |
| commission | REAL | percentage |
| status | TEXT | approved / pending / rejected |
| referred_by | TEXT | kennel id or NULL |
| referral_code | TEXT | |

### `puppies`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| kennel_id | TEXT FK | → kennels.id |
| name | TEXT | |
| coat_type | TEXT | Smooth Coat / Long Coat |
| gender | TEXT | Male / Female |
| color | TEXT | |
| dob | TEXT | ISO date |
| price | REAL | ZAR |
| sold | INTEGER | 0 or 1 |
| breeding_rights | INTEGER | 0 or 1 |
| images | TEXT | JSON array of URLs |
| pedigree | TEXT | JSON object |
| health | TEXT | JSON array of strings |
| description | TEXT | |
| registration_no | TEXT | |

### `sellers`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt hash |
| name | TEXT | |
| kennel_id | TEXT FK | → kennels.id or NULL |
| status | TEXT | approved / pending_verification / pending_payment |
| joined_date | TEXT | ISO date |
| warning_date | TEXT | ISO date or NULL |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| puppy_id | TEXT | |
| puppy_name | TEXT | denormalised for history |
| kennel_id | TEXT | |
| kennel_name | TEXT | denormalised |
| buyer_name | TEXT | |
| buyer_email | TEXT | |
| amount | REAL | |
| commission | REAL | |
| seller_payout | REAL | |
| seller_paid | INTEGER | 0 or 1 |
| commission_paid | INTEGER | 0 or 1 |
| date | TEXT | ISO date |
| seller_paid_date | TEXT | ISO date or NULL |
| commission_paid_date | TEXT | ISO date or NULL |

### `testimonials`
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| kennel_id | TEXT FK | |
| buyer_name | TEXT | |
| stars | INTEGER | 1–5 |
| text | TEXT | |
| date | TEXT | ISO date |

### `admin_settings`
Single row. Columns: `default_commission`, `membership_fee_annual`, `referral_discount`, `site_name`, `tagline`, `admin_bank_name`, `admin_account_holder`, `admin_account_number`, `admin_branch_code`, `admin_account_type`.

### `legal_text`
Single row. Column: `content` (markdown string).

---

## Authentication

- **Admin:** POST `/auth/admin/login` with email + password. Credentials stored as env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`). Returns JWT.
- **Seller:** POST `/auth/seller/login` with email + password. Password checked against `bcrypt` hash in DB. Returns JWT with `seller_id` claim.
- **JWT:** Signed with `SECRET_KEY` env var. Expiry: 7 days. Frontend stores token in `localStorage`, sends as `Authorization: Bearer <token>` header.

---

## API Endpoints

### Public
```
GET  /kennels                    list approved kennels
GET  /kennels/{slug}             single kennel + its available puppies
GET  /puppies                    list puppies (query params: coat, gender, sold)
GET  /puppies/{id}               single puppy detail
GET  /testimonials               all testimonials
```

### Auth
```
POST /auth/admin/login           → { token }
POST /auth/seller/login          → { token, seller }
POST /auth/seller/signup         → creates pending_verification seller
```

### Seller (JWT required)
```
GET    /seller/me                current seller + kennel
PUT    /seller/profile           update kennel fields
GET    /seller/puppies           seller's listings
POST   /seller/puppies           add puppy listing
DELETE /seller/puppies/{id}      delist puppy
```

### Admin (JWT required)
```
GET    /admin/kennels            all kennels
POST   /admin/kennels            add kennel
PUT    /admin/kennels/{id}       edit kennel
DELETE /admin/kennels/{id}       remove kennel (cascades puppies, unlinks sellers)

GET    /admin/sellers            all sellers
POST   /admin/sellers            add seller
PUT    /admin/sellers/{id}       edit seller
DELETE /admin/sellers/{id}       remove seller
PATCH  /admin/sellers/{id}/approve        → status: pending_payment + creates kennel
PATCH  /admin/sellers/{id}/pay-membership → status: approved + sets expiry

GET    /admin/puppies            all puppies
DELETE /admin/puppies/{id}       remove listing

GET    /admin/testimonials       all testimonials
POST   /admin/testimonials       add testimonial
DELETE /admin/testimonials/{id}  remove testimonial

GET    /admin/transactions       all transactions
POST   /admin/transactions/{id}/release    mark seller + commission paid

GET    /admin/settings           current settings
PUT    /admin/settings           update settings

GET    /admin/legal              current legal text
PUT    /admin/legal              update legal text
```

### Buyer
```
POST /transactions               purchase puppy → creates transaction, marks puppy sold
```

---

## Project Structure

```
chichi-api/
├── main.py              FastAPI app, CORS config
├── database.py          SQLite connection, table creation
├── models.py            Pydantic request/response schemas
├── auth.py              JWT creation and verification
├── seed.py              one-time script to import mockData into SQLite
├── routers/
│   ├── public.py        kennels, puppies, testimonials (no auth)
│   ├── auth.py          login, signup
│   ├── seller.py        seller-protected routes
│   ├── admin.py         admin-protected routes
│   └── transactions.py  purchase + release
└── requirements.txt
```

---

## Frontend Changes

Only `src/context/AppContext.jsx` changes. All UI components remain untouched.

- Remove `mockData.js` imports
- Replace every state mutation with `await fetch(...)` to the API
- Add `token` state (read from `localStorage` on load)
- Add `loading` / `error` states
- All existing function signatures stay the same so components need no changes

**Example migration pattern:**
```js
// Before
const loginSeller = (email, password) => {
  const seller = sellers.find(s => s.email === email && s.password === password)
  if (!seller) return { success: false, error: 'Invalid credentials.' }
  setSellerUser({ ...seller })
  return { success: true }
}

// After
const loginSeller = async (email, password) => {
  const res = await fetch('http://localhost:8000/auth/seller/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return { success: false, error: 'Invalid credentials.' }
  const { token, seller } = await res.json()
  localStorage.setItem('token', token)
  setSellerUser(seller)
  return { success: true }
}
```

---

## Seed Data

A `seed.py` script imports all existing mock data (kennels, puppies, sellers, transactions, testimonials) into SQLite on first run. Seller passwords are hashed with bcrypt during seeding. Run once after creating the DB.

---

## Environment Variables

```
SECRET_KEY=<random string for JWT signing>
ADMIN_EMAIL=admin@chihuahuasa.co.za
ADMIN_PASSWORD_HASH=<bcrypt hash of admin password>
```

Stored in `chichi-api/.env`, not committed to git.

---

## Out of Scope

- Real payment processing (membership payment flow stays as a manual bank transfer confirmation)
- Email sending (approval/inactivity emails remain as console stubs)
- File upload for puppy images (images remain as URLs)
- Deployment / production hosting
