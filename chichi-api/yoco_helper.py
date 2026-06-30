import hashlib
import hmac
import os

import httpx

YOCO_SECRET_KEY = os.getenv('YOCO_SECRET_KEY', '')
YOCO_WEBHOOK_SECRET = os.getenv('YOCO_WEBHOOK_SECRET', '')
YOCO_CHECKOUT_URL = 'https://payments.yoco.com/api/checkouts'
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://chihuahuasouthafrica.com')
BACKEND_URL = os.getenv('BACKEND_URL', 'https://chichi-api-7k6y.onrender.com')


async def create_checkout(amount_cents: int, metadata: dict, success_url: str, cancel_url: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            YOCO_CHECKOUT_URL,
            json={
                'amount': amount_cents,
                'currency': 'ZAR',
                'successUrl': success_url,
                'cancelUrl': cancel_url,
                'metadata': metadata,
            },
            headers={
                'Authorization': f'Bearer {YOCO_SECRET_KEY}',
                'Content-Type': 'application/json',
            },
            timeout=15,
        )
        res.raise_for_status()
        return res.json()


def verify_webhook(raw_body: bytes, signature: str) -> bool:
    if not YOCO_WEBHOOK_SECRET:
        return True
    expected = hmac.new(YOCO_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
