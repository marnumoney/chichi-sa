from auth import hash_password, verify_password, create_token, decode_token


def test_hash_and_verify_password():
    hashed = hash_password('mysecret')
    assert hashed != 'mysecret'
    assert verify_password('mysecret', hashed)
    assert not verify_password('wrongpassword', hashed)


def test_create_and_decode_token():
    payload = {'role': 'admin', 'email': 'admin@test.co.za'}
    token = create_token(payload)
    decoded = decode_token(token)
    assert decoded['role'] == 'admin'
    assert decoded['email'] == 'admin@test.co.za'


def test_decode_token_invalid_raises():
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        decode_token('not.a.valid.token')
    assert exc.value.status_code == 401
