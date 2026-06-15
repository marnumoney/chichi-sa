import hashlib
import os
import urllib.parse

PAYFAST_URL = 'https://www.payfast.co.za/eng/process'
MERCHANT_ID = os.getenv('PAYFAST_MERCHANT_ID', '')
MERCHANT_KEY = os.getenv('PAYFAST_MERCHANT_KEY', '')
PASSPHRASE = os.getenv('PAYFAST_PASSPHRASE', '')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://chihuahuasouthafrica.com')
BACKEND_URL = os.getenv('BACKEND_URL', 'https://chichi-api-7k6y.onrender.com')


def build_signature(data: dict) -> str:
    params = {k: str(v) for k, v in sorted(data.items()) if k != 'signature' and str(v) != ''}
    query = '&'.join(f'{k}={urllib.parse.quote_plus(v)}' for k, v in params.items())
    if PASSPHRASE:
        query += f'&passphrase={urllib.parse.quote_plus(PASSPHRASE)}'
    return hashlib.md5(query.encode()).hexdigest()


def build_payment_fields(extra: dict) -> dict:
    data = {'merchant_id': MERCHANT_ID, 'merchant_key': MERCHANT_KEY, **extra}
    data['signature'] = build_signature(data)
    return data
