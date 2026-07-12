# Deposit / Full-Payment Purchase Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buyers can pay full price (puppy → Sold) or a 50% deposit (puppy → Booked), then pay the balance online later (puppy → Sold automatically). Sellers/admin can manually cancel a booking.

**Architecture:** Add a `status` column (`available`/`booked`/`sold`) to puppies plus `booked_by`/`booked_at`, and a `type` column (`full`/`deposit`/`balance`) to transactions. A shared settlement helper (`puppy_sales.py`) records payments idempotently and is called from both the Yoco webhook and the `verify-puppy` endpoint. Commission is charged per-payment at the kennel rate, so deposit + balance total exactly equals a full sale.

**Tech Stack:** FastAPI + sqlite3/psycopg2 (chichi-api, deployed on Render), React + Vite + Tailwind (chichi, deployed on Vercel), Yoco hosted checkout, pytest.

**Spec:** `chichi/docs/superpowers/specs/2026-07-11-deposit-purchase-flow-design.md`

## Global Constraints

- Repo root is `/home/marnu` (single git repo). Backend code: `/home/marnu/chichi-api`. Frontend code: `/home/marnu/chichi`.
- Backend must work on BOTH sqlite (`conn.execute('?')`) and PostgreSQL (via `_PgConnection` wrapper) — never use sqlite-only or pg-only SQL beyond what `_add_column` already handles.
- The API returns snake_case; the frontend `normalize()` converts to camelCase (`booked_by` → `bookedBy`). Frontend requests via `apiFetch` denormalize back to snake_case.
- Existing `sold` flag must stay in sync: `sold = 1` ⇔ `status = 'sold'`. Never break existing readers of `sold`.
- Run backend tests with: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
- All backend tests must pass before every commit; frontend tasks must pass `cd /home/marnu/chichi && npm run build`.
- Puppy status values: exactly `'available'`, `'booked'`, `'sold'`. Transaction types: exactly `'full'`, `'deposit'`, `'balance'`.
- Status derivation for legacy rows (status column NULL/empty): `'sold' if sold else 'available'`.

---

### Task 1: Schema migration + row parsers

**Files:**
- Modify: `/home/marnu/chichi-api/database.py` (migrations block ~line 289; `parse_puppy` line 316; `parse_transaction` line 329)
- Test: `/home/marnu/chichi-api/tests/test_db.py`

**Interfaces:**
- Produces: puppies columns `status TEXT DEFAULT 'available'`, `booked_by TEXT DEFAULT ''`, `booked_at TEXT DEFAULT NULL`; transactions column `type TEXT DEFAULT 'full'`. `parse_puppy(row)['status']` always one of available/booked/sold; `parse_transaction(row)['type']` always set.

- [ ] **Step 1: Write the failing tests** — append to `tests/test_db.py`:

```python
def test_puppy_status_columns_exist(test_db):
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold, status, booked_by, booked_at)
        VALUES ('px1', 'k1', 'Rex', 10000.0, 0, 'booked', 'b1', '2026-07-12T10:00:00')
    """)
    test_db.commit()
    from database import parse_puppy
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'px1'").fetchone()
    p = parse_puppy(row)
    assert p['status'] == 'booked'
    assert p['booked_by'] == 'b1'


def test_status_backfilled_from_sold_flag(test_db):
    # Legacy row: sold=1 but status left at default — create_tables() must backfill
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold)
        VALUES ('px2', 'k1', 'Old', 9000.0, 1)
    """)
    test_db.execute("UPDATE puppies SET status = 'available' WHERE id = 'px2'")
    test_db.commit()
    from database import create_tables
    create_tables(test_db)  # re-run migrations — must be idempotent
    row = test_db.execute("SELECT status FROM puppies WHERE id = 'px2'").fetchone()
    assert dict(row)['status'] == 'sold'


def test_parse_puppy_derives_status_when_missing(test_db):
    from database import parse_puppy
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold)
        VALUES ('px3', 'k1', 'NoStatus', 8000.0, 0)
    """)
    test_db.execute("UPDATE puppies SET status = NULL WHERE id = 'px3'")
    test_db.commit()
    row = test_db.execute("SELECT * FROM puppies WHERE id = 'px3'").fetchone()
    assert parse_puppy(row)['status'] == 'available'


def test_parse_transaction_type_defaults_to_full(test_db):
    from database import parse_transaction
    test_db.execute("""
        INSERT INTO transactions (id, puppy_id, amount) VALUES ('t1', 'p1', 100.0)
    """)
    test_db.execute("UPDATE transactions SET type = NULL WHERE id = 't1'")
    test_db.commit()
    row = test_db.execute("SELECT * FROM transactions WHERE id = 't1'").fetchone()
    assert parse_transaction(row)['type'] == 'full'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_db.py -q`
Expected: FAIL — `no such column: status` / `no such column: type`

- [ ] **Step 3: Implement migrations + parser changes** in `database.py`.

After the existing `_add_column(conn, is_pg, 'puppies', 'sold_at', ...)` line (289), add:

```python
    for col, defn in [
        ('status', "TEXT DEFAULT 'available'"),
        ('booked_by', "TEXT DEFAULT ''"),
        ('booked_at', "TEXT DEFAULT NULL"),
    ]:
        _add_column(conn, is_pg, 'puppies', col, defn)

    _add_column(conn, is_pg, 'transactions', 'type', "TEXT DEFAULT 'full'")

    # Backfill status from the legacy sold flag — idempotent, safe on every deploy
    try:
        conn.execute("UPDATE puppies SET status = 'sold' WHERE sold = 1 AND (status IS NULL OR status != 'sold')")
        conn.execute("UPDATE puppies SET status = 'available' WHERE sold = 0 AND (status IS NULL OR status = '')")
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f'[db] warning: status backfill failed: {e}')
```

