import hashlib
import urllib.parse
import uuid
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse

from database import get_db
from payfast_helper import (BACKEND_URL, FRONTEND_URL, PASSPHRASE,
                             PAYFAST_URL, PAYFAST_VALIDATE_URL, build_payment_fields)

router = APIRouter()


def _verify_signature(data: dict) -> bool:
    sig = data.pop('signature', None)
    params = {k: str(v) for k, v in sorted(data.items()) if str(v) != ''}
    query = '&'.join(f'{k}={urllib.parse.quote_plus(v)}' for k, v in params.items())
    if PASSPHRASE:
        query += f'&passphrase={urllib.parse.quote_plus(PASSPHRASE)}'
    return hashlib.md5(query.encode()).hexdigest() == sig


async def _validate_with_payfast(raw_form: dict) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                PAYFAST_VALIDATE_URL,
                data=raw_form,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10,
            )
        return res.text.strip() == 'VALID'
    except Exception:
        return False


# ── Checkout ──────────────────────────────────────────────────────────────────

@router.post('/payfast/puppy-checkout')
async def puppy_checkout(body: dict, db=Depends(get_db)):
    puppy_id = body.get('puppy_id', '')
    buyer_name = body.get('buyer_name', '').strip()
    buyer_email = body.get('buyer_email', '').strip()
    buyer_id = body.get('buyer_id', '')

    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not puppy:
        return {'error': 'Puppy not found'}, 404
    puppy = dict(puppy)
    if puppy['sold']:
        return {'error': 'Already sold'}, 409

    parts = buyer_name.split(' ', 1)
    fields = build_payment_fields({
        'return_url': f'{FRONTEND_URL}/puppies/{puppy_id}?purchased=true',
        'cancel_url': f'{FRONTEND_URL}/puppies/{puppy_id}',
        'notify_url': f'{BACKEND_URL}/payfast/notify',
        'name_first': parts[0],
        'name_last': parts[1] if len(parts) > 1 else '',
        'email_address': buyer_email,
        'm_payment_id': f'puppy_{puppy_id}_{uuid.uuid4().hex[:6]}',
        'amount': f"{puppy['price']:.2f}",
        'item_name': f"{puppy['name']} — Chihuahua",
        'custom_str1': puppy_id,
        'custom_str2': buyer_name,
        'custom_str3': buyer_email,
        'custom_str4': buyer_id,
    })
    return {'payfast_url': PAYFAST_URL, **fields}


@router.post('/payfast/membership-checkout')
async def membership_checkout(body: dict, db=Depends(get_db)):
    seller_id = body.get('seller_id', '')

    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        return {'error': 'Seller not found'}, 404
    seller = dict(seller)

    settings = db.execute('SELECT membership_fee_annual FROM admin_settings WHERE id = 1').fetchone()
    fee = dict(settings)['membership_fee_annual'] if settings else 1200.0

    fields = build_payment_fields({
        'return_url': f'{FRONTEND_URL}/pay/membership?paid=true&seller={seller_id}',
        'cancel_url': f'{FRONTEND_URL}/pay/membership?seller={seller_id}',
        'notify_url': f'{BACKEND_URL}/payfast/membership-notify',
        'email_address': seller['email'],
        'm_payment_id': f'membership_{seller_id}_{uuid.uuid4().hex[:6]}',
        'amount': f'{fee:.2f}',
        'item_name': 'Chihuahua South Africa Annual Membership',
        'custom_str1': seller_id,
    })
    return {'payfast_url': PAYFAST_URL, **fields}


# ── ITN Webhooks ──────────────────────────────────────────────────────────────

@router.post('/payfast/notify')
async def payfast_notify(request: Request, db=Depends(get_db)):
    form = dict(await request.form())

    if not _verify_signature(dict(form)) or not await _validate_with_payfast(dict(form)):
        return PlainTextResponse('Invalid', status_code=400)

    if form.get('payment_status') != 'COMPLETE':
        return PlainTextResponse('OK')

    puppy_id = form.get('custom_str1', '')
    buyer_name = form.get('custom_str2', '')
    buyer_email = form.get('custom_str3', '')
    buyer_id = form.get('custom_str4', '')

    puppy = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not puppy or dict(puppy)['sold']:
        return PlainTextResponse('OK')
    puppy = dict(puppy)

    kennel = db.execute('SELECT * FROM kennels WHERE id = ?', (puppy['kennel_id'],)).fetchone()
    rate = dict(kennel)['commission'] if kennel else 8.0
    commission = round(puppy['price'] * rate / 100, 2)
    seller_payout = round(puppy['price'] - commission, 2)

    txn_id = f'txn{uuid.uuid4().hex[:8]}'
    db.execute("""
        INSERT INTO transactions
        (id, puppy_id, puppy_name, kennel_id, kennel_name, buyer_name, buyer_email,
         amount, commission, seller_payout, seller_paid, commission_paid, date, buyer_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?)
    """, (
        txn_id, puppy['id'], puppy['name'],
        puppy['kennel_id'], dict(kennel)['name'] if kennel else '',
        buyer_name, buyer_email,
        puppy['price'], commission, seller_payout, date.today().isoformat(), buyer_id,
    ))
    db.execute('UPDATE puppies SET sold = 1 WHERE id = ?', (puppy_id,))
    db.commit()
    return PlainTextResponse('OK')


@router.post('/payfast/membership-notify')
async def membership_notify(request: Request, db=Depends(get_db)):
    form = dict(await request.form())

    if not _verify_signature(dict(form)) or not await _validate_with_payfast(dict(form)):
        return PlainTextResponse('Invalid', status_code=400)

    if form.get('payment_status') != 'COMPLETE':
        return PlainTextResponse('OK')

    seller_id = form.get('custom_str1', '')
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
    return PlainTextResponse('OK')
