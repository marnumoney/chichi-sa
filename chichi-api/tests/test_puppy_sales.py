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


def test_invalid_payment_option_is_noop(sales_db):
    assert record_puppy_payment(sales_db, 'p1', 'refund', 'B', 'b@t.co', 'b1') is None
    assert _txns(sales_db) == []


def test_out_of_sync_row_rejects_deposit(sales_db):
    # Legacy code path left the puppy sold=1 while status is still 'available'.
    sales_db.execute("UPDATE puppies SET sold = 1 WHERE id = 'p1'")
    sales_db.commit()
    assert record_puppy_payment(sales_db, 'p1', 'deposit', 'B', 'b@t.co', 'b1') is None
    assert _txns(sales_db) == []


def test_kennel_missing_fallback(sales_db):
    sales_db.execute("UPDATE puppies SET kennel_id = 'nope' WHERE id = 'p1'")
    sales_db.commit()
    txn = record_puppy_payment(sales_db, 'p1', 'full', 'B', 'b@t.co', 'b1')
    assert txn is not None
    t = _txns(sales_db)[0]
    assert t['commission'] == round(10000.0 * 0.08, 2)
    assert t['kennel_name'] == ''


def test_odd_price_rounding_sums_to_exact_price(sales_db):
    sales_db.execute("UPDATE puppies SET price = 99.99 WHERE id = 'p1'")
    sales_db.commit()
    record_puppy_payment(sales_db, 'p1', 'deposit', 'B', 'b@t.co', 'b1')
    record_puppy_payment(sales_db, 'p1', 'balance', 'B', 'b@t.co', 'b1')
    txns = _txns(sales_db)
    assert round(sum(t['amount'] for t in txns), 2) == 99.99
    p = _puppy(sales_db)
    assert p['status'] == 'sold' and p['sold'] == 1


def test_puppy_status_derivation():
    assert puppy_status({'status': 'booked', 'sold': 0}) == 'booked'
    assert puppy_status({'status': None, 'sold': 1}) == 'sold'
    assert puppy_status({'status': '', 'sold': 0}) == 'available'