In `parse_puppy`, before `return d`:

```python
    d['status'] = d.get('status') or ('sold' if d['sold'] else 'available')
    d['booked_by'] = d.get('booked_by') or ''
```

In `parse_transaction`, before `return d`:

```python
    d['type'] = d.get('type') or 'full'
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /home/marnu && git add chichi-api/database.py chichi-api/tests/test_db.py
git commit -m "feat(chichi-api): puppy status + booking columns, transaction type"
```

---

### Task 2: Settlement helper `puppy_sales.py`

**Files:**
- Create: `/home/marnu/chichi-api/puppy_sales.py`
- Test: `/home/marnu/chichi-api/tests/test_puppy_sales.py`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: `record_puppy_payment(db, puppy_id: str, payment_option: str, buyer_name: str, buyer_email: str, buyer_id: str) -> str | None` — records one payment, updates puppy state, commits, returns the new transaction id, or returns `None` for any no-op (unknown puppy, wrong state, duplicate delivery). Also `puppy_status(puppy: dict) -> str` returning the derived status string.

- [ ] **Step 1: Write the failing tests** — create `tests/test_puppy_sales.py`:

```python
import pytest
from puppy_sales import record_puppy_payment, puppy_status


@pytest.fixture
def sales_db(test_db):
    test_db.execute("""
        INSERT INTO kennels (id, name, slug, registry, commission, status)
        VALUES ('k1', 'Kennel', 'kennel', 'KUSA', 10.0, 'approved')
    """)
    test_db.execute("""
        INSERT INTO puppies (id, kennel_id, name, price, sold, status)
        VALUES ('p1', 'k1', 'Duke', 10000.0, 0, 'available')
    """)
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()
    return test_db


def _puppy(db, pid='p1'):
    return dict(db.execute('SELECT * FROM puppies WHERE id = ?', (pid,)).fetchone())


def _txns(db, pid='p1'):
    return [dict(r) for r in db.execute(
        'SELECT * FROM transactions WHERE puppy_id = ? ORDER BY id', (pid,)).fetchall()]


def test_full_payment_marks_sold(sales_db):
    txn = record_puppy_payment(sales_db, 'p1', 'full', 'Buyer One', 'buyer@test.co.za', 'b1')
    assert txn is not None
    p = _puppy(sales_db)
    assert p['status'] == 'sold' and p['sold'] == 1
    t = _txns(sales_db)[0]
    assert t['type'] == 'full' and t['amount'] == 10000.0
    assert t['commission'] == 1000.0 and t['seller_payout'] == 9000.0


def test_deposit_marks_booked(sales_db):
    txn = record_puppy_payment(sales_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    assert txn is not None
    p = _puppy(sales_db)
    assert p['status'] == 'booked' and p['sold'] == 0
    assert p['booked_by'] == 'b1' and p['booked_at']
    t = _txns(sales_db)[0]
    assert t['type'] == 'deposit' and t['amount'] == 5000.0
    assert t['commission'] == 500.0 and t['seller_payout'] == 4500.0


def test_balance_after_deposit_marks_sold_and_totals_match_full(sales_db):
    record_puppy_payment(sales_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    txn = record_puppy_payment(sales_db, 'p1', 'balance', 'Buyer One', 'buyer@test.co.za', 'b1')
    assert txn is not None
    p = _puppy(sales_db)
    assert p['status'] == 'sold' and p['sold'] == 1
    txns = _txns(sales_db)
    assert [t['type'] for t in txns] == ['deposit', 'balance'] or \
           {t['type'] for t in txns} == {'deposit', 'balance'}
    assert sum(t['amount'] for t in txns) == 10000.0
    assert sum(t['commission'] for t in txns) == 1000.0
    assert sum(t['seller_payout'] for t in txns) == 9000.0


def test_duplicate_deposit_is_noop(sales_db):
    assert record_puppy_payment(sales_db, 'p1', 'deposit', 'B', 'b@t.co', 'b1') is not None
    assert record_puppy_payment(sales_db, 'p1', 'deposit', 'B', 'b@t.co', 'b1') is None
    assert len(_txns(sales_db)) == 1


def test_balance_on_available_puppy_is_noop(sales_db):
    assert record_puppy_payment(sales_db, 'p1', 'balance', 'B', 'b@t.co', 'b1') is None
    assert _txns(sales_db) == []


def test_full_on_sold_puppy_is_noop(sales_db):
    record_puppy_payment(sales_db, 'p1', 'full', 'B', 'b@t.co', 'b1')
    assert record_puppy_payment(sales_db, 'p1', 'full', 'B', 'b@t.co', 'b1') is None
    assert len(_txns(sales_db)) == 1


def test_unknown_puppy_is_noop(sales_db):
    assert record_puppy_payment(sales_db, 'nope', 'full', 'B', 'b@t.co', 'b1') is None


def test_puppy_status_derivation():
    assert puppy_status({'status': 'booked', 'sold': 0}) == 'booked'
    assert puppy_status({'status': None, 'sold': 1}) == 'sold'
    assert puppy_status({'status': '', 'sold': 0}) == 'available'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_puppy_sales.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'puppy_sales'`

- [ ] **Step 3: Create `/home/marnu/chichi-api/puppy_sales.py`:**

