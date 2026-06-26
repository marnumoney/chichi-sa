import os
import random
import re
import sqlite3
import uuid
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from payfast_helper import FRONTEND_URL

from auth import get_current_admin, hash_password
from database import get_db, parse_puppy, parse_seller, parse_transaction
from models import (KennelCreate, KennelUpdate, LegalUpdate, SellerCreate,
                    SellerUpdate, SettingsUpdate, TestimonialCreate)

router = APIRouter()

_PALETTE = ['#B5651D', '#4A7C59', '#C49A1D', '#7C5C4A', '#2A1F14', '#6B4A7C']


class BroadcastRequest(BaseModel):
    subject: str
    message: str
    seller_ids: List[str]


def _send_email(to: str, name: str, subject: str, body_text: str):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    smtp_user = os.getenv('SMTP_USER', 'chihuahuasouthafrica@gmail.com')
    smtp_pass = os.getenv('SMTP_PASSWORD', '')
    if not smtp_pass:
        print(f'[email] SMTP_PASSWORD not set — skipping email to {to}')
        return
    msg = MIMEMultipart()
    msg['From'] = f'Chihuahua South Africa <{smtp_user}>'
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(body_text, 'plain'))
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f'[email] Sent to {to}')
    except Exception as e:
        print(f'[email] Failed to send to {to}: {e}')


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


# ── Kennels ──────────────────────────────────────────────────────────────────

