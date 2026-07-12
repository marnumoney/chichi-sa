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