```python
"""Shared settlement logic for puppy payments (full / deposit / balance).

Called from the Yoco webhook and verify-puppy — both may fire for the same
payment, so every path here is an idempotent no-op when the puppy is not in
the expected state.
"""
import uuid
from datetime import date, datetime


def puppy_status(puppy: dict) -> str:
    return puppy.get('status') or ('sold' if puppy.get('sold') else 'available')


def record_puppy_payment(db, puppy_id: str, payment_option: str,
                         buyer_name: str, buyer_email: str, buyer_id: str):
    """Record one successful payment. Returns the new txn id, or None if no-op."""
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row:
        return None
    puppy = dict(row)
    status = puppy_status(puppy)

    if payment_option == 'balance':
        if status != 'booked':
            return None
    else:  # full or deposit
        if status != 'available':
            return None

    price = puppy['price']
    if payment_option == 'deposit':
        amount = round(price * 0.5, 2)
    elif payment_option == 'balance':
        dep = db.execute(
            "SELECT amount FROM transactions WHERE puppy_id = ? AND type = 'deposit' "
            "ORDER BY date DESC LIMIT 1", (puppy_id,)).fetchone()
        deposit_paid = dict(dep)['amount'] if dep else round(price * 0.5, 2)
        amount = round(price - deposit_paid, 2)
    else:
        amount = price

    kennel = db.execute('SELECT * FROM kennels WHERE id = ?', (puppy['kennel_id'],)).fetchone()
    rate = dict(kennel)['commission'] if kennel else 8.0
    commission = round(amount * rate / 100, 2)
    seller_payout = round(amount - commission, 2)

    txn_id = f'txn{uuid.uuid4().hex[:8]}'
    now = datetime.now().isoformat()
    db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date, buyer_id, type)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?)
    """, (
        txn_id, puppy['id'], puppy['name'],
        puppy['kennel_id'], dict(kennel)['name'] if kennel else '',
        buyer_name, buyer_email,
        amount, commission, seller_payout, date.today().isoformat(), buyer_id or '',
        payment_option,
    ))

    if payment_option == 'deposit':
        db.execute(
            "UPDATE puppies SET status = 'booked', booked_by = ?, booked_at = ? WHERE id = ?",
            (buyer_id or '', now, puppy_id))
    else:
        db.execute(
            "UPDATE puppies SET status = 'sold', sold = 1, sold_at = ? WHERE id = ?",
            (now, puppy_id))
    db.commit()
    return txn_id
```

- [ ] **Step 4: Run tests**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_puppy_sales.py tests/ -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /home/marnu && git add chichi-api/puppy_sales.py chichi-api/tests/test_puppy_sales.py
git commit -m "feat(chichi-api): idempotent puppy payment settlement helper"
```

---

### Task 3: Checkout endpoint `payment_option` support

**Files:**
- Modify: `/home/marnu/chichi-api/routers/yoco.py` (`yoco_puppy_checkout`, lines 40–72)
- Test: `/home/marnu/chichi-api/tests/test_yoco_checkout.py` (create)

**Interfaces:**
- Consumes: `puppy_status` from Task 2.
- Produces: `POST /yoco/puppy-checkout` accepts `payment_option` (`'full'` default, `'deposit'`, `'balance'`); returns 409 on wrong puppy state, 403 on buyer mismatch, 400 on bad option. Metadata sent to Yoco includes `payment_option`; success URL is `{FRONTEND_URL}/puppies/{id}?purchased={payment_option}`.

- [ ] **Step 1: Write the failing tests** — create `tests/test_yoco_checkout.py`:

```python
import pytest


@pytest.fixture
def checkout_client(seeded_client, test_db, monkeypatch):
    """seeded_client + a buyer account + mocked Yoco create_checkout."""
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()

    captured = {}

    async def fake_create_checkout(amount_cents, metadata, success_url, cancel_url):
        captured['amount_cents'] = amount_cents
        captured['metadata'] = metadata
        captured['success_url'] = success_url
        return {'redirectUrl': 'https://pay.test/r', 'id': 'ch_test1'}

    import routers.yoco as yoco_mod
    monkeypatch.setattr(yoco_mod, 'create_checkout', fake_create_checkout)
    seeded_client.captured = captured
    return seeded_client


def _body(**over):
    base = {'puppy_id': 'p1', 'buyer_name': 'Buyer One',
            'buyer_email': 'buyer@test.co.za', 'buyer_id': 'b1'}
    base.update(over)
    return base


def test_full_checkout_default(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body())
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 1550000  # R15,500 seeded price
    assert checkout_client.captured['metadata']['payment_option'] == 'full'
    assert 'purchased=full' in checkout_client.captured['success_url']


def test_deposit_checkout_half_price(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='deposit'))
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 775000  # 50% of R15,500
    assert checkout_client.captured['metadata']['payment_option'] == 'deposit'


def test_deposit_requires_buyer_account(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='deposit', buyer_id=''))
    assert res.status_code == 403
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='deposit', buyer_id='ghost'))
    assert res.status_code == 403


def test_deposit_blocked_when_booked(checkout_client, test_db):
    test_db.execute("UPDATE puppies SET status = 'booked', booked_by = 'b1' WHERE id = 'p1'")
    test_db.commit()
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='deposit'))
    assert res.status_code == 409
    res = checkout_client.post('/yoco/puppy-checkout', json=_body())  # full also blocked
    assert res.status_code == 409


def test_balance_checkout_remaining_amount(checkout_client, test_db):
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='balance'))
    assert res.status_code == 200
    assert checkout_client.captured['amount_cents'] == 775000  # remaining 50%


def test_balance_only_for_booking_buyer(checkout_client, test_db):
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    res = checkout_client.post('/yoco/puppy-checkout',
                               json=_body(payment_option='balance', buyer_id='b2'))
    assert res.status_code == 403


def test_balance_blocked_when_not_booked(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='balance'))
    assert res.status_code == 409