@router.get('/kennels')
def admin_list_kennels(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM kennels ORDER BY name').fetchall()
    return [dict(r) for r in rows]


@router.post('/kennels', status_code=201)
def admin_add_kennel(
    body: KennelCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    kennel_id = f'k{uuid.uuid4().hex[:8]}'
    expiry = (date.today() + timedelta(days=365)).isoformat()
    base_slug = body.slug or _slugify(body.name)
    slug = base_slug
    suffix = 1
    while db.execute('SELECT id FROM kennels WHERE slug = ?', (slug,)).fetchone():
        slug = f'{base_slug}-{suffix}'
        suffix += 1
    db.execute("""
        INSERT INTO kennels
        (id, name, slug, registry, initials, color, description, location,
         contact, phone, membership_status, membership_expiry, commission,
         status, referral_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,'active',?,?,'approved',?)
    """, (
        kennel_id, body.name, slug, body.registry,
        body.initials or body.name[:3].upper(), body.color,
        body.description, body.location, body.contact, body.phone,
        expiry, body.commission, body.referral_code,
    ))
    db.commit()
    return dict(db.execute('SELECT * FROM kennels WHERE id = ?', (kennel_id,)).fetchone())


@router.put('/kennels/{kennel_id}')
def admin_edit_kennel(
    kennel_id: str,
    body: KennelUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT id FROM kennels WHERE id = ?', (kennel_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Kennel not found')
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE kennels SET {cols} WHERE id = ?', [*updates.values(), kennel_id])
    db.commit()
    return dict(db.execute('SELECT * FROM kennels WHERE id = ?', (kennel_id,)).fetchone())


@router.delete('/kennels/{kennel_id}')
def admin_delete_kennel(
    kennel_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM puppies WHERE kennel_id = ?', (kennel_id,))
    db.execute('UPDATE sellers SET kennel_id = NULL, status = ? WHERE kennel_id = ?',
               ('pending_verification', kennel_id))
    db.execute('DELETE FROM kennels WHERE id = ?', (kennel_id,))
    db.commit()
    return {'ok': True}


# ── Sellers ───────────────────────────────────────────────────────────────────

@router.get('/sellers')
def admin_list_sellers(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM sellers ORDER BY joined_date DESC').fetchall()
    return [parse_seller(r) for r in rows]


@router.post('/sellers', status_code=201)
def admin_add_seller(
    body: SellerCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller_id = f's{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute("""
        INSERT INTO sellers (id, email, password_hash, name, kennel_id, status, joined_date)
        VALUES (?,?,?,?,?,'pending_verification',?)
    """, (seller_id, body.email, hash_password(body.password), body.name, body.kennel_id, today))
    db.commit()
    row = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    row.pop('password_hash')
    return row


@router.put('/sellers/{seller_id}')
def admin_edit_seller(
    seller_id: str,
    body: SellerUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT id FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Seller not found')
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE sellers SET {cols} WHERE id = ?', [*updates.values(), seller_id])
    db.commit()
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.put('/sellers/{seller_id}/reset-password')
def admin_reset_seller_password(
    seller_id: str,
    body: dict,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    new_password = body.get('password', '')
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters')
    db.execute('UPDATE sellers SET password_hash = ? WHERE id = ?', (hash_password(new_password), seller_id))
    db.commit()
    return {'ok': True}


@router.delete('/sellers/{seller_id}')
def admin_delete_seller(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM sellers WHERE id = ?', (seller_id,))
    db.commit()
    return {'ok': True}


@router.patch('/sellers/{seller_id}/approve')
def admin_approve_seller(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    kennel_id = f'k{uuid.uuid4().hex[:8]}'
    color = random.choice(_PALETTE)
    kennel_name = seller.get('kennel_name') or f"{seller['name']}'s Kennel"
    registry = seller.get('registry') or 'KUSA'
    db.execute("""
        INSERT INTO kennels
        (id, name, slug, registry, initials, color, membership_status, commission, status)
        VALUES (?,?,?,?,?,?,'pending_payment',8.0,'pending')
    """, (
        kennel_id,
        kennel_name,
        f"kennel-{kennel_id}",
        registry,
        ''.join(w[0].upper() for w in kennel_name.split()[:3]),
        color,
    ))
    db.execute(
        "UPDATE sellers SET status = 'pending_payment', kennel_id = ? WHERE id = ?",
        (kennel_id, seller_id)
    )
    db.commit()

    payment_link = f'{FRONTEND_URL}/pay/membership?seller={seller_id}'
    _send_email(
        seller['email'],
        seller.get('name') or 'Breeder',
        'Your Chihuahua SA application has been approved — payment required',
        (
            f"Hi {seller.get('name') or 'Breeder'},\n\n"
            f"Your application for {kennel_name} ({registry}) has been approved by our admin team.\n\n"
            f"To activate your seller account and start listing puppies, please complete your annual membership payment:\n\n"
            f"{payment_link}\n\n"
            f"Once payment is confirmed your portal will be activated automatically.\n\n"
            f"— Chihuahua South Africa"
        ),
    )

    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.patch('/sellers/{seller_id}/reject')
def admin_reject_seller(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    db.execute("UPDATE sellers SET status = 'rejected' WHERE id = ?", (seller_id,))
    db.commit()
    _send_email(
        seller['email'],
        seller.get('name') or 'Breeder',
        'Your Chihuahua SA application — update',
        (
            f"Hi {seller.get('name') or 'Breeder'},\n\n"
            f"Thank you for applying to list your kennel on Chihuahua South Africa.\n\n"
            f"After reviewing your application, we are unable to approve it at this time.\n\n"
            f"If you believe this was an error or would like to provide additional information, "
            f"please contact us at chihuahuasouthafrica@gmail.com.\n\n"
            f"— Chihuahua South Africa"
        ),
    )
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.post('/sellers/{seller_id}/send-payment-email')
def admin_send_payment_email(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    kennel = None
    if seller.get('kennel_id'):
        k = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if k:
            kennel = dict(k)
    kennel_name = (kennel or {}).get('name') or seller.get('kennel_name') or f"{seller['name']}'s Kennel"
    registry = (kennel or {}).get('registry') or seller.get('registry') or 'KUSA'
    payment_link = f'{FRONTEND_URL}/pay/membership?seller={seller_id}'
    _send_email(
        seller['email'],
        seller.get('name') or 'Breeder',
        'Your Chihuahua SA account is approved — complete your payment',
        (
            f"Hi {seller.get('name') or 'Breeder'},\n\n"
            f"Your application for {kennel_name} ({registry}) has been approved!\n\n"
            f"To activate your seller account and start listing puppies, please complete your annual membership payment:\n\n"
            f"{payment_link}\n\n"
            f"Once payment is confirmed your portal will be activated automatically.\n\n"
            f"— Chihuahua South Africa"
        ),
    )
    return {'ok': True, 'email': seller['email'], 'payment_link': payment_link}


@router.patch('/sellers/{seller_id}/pay-membership')
def admin_pay_membership(
    seller_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    seller = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    expiry = (date.today() + timedelta(days=365)).isoformat()
    db.execute("UPDATE sellers SET status = 'approved' WHERE id = ?", (seller_id,))
    if seller.get('kennel_id'):
        db.execute("""
            UPDATE kennels SET status = 'approved', membership_status = 'active',
            membership_expiry = ? WHERE id = ?
        """, (expiry, seller['kennel_id']))
    db.commit()
    result = dict(db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone())
    result.pop('password_hash')
    return result


@router.post('/broadcast')
def admin_broadcast(
    body: BroadcastRequest,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    sent = 0
    for seller_id in body.seller_ids:
        row = db.execute('SELECT * FROM sellers WHERE id = ?', (seller_id,)).fetchone()
        if not row:
            continue
        seller = dict(row)
        _send_email(seller['email'], seller.get('name') or 'Breeder', body.subject, body.message)
        sent += 1
    return {'ok': True, 'sent': sent}


# ── Puppies ───────────────────────────────────────────────────────────────────

@router.get('/puppies')
def admin_list_puppies(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM puppies ORDER BY name').fetchall()
    return [parse_puppy(r) for r in rows]


@router.delete('/puppies/{puppy_id}')
def admin_delete_puppy(
    puppy_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM puppies WHERE id = ?', (puppy_id,))
    db.commit()
    return {'ok': True}


# ── Testimonials ──────────────────────────────────────────────────────────────

@router.get('/testimonials')
def admin_list_testimonials(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM testimonials ORDER BY date DESC').fetchall()
    return [dict(r) for r in rows]


@router.post('/testimonials', status_code=201)
def admin_add_testimonial(
    body: TestimonialCreate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    tid = f't{uuid.uuid4().hex[:8]}'
    today = date.today().isoformat()
    db.execute(
        'INSERT INTO testimonials (id, kennel_id, buyer_name, stars, text, date) VALUES (?,?,?,?,?,?)',
        (tid, body.kennel_id, body.buyer_name, body.stars, body.text, today)
    )
    db.commit()
    return dict(db.execute('SELECT * FROM testimonials WHERE id = ?', (tid,)).fetchone())


@router.delete('/testimonials/{testimonial_id}')
def admin_delete_testimonial(
    testimonial_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM testimonials WHERE id = ?', (testimonial_id,))
    db.commit()
    return {'ok': True}


# ── Clear all data ───────────────────────────────────────────────────────────

@router.delete('/clear-all-data')
def admin_clear_all_data(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('DELETE FROM transactions')
    db.execute('DELETE FROM testimonials')
    db.execute('DELETE FROM puppies')
    db.execute('DELETE FROM sellers')
    db.execute('DELETE FROM kennels')
    db.commit()
    return {'ok': True, 'message': 'All kennels, puppies, sellers, transactions and testimonials deleted.'}


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get('/settings')
def admin_get_settings(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM admin_settings WHERE id = 1').fetchone()
    return dict(row)


@router.put('/settings')
def admin_update_settings(
    body: SettingsUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    cols = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE admin_settings SET {cols} WHERE id = 1', list(updates.values()))
    db.commit()
    return dict(db.execute('SELECT * FROM admin_settings WHERE id = 1').fetchone())


# ── Legal ─────────────────────────────────────────────────────────────────────

@router.get('/legal')
def admin_get_legal(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute('SELECT * FROM legal_text WHERE id = 1').fetchone()
    return dict(row)


@router.put('/legal')
def admin_update_legal(
    body: LegalUpdate,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute('UPDATE legal_text SET content = ? WHERE id = 1', (body.content,))
    db.commit()
    return dict(db.execute('SELECT * FROM legal_text WHERE id = 1').fetchone())


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get('/transactions')
def admin_list_transactions(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM transactions ORDER BY date DESC').fetchall()
    return [parse_transaction(r) for r in rows]


@router.post('/transactions/{txn_id}/release')
def admin_release_transaction(
    txn_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Mark both seller payout and commission as paid in one action."""
    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found')
    today = date.today().isoformat()
    db.execute("""
        UPDATE transactions
        SET seller_paid = 1, commission_paid = 1,
            seller_paid_date = ?, commission_paid_date = ?
        WHERE id = ?
    """, (today, today, txn_id))
    db.commit()
    return parse_transaction(db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone())


@router.post('/transactions/{txn_id}/mark-seller-paid')
def admin_mark_seller_paid(
    txn_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Mark only the seller payout as transferred."""
    today = date.today().isoformat()
    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found')
    db.execute(
        'UPDATE transactions SET seller_paid = 1, seller_paid_date = ? WHERE id = ?',
        (today, txn_id)
    )
    db.commit()
    return parse_transaction(db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone())


@router.post('/transactions/{txn_id}/mark-commission-paid')
def admin_mark_commission_paid(
    txn_id: str,
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Mark only the admin commission as collected."""
    today = date.today().isoformat()
    row = db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Transaction not found')
    db.execute(
        'UPDATE transactions SET commission_paid = 1, commission_paid_date = ? WHERE id = ?',
        (today, txn_id)
    )
    db.commit()
    return parse_transaction(db.execute('SELECT * FROM transactions WHERE id = ?', (txn_id,)).fetchone())


@router.get('/buyers')
def admin_list_buyers(
    _: dict = Depends(get_current_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute('SELECT * FROM buyers ORDER BY joined_date DESC').fetchall()
    buyers = []
    for row in rows:
        b = dict(row)
        b.pop('password_hash', None)
        purchase_count = db.execute(
            'SELECT COUNT(*) as cnt FROM transactions WHERE buyer_id = ?', (b['id'],)
        ).fetchone()
        b['purchase_count'] = dict(purchase_count)['cnt'] if purchase_count else 0
        buyers.append(b)
    return buyers
