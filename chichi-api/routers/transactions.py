import sqlite3
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from database import get_db, parse_transaction
from models import PurchaseRequest

router = APIRouter()


@router.post('/transactions', status_code=201)
def purchase_puppy(body: PurchaseRequest, db: sqlite3.Connection = Depends(get_db)):
    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (body.puppy_id,)).fetchone()
    if not puppy:
        raise HTTPException(status_code=404, detail='Puppy not found')
    puppy = dict(puppy)
    if puppy['sold']:
        raise HTTPException(status_code=409, detail='Puppy already sold')

    kennel = db.execute('SELECT * FROM kennels WHERE id = ?', (puppy['kennel_id'],)).fetchone()
    rate = dict(kennel)['commission'] if kennel else 8.0
    commission = round(puppy['price'] * rate / 100, 2)
    seller_payout = round(puppy['price'] - commission, 2)

    txn_id = f'txn{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date, buyer_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?)
    """, (
        txn_id, puppy['id'], puppy['name'],
        puppy['kennel_id'], dict(kennel)['name'] if kennel else '',
        body.buyer_name, body.buyer_email,
        puppy['price'], commission, seller_payout, today, body.buyer_id or '',
    ))
    db.execute('UPDATE puppies SET sold = 1 WHERE id = ?', (body.puppy_id,))
    db.commit()

    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    return parse_transaction(row)
