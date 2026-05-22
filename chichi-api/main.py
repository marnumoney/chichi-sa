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
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)