def test_invalid_payment_option(checkout_client):
    res = checkout_client.post('/yoco/puppy-checkout', json=_body(payment_option='weird'))
    assert res.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_yoco_checkout.py -q`
Expected: FAIL — 200 vs 400/403/409 mismatches, missing `payment_option` metadata

- [ ] **Step 3: Replace `yoco_puppy_checkout`** in `routers/yoco.py`:

Add to imports: `from puppy_sales import puppy_status, record_puppy_payment`

```python
@router.post('/yoco/puppy-checkout')
async def yoco_puppy_checkout(body: dict, db=Depends(get_db)):
    puppy_id = body.get('puppy_id', '')
    buyer_name = body.get('buyer_name', '').strip()
    buyer_email = body.get('buyer_email', '').strip()
    buyer_id = body.get('buyer_id', '')
    payment_option = body.get('payment_option', 'full')

    if payment_option not in ('full', 'deposit', 'balance'):
        raise HTTPException(status_code=400, detail='Invalid payment option')

    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not puppy:
        raise HTTPException(status_code=404, detail='Puppy not found')
    puppy = dict(puppy)
    status = puppy_status(puppy)

    if payment_option in ('full', 'deposit'):
        if status != 'available':
            raise HTTPException(status_code=409, detail='Puppy not available')
    if payment_option == 'deposit':
        buyer = db.execute('SELECT id FROM buyers WHERE id = ?', (buyer_id,)).fetchone() if buyer_id else None
        if not buyer:
            raise HTTPException(status_code=403, detail='Deposit requires a buyer account')
    if payment_option == 'balance':
        if status != 'booked':
            raise HTTPException(status_code=409, detail='Puppy is not booked')
        if not buyer_id or buyer_id != (puppy.get('booked_by') or ''):
            raise HTTPException(status_code=403, detail='Only the booking buyer can pay the balance')

    if payment_option == 'deposit':
        amount = round(puppy['price'] * 0.5, 2)
    elif payment_option == 'balance':
        dep = db.execute(
            "SELECT amount FROM transactions WHERE puppy_id = ? AND type = 'deposit' "
            "ORDER BY date DESC LIMIT 1", (puppy_id,)).fetchone()
        deposit_paid = dict(dep)['amount'] if dep else round(puppy['price'] * 0.5, 2)
        amount = round(puppy['price'] - deposit_paid, 2)
    else:
        amount = puppy['price']
    amount_cents = int(round(amount * 100))

    try:
        session = await create_checkout(
            amount_cents=amount_cents,
            metadata={
                'type': 'puppy',
                'payment_option': payment_option,
                'puppy_id': puppy_id,
                'buyer_name': buyer_name,
                'buyer_email': buyer_email,
                'buyer_id': buyer_id,
            },
            success_url=f'{FRONTEND_URL}/puppies/{puppy_id}?purchased={payment_option}',
            cancel_url=f'{FRONTEND_URL}/puppies/{puppy_id}',
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail='Payment provider error')

    return {'redirect_url': session['redirectUrl'], 'checkout_id': session['id']}
```

- [ ] **Step 4: Run tests**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /home/marnu && git add chichi-api/routers/yoco.py chichi-api/tests/test_yoco_checkout.py
git commit -m "feat(chichi-api): full/deposit/balance payment options on puppy checkout"
```

---

### Task 4: Webhook + verify-puppy settle via the helper

**Files:**
- Modify: `/home/marnu/chichi-api/routers/yoco.py` (`yoco_webhook` puppy branch lines 108–138; `verify_puppy` lines 185–256)
- Test: `/home/marnu/chichi-api/tests/test_yoco_settlement.py` (create)

**Interfaces:**
- Consumes: `record_puppy_payment` from Task 2 (already imported in Task 3).
- Produces: webhook and verify both honor `metadata['payment_option']` (default `'full'` for legacy checkouts) and are idempotent.

- [ ] **Step 1: Write the failing tests** — create `tests/test_yoco_settlement.py`:

```python
import json
import pytest


@pytest.fixture
def hook_client(seeded_client, test_db, monkeypatch):
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()
    import routers.yoco as yoco_mod
    monkeypatch.setattr(yoco_mod, 'verify_webhook', lambda body, sig: True)
    return seeded_client


def _event(payment_option, buyer_id='b1'):
    return {
        'type': 'payment.succeeded',
        'payload': {'metadata': {
            'type': 'puppy', 'payment_option': payment_option, 'puppy_id': 'p1',
            'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
            'buyer_id': buyer_id,
        }},
    }


def _puppy(db):
    return dict(db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone())


def test_webhook_deposit_books_puppy(hook_client, test_db):
    res = hook_client.post('/yoco/webhook', json=_event('deposit'))
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'booked' and p['sold'] == 0 and p['booked_by'] == 'b1'


def test_webhook_balance_sells_puppy(hook_client, test_db):
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    res = hook_client.post('/yoco/webhook', json=_event('balance'))
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'sold' and p['sold'] == 1
    txns = test_db.execute("SELECT type, amount FROM transactions WHERE puppy_id = 'p1'").fetchall()
    assert sum(dict(t)['amount'] for t in txns) == 15500.0


def test_webhook_duplicate_delivery_noop(hook_client, test_db):
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    hook_client.post('/yoco/webhook', json=_event('deposit'))
    count = test_db.execute("SELECT COUNT(*) AS c FROM transactions WHERE puppy_id = 'p1'").fetchone()
    assert dict(count)['c'] == 1


def test_webhook_legacy_event_without_option_sells(hook_client, test_db):
    ev = _event('full')
    del ev['payload']['metadata']['payment_option']
    hook_client.post('/yoco/webhook', json=ev)
    assert _puppy(test_db)['status'] == 'sold'


class _FakeResponse:
    is_success = True
    def __init__(self, payload):
        self._payload = payload
    def json(self):
        return self._payload


class _FakeAsyncClient:
    payload = {}
    def __init__(self, *a, **kw):
        pass
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False
    async def get(self, url, **kw):
        return _FakeResponse(_FakeAsyncClient.payload)


def test_verify_puppy_deposit(hook_client, test_db, monkeypatch):
    import routers.yoco as yoco_mod
    _FakeAsyncClient.payload = {
        'status': 'succeeded',
        'metadata': {'payment_option': 'deposit', 'puppy_id': 'p1',
                     'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
                     'buyer_id': 'b1'},
    }
    monkeypatch.setattr(yoco_mod.httpx, 'AsyncClient', _FakeAsyncClient)
    res = hook_client.post('/yoco/verify-puppy', json={
        'checkout_id': 'ch_x', 'puppy_id': 'p1', 'buyer_id': 'b1',
        'buyer_name': 'Buyer One', 'buyer_email': 'buyer@test.co.za',
    })
    assert res.status_code == 200
    assert _puppy(test_db)['status'] == 'booked'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_yoco_settlement.py -q`
