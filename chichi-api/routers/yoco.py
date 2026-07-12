import json
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse

from database import get_db
from puppy_sales import puppy_status, record_puppy_payment
from yoco_helper import FRONTEND_URL, BACKEND_URL, YOCO_SECRET_KEY, create_checkout, verify_webhook

router = APIRouter()


@router.post('/yoco/membership-checkout')
async def yoco_membership_checkout(body: dict, db=Depends(get_db)):
    seller_id = body.get('seller_id', '')

    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')

    settings = db.execute('SELECT membership_fee_annual FROM admin_settings WHERE id = 1').fetchone()
    fee = dict(settings)['membership_fee_annual'] if settings else 200.0
    amount_cents = int(fee * 100)

    try:
        session = await create_checkout(
            amount_cents=amount_cents,
            metadata={'seller_id': seller_id, 'type': 'membership'},
            success_url=f'{FRONTEND_URL}/pay/membership?paid=true&seller={seller_id}',
            cancel_url=f'{FRONTEND_URL}/pay/membership?seller={seller_id}',
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail='Payment provider error')

    return {'redirect_url': session['redirectUrl'], 'checkout_id': session['id']}


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
        if amount <= 0:
            raise HTTPException(status_code=409, detail='No balance outstanding')
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


@router.post('/yoco/webhook')
async def yoco_webhook(request: Request, db=Depends(get_db)):
    raw_body = await request.body()
    signature = request.headers.get('x-yoco-signature', '')

    if not verify_webhook(raw_body, signature):
        return PlainTextResponse('Invalid', status_code=400)

    event = json.loads(raw_body)
    event_type = event.get('type', '')
    if event_type not in ('payment.succeeded', 'checkout.completed'):
        return PlainTextResponse('OK')

    payload = event.get('payload', {})
    metadata = payload.get('metadata', {})
    payment_type = metadata.get('type')

    if payment_type == 'membership':
        seller_id = metadata.get('seller_id', '')
        seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
        if not seller:
            return PlainTextResponse('OK')
        seller = dict(seller)

        expiry = (date.today() + timedelta(days=365)).isoformat()
        db.execute("UPDATE sellers SET status = 'approved' WHERE id = ?", (seller_id,))
        if seller.get('kennel_id'):
            db.execute("""
                UPDATE kennels SET status = 'approved', membership_status = 'active',
                membership_expiry = ? WHERE id = ?
            """, (expiry, seller['kennel_id']))
        db.commit()

    elif payment_type == 'puppy':
        record_puppy_payment(
            db,
            metadata.get('puppy_id', ''),
            metadata.get('payment_option', 'full'),
            metadata.get('buyer_name', ''),
            metadata.get('buyer_email', ''),
            metadata.get('buyer_id', ''),
        )

    return PlainTextResponse('OK')


@router.post('/yoco/verify-membership')
async def verify_membership(body: dict, db=Depends(get_db)):
    checkout_id = body.get('checkout_id', '')
    seller_id = body.get('seller_id', '')

    if not checkout_id or not seller_id:
        raise HTTPException(status_code=400, detail='Missing parameters')

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f'https://payments.yoco.com/api/checkouts/{checkout_id}',
            headers={'Authorization': f'Bearer {YOCO_SECRET_KEY}'},
            timeout=10,
        )

    if not res.is_success:
        raise HTTPException(status_code=400, detail='Could not verify payment')

    checkout = res.json()
    status = checkout.get('status', '')
    if status not in ('succeeded', 'success', 'complete'):
        raise HTTPException(status_code=400, detail='Payment not complete')

    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)

    if seller.get('status') == 'approved':
        return {'ok': True}

    expiry = (date.today() + timedelta(days=365)).isoformat()
    db.execute("UPDATE sellers SET status = 'approved' WHERE id = ?", (seller_id,))
    if seller.get('kennel_id'):
        db.execute("""
            UPDATE kennels SET status = 'approved', membership_status = 'active',
            membership_expiry = ? WHERE id = ?
        """, (expiry, seller['kennel_id']))
    db.commit()
    return {'ok': True}


@router.post('/yoco/verify-puppy')
async def verify_puppy(body: dict, db=Depends(get_db)):
    checkout_id = body.get('checkout_id', '')
    puppy_id = body.get('puppy_id', '')
    buyer_id = body.get('buyer_id', '')
    buyer_name = body.get('buyer_name', '')
    buyer_email = body.get('buyer_email', '')

    if not checkout_id or not puppy_id:
        raise HTTPException(status_code=400, detail='Missing parameters')

    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not puppy:
        raise HTTPException(status_code=404, detail='Puppy not found')
    puppy = dict(puppy)

    if puppy.get('sold'):
        return {'ok': True}  # settled — record_puppy_payment would no-op anyway

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f'https://payments.yoco.com/api/checkouts/{checkout_id}',
                headers={'Authorization': f'Bearer {YOCO_SECRET_KEY}'},
                timeout=10,
            )
        if not res.is_success:
            print(f'[verify-puppy] Yoco API {res.status_code} for {checkout_id}: {res.text[:300]}')
            raise HTTPException(status_code=502, detail='Could not verify payment')

        checkout = res.json()
        status = checkout.get('status', '')
        print(f'[verify-puppy] checkout {checkout_id} status={status!r}')

        # Only reject statuses that explicitly mean payment did NOT happen
        if status in ('created', 'cancelled', 'failed', 'expired'):
            raise HTTPException(status_code=400, detail='Payment not complete')

        # Yoco checkout metadata (bound at checkout creation) is authoritative —
        # it wins over client-supplied body values, which are untrusted.
        metadata = checkout.get('metadata', {})
        buyer_name = metadata.get('buyer_name', '') or buyer_name
        buyer_email = metadata.get('buyer_email', '') or buyer_email
        buyer_id = metadata.get('buyer_id', '') or buyer_id
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
