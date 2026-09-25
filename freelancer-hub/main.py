import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from database import connect, create_tables  # noqa: E402
from routers import admin, auth, freelancer  # noqa: E402

STATIC = Path(__file__).parent / 'static'



@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv('SKIP_DB_INIT') != '1':
        conn = connect()
        create_tables(conn)
        conn.close()
    yield


app = FastAPI(title='Freelancer Hub', lifespan=lifespan)


app.include_router(auth.router)
app.include_router(freelancer.router)
app.include_router(admin.router)


@app.get('/api/health')
def health():
    return {'status': 'ok'}


app.mount('/static', StaticFiles(directory=STATIC), name='static')


@app.get('/')
def index():
    return FileResponse(STATIC / 'index.html')