Expected: FAIL — deposit event marks puppy sold (legacy behavior), duplicate creates 2 txns

- [ ] **Step 3: Refactor.** In `yoco_webhook`, replace the whole `elif payment_type == 'puppy':` branch with:

```python
    elif payment_type == 'puppy':
        record_puppy_payment(
            db,
            metadata.get('puppy_id', ''),
            metadata.get('payment_option', 'full'),
            metadata.get('buyer_name', ''),
            metadata.get('buyer_email', ''),
            metadata.get('buyer_id', ''),
        )
```

In `verify_puppy`, extract `payment_option` from checkout metadata and replace the settlement block (kennel lookup + INSERT + UPDATE + commit, lines 235–255) with a helper call. The updated flow after the Yoco status check:

```python
        # Enrich buyer details from Yoco metadata when not provided by frontend
        metadata = checkout.get('metadata', {})
        buyer_name = buyer_name or metadata.get('buyer_name', '')
        buyer_email = buyer_email or metadata.get('buyer_email', '')
        buyer_id = buyer_id or metadata.get('buyer_id', '')
        payment_option = metadata.get('payment_option', 'full')

    except HTTPException:
        raise
    except Exception as e:
        print(f'[verify-puppy] exception: {e}')
        raise HTTPException(status_code=502, detail='Could not verify payment')

    txn_id = record_puppy_payment(db, puppy_id, payment_option,
                                  buyer_name, buyer_email, buyer_id)
    if txn_id:
        print(f'[verify-puppy] txn {txn_id} created for puppy {puppy_id} ({payment_option})')
    return {'ok': True}
```

Also update `verify_puppy`'s early-exit guard: replace `if puppy.get('sold'): return {'ok': True}` with:

```python
    if puppy.get('sold'):
        return {'ok': True}  # settled — record_puppy_payment would no-op anyway
```

(keep as-is; `record_puppy_payment` handles booked-state idempotency).

- [ ] **Step 4: Run the full suite**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /home/marnu && git add chichi-api/routers/yoco.py chichi-api/tests/test_yoco_settlement.py
git commit -m "feat(chichi-api): webhook + verify-puppy settle deposits and balances idempotently"
```

---

### Task 5: Cancel-booking endpoints + admin mark-sold sync

**Files:**
- Modify: `/home/marnu/chichi-api/routers/seller.py` (add endpoint after `delist_puppy`, ~line 156)
- Modify: `/home/marnu/chichi-api/routers/admin.py` (add endpoint after `admin_mark_puppy_sold`, ~line 466; also update `admin_mark_puppy_sold`'s UPDATE)
- Test: `/home/marnu/chichi-api/tests/test_cancel_booking.py` (create)

**Interfaces:**
- Produces: `POST /seller/puppies/{puppy_id}/cancel-booking` (seller auth, own kennel only), `POST /admin/puppies/{puppy_id}/cancel-booking` (admin auth). Both: 409 if puppy not booked, else set `status='available'`, `booked_by=''`, `booked_at=NULL` and return the updated puppy.

- [ ] **Step 1: Write the failing tests** — create `tests/test_cancel_booking.py`:

```python
import pytest


@pytest.fixture
def booked_setup(seeded_client, test_db):
    test_db.execute("""
        INSERT INTO buyers (id, email, password_hash, name)
        VALUES ('b1', 'buyer@test.co.za', 'x', 'Buyer One')
    """)
    test_db.commit()
    from puppy_sales import record_puppy_payment
    record_puppy_payment(test_db, 'p1', 'deposit', 'Buyer One', 'buyer@test.co.za', 'b1')
    return seeded_client


@pytest.fixture
def seller_token(booked_setup):
    res = booked_setup.post('/auth/seller/login', json={
        'email': 'seller@test.co.za', 'password': 'seller123'})
    return res.json()['token']


def _puppy(db):
    return dict(db.execute("SELECT * FROM puppies WHERE id = 'p1'").fetchone())


def test_seller_cancel_booking(booked_setup, test_db, seller_token):
    res = booked_setup.post('/seller/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {seller_token}'})
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'available' and p['booked_by'] == '' and p['sold'] == 0


def test_seller_cancel_requires_booked_state(booked_setup, test_db, seller_token):
    test_db.execute("UPDATE puppies SET status = 'available', booked_by = '' WHERE id = 'p1'")
    test_db.commit()
    res = booked_setup.post('/seller/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {seller_token}'})
    assert res.status_code == 409


def test_seller_cancel_requires_auth(booked_setup):
    res = booked_setup.post('/seller/puppies/p1/cancel-booking')
    assert res.status_code in (401, 403)


