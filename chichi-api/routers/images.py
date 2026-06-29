import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from database import get_db

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post('/images/upload', status_code=201)
async def upload_image(file: UploadFile = File(...), db=Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail='File too large (max 10 MB)')
    image_id = uuid.uuid4().hex
    content_type = file.content_type or 'image/jpeg'
    db.execute(
        'INSERT INTO images (id, content_type, data) VALUES (?, ?, ?)',
        (image_id, content_type, data),
    )
    db.commit()
    return {'url': f'/images/{image_id}'}


@router.get('/images/{image_id}')
def serve_image(image_id: str, db=Depends(get_db)):
    row = db.execute('SELECT * FROM images WHERE id = ?', (image_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail='Image not found')
    row = dict(row)
    content = bytes(row['data'])
    return Response(
        content=content,
        media_type=row['content_type'],
        headers={'Cache-Control': 'max-age=31536000'},
    )
