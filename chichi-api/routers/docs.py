import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from database import get_db

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post('/upload-doc', status_code=201)
async def upload_doc(
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail='File too large (max 10MB)')
    doc_id = uuid.uuid4().hex
    content_type = file.content_type or 'application/octet-stream'
    filename = file.filename or 'document'
    db.execute(
        'INSERT INTO doc_uploads (id, filename, content_type, data) VALUES (?, ?, ?, ?)',
        (doc_id, filename, content_type, data),
    )
    db.commit()
    return {'id': doc_id, 'url': f'/docs/{doc_id}'}


@router.get('/docs/{doc_id}')
def serve_doc(doc_id: str, db=Depends(get_db)):
    row = db.execute('SELECT * FROM doc_uploads WHERE id = ?', (doc_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Document not found')
    row = dict(row)
    content = bytes(row['data'])
    return Response(
        content=content,
        media_type=row['content_type'],
        headers={
            'Content-Disposition': f'inline; filename="{row["filename"]}"',
            'Cache-Control': 'max-age=86400',
        },
    )
