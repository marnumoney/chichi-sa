import os
import sqlite3
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, parse_puppy
from models import TestimonialCreate

router = APIRouter()


@router.get('/kennels')
def list_kennels(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM kennels WHERE status = 'approved' ORDER BY name"
    ).fetchall()
    return [dict(r) for r in rows]


@router.get('/kennels/{slug}')
def get_kennel(slug: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM kennels WHERE slug = ?', (slug,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Kennel not found')
    kennel = dict(row)
    puppy_rows = db.execute(
        "SELECT * FROM puppies WHERE kennel_id = ? AND sold = 0", (kennel['id'],)
    ).fetchall()
    return {'kennel': kennel, 'puppies': [parse_puppy(p) for p in puppy_rows]}


@router.get('/puppies')
def list_puppies(
    coat: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    sold: Optional[str] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
):
    query = 'SELECT * FROM puppies WHERE 1=1'
    params: list = []
    if coat:
        query += ' AND coat_type = ?'
        params.append(coat)
    if gender:
        query += ' AND gender = ?'
        params.append(gender)
    if sold is not None:
        query += ' AND sold = ?'
        params.append(1 if sold.lower() == 'true' else 0)
    rows = db.execute(query, params).fetchall()
    return [parse_puppy(r) for r in rows]


@router.get('/puppies/{puppy_id}')
def get_puppy(puppy_id: str, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT * FROM puppies WHERE id = ?', (puppy_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Puppy not found')
    return parse_puppy(row)


@router.get('/testimonials')
def list_testimonials(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute('SELECT * FROM testimonials ORDER BY date DESC').fetchall()
    return [dict(r) for r in rows]


@router.post('/testimonials', status_code=201)
def submit_testimonial(body: TestimonialCreate, db: sqlite3.Connection = Depends(get_db)):
    tid = f't{uuid.uuid4().hex[:8]}'
    db.execute(
        'INSERT INTO testimonials (id, kennel_id, buyer_name, buyer_email, stars, text, date) VALUES (?,?,?,?,?,?,?)',
        (tid, body.kennel_id, body.buyer_name, body.buyer_email or '', body.stars, body.text, date.today().isoformat())
    )
    db.commit()
    return dict(db.execute('SELECT * FROM testimonials WHERE id = ?', (tid,)).fetchone())


@router.get('/legal')
def get_legal(db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT content FROM legal_text WHERE id = 1').fetchone()
    return {'content': row['content'] if row else ''}


@router.get('/buyer-protection')
def get_buyer_protection(db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT content FROM buyer_protection WHERE id = 1').fetchone()
    return {'content': row['content'] if row else ''}


@router.get('/terms')
def get_terms(db: sqlite3.Connection = Depends(get_db)):
    row = db.execute('SELECT content FROM terms_content WHERE id = 1').fetchone()
    return {'content': row['content'] if row else ''}


def _send_contact_email(name: str, email: str, subject: str, message: str):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    smtp_user = os.getenv('SMTP_USER', 'chihuahuasouthafrica@gmail.com')
    smtp_pass = os.getenv('SMTP_PASSWORD', '')
    if not smtp_pass:
        print(f'[email] SMTP_PASSWORD not set — contact from {email}: {subject}')
        return
    msg = MIMEMultipart()
    msg['From'] = f'Chihuahua South Africa <{smtp_user}>'
    msg['To'] = smtp_user
    msg['Reply-To'] = email
    msg['Subject'] = f'ChiSA Enquiry — {subject}'
    msg.attach(MIMEText(f'From: {name} <{email}>\n\nSubject: {subject}\n\n{message}', 'plain'))
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f'[email] Contact form email received from {email}')
    except Exception as e:
        print(f'[email] Failed to send contact email: {e}')


@router.post('/contact')
def submit_contact(body: dict):
    name = (body.get('name') or '').strip()
    email = (body.get('email') or '').strip()
    subject = (body.get('subject') or '').strip()
    message = (body.get('message') or '').strip()
    if not name or not email or not subject or not message:
        raise HTTPException(status_code=400, detail='All fields are required')
    _send_contact_email(name, email, subject, message)
    return {'ok': True}


@router.get('/sellers/{seller_id}/payment-info')
def get_seller_payment_info(seller_id: str, db: sqlite3.Connection = Depends(get_db)):
    """Returns minimal public info needed to render the membership payment page."""
    seller = db.execute(
        'SELECT id, name, kennel_id, status FROM sellers WHERE id = ?', (seller_id,)
    ).fetchone()
    if not seller:
        raise HTTPException(status_code=404, detail='Seller not found')
    seller = dict(seller)
    kennel = None
    if seller.get('kennel_id'):
        row = db.execute('SELECT * FROM kennels WHERE id = ?', (seller['kennel_id'],)).fetchone()
        if row:
            kennel = dict(row)
    settings = db.execute('SELECT membership_fee_annual, default_commission FROM admin_settings WHERE id = 1').fetchone()
    fee = dict(settings)['membership_fee_annual'] if settings else 1200.0
    commission = dict(settings)['default_commission'] if settings else 8.0
    return {'seller': seller, 'kennel': kennel, 'membership_fee': fee, 'default_commission': commission}
