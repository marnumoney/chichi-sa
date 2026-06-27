import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from database import get_db

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post('/certs/upload', status_code=201)
async def upload_cert(file: UploadFile = File(...), db=Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail='File too large (max 10 MB)')
    cert_id = uuid.uuid4().hex
    content_type = file.content_type or 'application/octet-stream'
    filename = file.filename or 'document'
    db.execute(
        'INSERT INTO certs (id, filename, content_type, data) VALUES (?, ?, ?, ?)',
        (cert_id, filename, content_type, data),
    )
    db.commit()
    return {'url': f'/certs/{cert_id}'}


@router.get('/certs/{cert_id}')
def serve_cert(cert_id: str, db=Depends(get_db)):
    row = db.execute('SELECT * FROM certs WHERE id = ?', (cert_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Certificate not found')
    row = dict(row)
    content = bytes(row['data'])
    return Response(
        content=content,
        media_type=row['content_type'],
        headers={
            'Content-Disposition': f'inline; filename="{row["filename"]}"',
            'Cache-Control': 'max-age=31536000',
        },
    )
