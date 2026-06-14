from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_connection, create_tables

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = get_connection()
    create_tables(conn)
    conn.close()
    yield


app = FastAPI(title='Chichi API', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'https://chihuahuasouthafrica.com',
        'https://www.chihuahuasouthafrica.com',
        'http://localhost:5173',
    ],
    allow_methods=['*'],
    allow_headers=['*'],
)

from routers import auth as auth_router
from routers import public as public_router
from routers import seller as seller_router
from routers import admin as admin_router
from routers import transactions as transactions_router

app.include_router(auth_router.router, prefix='/auth', tags=['auth'])
app.include_router(public_router.router, tags=['public'])
app.include_router(seller_router.router, prefix='/seller', tags=['seller'])
app.include_router(admin_router.router, prefix='/admin', tags=['admin'])
app.include_router(transactions_router.router, tags=['transactions'])