def test_admin_cancel_booking(booked_setup, test_db, admin_token):
    res = booked_setup.post('/admin/puppies/p1/cancel-booking',
                            headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    assert _puppy(test_db)['status'] == 'available'


def test_admin_mark_sold_sets_status(booked_setup, test_db, admin_token):
    res = booked_setup.post('/admin/puppies/p1/mark-sold',
                            headers={'Authorization': f'Bearer {admin_token}'},
                            json={'buyer_name': 'B', 'buyer_email': 'b@t.co'})
    assert res.status_code == 200
    p = _puppy(test_db)
    assert p['status'] == 'sold' and p['sold'] == 1
```

(The seller login route is `/auth/seller/login` — verified against `tests/test_seller.py:2`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/test_cancel_booking.py -q`
Expected: FAIL — 404 (route does not exist)

- [ ] **Step 3: Implement.** In `routers/seller.py` after `delist_puppy`:

```python
@router.post('/puppies/{puppy_id}/cancel-booking')
def cancel_booking(
    puppy_id: str,
    seller: dict = Depends(get_current_seller),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row or dict(row)['kennel_id'] != seller.get('kennel_id'):
        raise HTTPException(status_code=404, detail='Puppy not found')
    puppy = dict(row)
    if (puppy.get('status') or '') != 'booked':
        raise HTTPException(status_code=409, detail='Puppy is not booked')
    db.execute(
        "UPDATE puppies SET status = 'available', booked_by = '', booked_at = NULL WHERE id = ?",
        (puppy_id,))
    db.commit()
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    return parse_puppy(row)
```

In `routers/admin.py` after `admin_mark_puppy_sold` (import `parse_puppy` from `database` if not already imported):

```python
@router.post('/puppies/{puppy_id}/cancel-booking')
def admin_cancel_booking(
    puppy_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Puppy not found')
    if (dict(row).get('status') or '') != 'booked':
        raise HTTPException(status_code=409, detail='Puppy is not booked')
    db.execute(
        "UPDATE puppies SET status = 'available', booked_by = '', booked_at = NULL WHERE id = ?",
        (puppy_id,))
    db.commit()
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    return parse_puppy(row)
```

In `admin_mark_puppy_sold`, change the puppy UPDATE (line 465) to:

```python
    db.execute(
        "UPDATE puppies SET sold = 1, sold_at = ?, status = 'sold', booked_by = '' WHERE id = ?",
        (now, puppy_id))
```

and add `type` to its INSERT: column list gains `, type` and VALUES gains `,?` with parameter `'full'` appended after `buyer_id`.

- [ ] **Step 4: Run the full suite**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /home/marnu && git add chichi-api/routers/seller.py chichi-api/routers/admin.py chichi-api/tests/test_cancel_booking.py
git commit -m "feat(chichi-api): seller/admin cancel-booking endpoints, mark-sold status sync"
```

---

### Task 6: Frontend — Booked badge (PuppyCard + CSS)

**Files:**
- Modify: `/home/marnu/chichi/src/index.css` (badge classes ~line 61)
- Modify: `/home/marnu/chichi/src/components/PuppyCard.jsx`

**Interfaces:**
- Consumes: `puppy.status` / `puppy.bookedBy` (camelCase via `normalize()`).
- Produces: `.badge-booked` CSS class; cards show Sold / Booked / Available.

- [ ] **Step 1: Add CSS class** in `index.css` after `.badge-sold`:

```css
  .badge-booked {
    @apply bg-amber-100 text-amber-700 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5;
  }
```

- [ ] **Step 2: Update PuppyCard.jsx.** Replace `const isSold = puppy.sold` (line 37) with:

```jsx
  const status = puppy.status || (puppy.sold ? 'sold' : 'available')
  const isSold = status === 'sold'
  const isBooked = status === 'booked'
```

Replace the badges block (lines 56–57):

```jsx
          {isSold && <span className="badge-sold">Sold</span>}
          {isBooked && <span className="badge-booked">Booked</span>}
          {!isSold && !isBooked && <span className="badge-available">Available</span>}
```

The CTA block: keep `View Details` link for booked puppies (the booking buyer needs to reach the detail page to pay the balance); only `isSold` keeps the disabled button.

- [ ] **Step 3: Build check**

Run: `cd /home/marnu/chichi && npm run build`
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
cd /home/marnu && git add chichi/src/index.css chichi/src/components/PuppyCard.jsx
git commit -m "feat(chichi): booked badge on puppy cards"
```

---

### Task 7: Frontend — PuppyDetailPage purchase options

**Files:**
- Modify: `/home/marnu/chichi/src/pages/PuppyDetailPage.jsx`

**Interfaces:**
- Consumes: `POST /yoco/puppy-checkout` with `payment_option` (Task 3); success URL query `?purchased=full|deposit|balance` (legacy `true` treated as full).
- Produces: buyer-facing UI for all three payment paths.

- [ ] **Step 1: State + status derivation.** After line 30 add `payOption` state; replace `isSold` (line 78):

```jsx
  const [payOption, setPayOption] = useState('full')
```

```jsx
  const status = puppy.status || (puppy.sold ? 'sold' : 'available')
  const isSold = status === 'sold'
  const isBooked = status === 'booked'
  const isMyBooking = isBooked && buyerUser && buyerUser.id === puppy.bookedBy
  const depositAmount = Math.round(puppy.price * 0.5)
```

- [ ] **Step 2: Success/verify effect.** Replace `searchParams.get('purchased') !== 'true'` (line 33) with `!searchParams.get('purchased')`, and `successOpen` init (line 26) with:

```jsx
  const [successOpen, setSuccessOpen] = useState(!!searchParams.get('purchased'))
```

Add below it (used by the success modal copy):

```jsx
  const purchasedKind = searchParams.get('purchased') // 'full' | 'deposit' | 'balance' | 'true' (legacy)
```

- [ ] **Step 3: handlePay carries the option.** In `handlePay` body (line 102), add `payment_option: payOption` to the JSON body.

- [ ] **Step 4: Replace the CTA block** (lines 214–245) with:

```jsx
          {isSold ? (
            <div className="w-full py-4 bg-divider text-center font-body text-sm text-muted tracking-widest uppercase">This puppy has been sold</div>
          ) : isBooked && isMyBooking ? (
            <>
              <div className="w-full py-3 mb-3 bg-amber-50 border border-amber-200 text-center font-body text-xs text-amber-700 tracking-widest uppercase">Reserved for you — deposit paid</div>
              <button
                onClick={() => { setPayOption('balance'); setPayOpen(true) }}
                className="w-full py-4 bg-sienna text-cream font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna-dark transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Pay Remaining Balance · R{(puppy.price - depositAmount).toLocaleString()}
              </button>
            </>
          ) : isBooked ? (
            <div className="w-full py-4 bg-amber-50 border border-amber-200 text-center font-body text-sm text-amber-700 tracking-widest uppercase">This puppy is reserved</div>
          ) : buyerUser ? (
            <>
              <button
                onClick={() => { setPayOption('full'); setPayOpen(true) }}
                className="w-full py-4 bg-sienna text-cream font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna-dark transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Buy Now · R{puppy.price.toLocaleString()}
              </button>
              <button
                onClick={() => { setPayOption('deposit'); setPayOpen(true) }}
                className="w-full mt-3 py-4 border-2 border-sienna text-sienna font-body font-semibold text-sm tracking-widest uppercase hover:bg-sienna hover:text-cream transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Reserve · 50% Deposit · R{depositAmount.toLocaleString()}
              </button>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="font-body text-xs text-muted">🔒 Secure SA payments via Yoco</span>
              </div>
              <p className="font-body text-[11px] text-muted text-center mt-2">Pay a 50% deposit to reserve this puppy — the balance is payable here before collection.</p>
            </>
          ) : (
            <div className="border border-divider p-5 text-center space-y-3">
              <UserCircle className="w-8 h-8 text-muted mx-auto" />
              <p className="font-body text-sm text-espresso font-semibold">Create an account to purchase</p>
              <p className="font-body text-xs text-muted">A free buyer account lets you purchase puppies and track your orders.</p>
              <div className="flex gap-3 justify-center">
                <Link to="/buyer/signup" state={{ from: `/puppies/${id}` }}
                  className="btn-primary text-xs tracking-widest uppercase py-2.5 px-5">
                  Create Account
                </Link>
                <Link to="/buyer/login" state={{ from: `/puppies/${id}` }}
                  className="btn-secondary text-xs tracking-widest uppercase py-2.5 px-5">
                  Sign In
                </Link>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Payment modal shows the right amount.** In the payment modal, compute at the top of the modal JSX (just before `<form>` is fine, or inline):

```jsx
  const payAmount = payOption === 'full' ? puppy.price
    : payOption === 'deposit' ? depositAmount
    : puppy.price - depositAmount
  const payLabel = payOption === 'deposit' ? 'Pay 50% Deposit'
    : payOption === 'balance' ? 'Pay Remaining Balance' : 'Pay'
```

(Declare these with the other derived consts near `depositAmount`, since the modal lives in the same component.) Then in the modal: change the amount `<span>` (line 313) to `R{payAmount.toLocaleString()}`, the submit button text (line 335) to:

```jsx
            {loading ? 'Redirecting to Yoco...' : `${payLabel} R${payAmount.toLocaleString()} via Yoco`}
```

and the modal title to `title={payOption === 'deposit' ? 'Reserve via Yoco' : 'Purchase via Yoco'}`.

- [ ] **Step 6: Success modal copy varies.** Replace the success modal inner `<p>` (line 350) with:

```jsx
            <p className="font-body text-sm text-muted">
              {purchasedKind === 'deposit'
                ? <>Your 50% deposit for <strong className="text-espresso">{puppy.name}</strong> is confirmed — this puppy is now reserved for you. Pay the balance here anytime before collection.</>
                : <>Your purchase of <strong className="text-espresso">{puppy.name}</strong> is confirmed. The breeder will be in touch shortly.</>}
            </p>
```

And change the title of that modal to `title={purchasedKind === 'deposit' ? 'Deposit Received!' : 'Payment Successful!'}`.

- [ ] **Step 7: Build + commit**

Run: `cd /home/marnu/chichi && npm run build` — expected: success

```bash
cd /home/marnu && git add chichi/src/pages/PuppyDetailPage.jsx
git commit -m "feat(chichi): full / 50% deposit / balance purchase options on puppy page"
```

---

### Task 8: Frontend — BuyerDashboard booked section

**Files:**
- Modify: `/home/marnu/chichi/src/pages/buyer/BuyerDashboard.jsx`

**Interfaces:**
- Consumes: `/buyer/me` purchases now include `type` (`full`/`deposit`/`balance`); `puppies` from `useApp()` carry `status`.

- [ ] **Step 1: Pull puppies from context.** Change line 8 to:

```jsx
  const { buyerUser, logoutBuyer, puppies } = useApp()
```

- [ ] **Step 2: Booked banner above the purchases list.** Inside `{tab === 'purchases' && (`, before the `purchases.length === 0` ternary, add:

```jsx
            {purchases.filter(p => p.type === 'deposit' &&
              puppies.find(pp => pp.id === p.puppyId)?.status === 'booked').map(p => (
              <div key={`booked-${p.id}`} className="bg-amber-50 border border-amber-200 p-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-display text-lg font-semibold text-espresso">{p.puppyName} — Reserved</p>
                  <p className="font-body text-sm text-muted">Deposit of R{(p.amount || 0).toLocaleString()} paid · balance outstanding</p>
                </div>
                <Link to={`/puppies/${p.puppyId}`} className="btn-primary text-xs tracking-widest uppercase py-2.5 px-5">
                  Pay Balance
                </Link>
              </div>
            ))}
```

- [ ] **Step 3: Label transaction rows by type.** In the purchases map (line 99–115), replace the confirmation line (lines 110–113) with:

```jsx
                      <div className="flex items-center gap-2 mt-3">
                        <Check className="w-4 h-4 text-sage-dark" />
                        <span className="font-body text-xs text-sage-dark font-semibold">
                          {p.type === 'deposit' ? '50% deposit paid via Yoco'
                            : p.type === 'balance' ? 'Balance paid via Yoco'
                            : 'Payment confirmed via Yoco'}
                        </span>
                      </div>
```

- [ ] **Step 4: Build + commit**

Run: `cd /home/marnu/chichi && npm run build` — expected: success

```bash
cd /home/marnu && git add chichi/src/pages/buyer/BuyerDashboard.jsx
git commit -m "feat(chichi): booked puppies + pay-balance on buyer dashboard"
```

---

### Task 9: Frontend — SellerPuppies + AdminPuppies booked status & cancel

**Files:**
- Modify: `/home/marnu/chichi/src/pages/seller/SellerPuppies.jsx` (status cell ~line 588, actions ~line 592)
- Modify: `/home/marnu/chichi/src/pages/admin/AdminPuppies.jsx` (filter lines 37–49 & 77, status cell line 139, actions line 143)

**Interfaces:**
- Consumes: `POST /seller/puppies/{id}/cancel-booking`, `POST /admin/puppies/{id}/cancel-booking` (Task 5); `apiFetch` + `loadPuppies`/`loadAdminData` from AppContext.

- [ ] **Step 1: SellerPuppies.** Add `apiFetch` to the context import (line 2): `import { useApp, apiFetch } from '../../context/AppContext'`. Ensure `loadPuppies` is destructured from `useApp()` in the main component alongside its existing values.

Add a status helper next to the row render and replace the status cell (lines 587–591):

```jsx
                  <td className="px-5 py-3">
                    {(() => {
                      const st = p.status || (p.sold ? 'sold' : 'available')
                      return (
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${st === 'sold' ? 'bg-red-100 text-red-700' : st === 'booked' ? 'bg-amber-100 text-amber-700' : 'bg-sage/10 text-sage-dark'}`}>
                          {st === 'sold' ? 'Sold' : st === 'booked' ? 'Booked' : 'Active'}
                        </span>
                      )
                    })()}
                  </td>
```

In the actions cell, after the Delist button (line 611), add:

```jsx
                      {(p.status === 'booked') && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Cancel the booking for ${p.name}? The puppy will become available again. Handle any deposit refund with the buyer directly.`)) return
                            const res = await apiFetch(`/seller/puppies/${p.id}/cancel-booking`, { method: 'POST' })
                            if (res.ok) loadPuppies()
                          }}
                          className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-body text-xs transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel Booking
                        </button>
                      )}
```

(`X` is already imported in SellerPuppies.)

- [ ] **Step 2: AdminPuppies.** Replace the filter logic (lines 40–41) with:

```jsx
    const st = p.status || (p.sold ? 'sold' : 'available')
    if (filterStatus === 'Available' && st !== 'available') return false
    if (filterStatus === 'Booked' && st !== 'booked') return false
    if (filterStatus === 'Sold' && st !== 'sold') return false
```

Change the filter buttons array (line 77) to `['All', 'Available', 'Booked', 'Sold']`.

Replace the status cell (lines 138–142) with the same tri-state span pattern as SellerPuppies (booked → `bg-amber-100 text-amber-700`, label `Booked`).

In the actions cell (line 143), add before the Remove button:

```jsx
                          {(p.status === 'booked') && (
                            <button onClick={async () => {
                              if (!window.confirm(`Cancel the booking for ${p.name}?`)) return
                              const res = await apiFetch(`/admin/puppies/${p.id}/cancel-booking`, { method: 'POST' })
                              if (res.ok) loadAdminData()
                            }}
                              className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-body text-xs transition-colors">
                              Cancel Booking
                            </button>
                          )}
```

Also hide "Mark Sold" for booked puppies: change `{!p.sold && (` (line 145) to `{!p.sold && p.status !== 'booked' && (`.

- [ ] **Step 3: Build + commit**

Run: `cd /home/marnu/chichi && npm run build` — expected: success

```bash
cd /home/marnu && git add chichi/src/pages/seller/SellerPuppies.jsx chichi/src/pages/admin/AdminPuppies.jsx
git commit -m "feat(chichi): booked status + cancel booking for sellers and admin"
```

---

### Task 10: Full verification + push

- [ ] **Step 1: Backend suite**

Run: `cd /home/marnu/chichi-api && python -m pytest tests/ -q`
Expected: all PASS

- [ ] **Step 2: Frontend build**

Run: `cd /home/marnu/chichi && npm run build`
Expected: success

- [ ] **Step 3: End-to-end smoke test locally.** Start the API (`cd /home/marnu/chichi-api && DB_PATH=/tmp/claude-1000/-home-marnu/b1f66601-3bfe-4d23-ab9b-d575dbfaddcb/scratchpad/e2e.db uvicorn main:app --port 8010`), seed a kennel/puppy/buyer via sqlite or `seed.py`, then with curl:

1. `POST /yoco/webhook` (deposit metadata, with webhook verification stubbed OFF only if `YOCO_WEBHOOK_SECRET` unset — otherwise exercise `record_puppy_payment` via a tiny python snippet) → `GET /puppies/{id}` shows `status: "booked"`.
2. Balance event → `status: "sold"`, two transactions summing to the price.
3. `POST /seller/puppies/{id}/cancel-booking` with a seller token on a freshly booked puppy → `status: "available"`.

- [ ] **Step 4: Push**

```bash
cd /home/marnu && git push origin HEAD:master
```

Render redeploys chichi-api (migrations run via `create_tables` on boot); Vercel redeploys the frontend.
