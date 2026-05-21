import os

import psycopg
from dotenv import load_dotenv


load_dotenv()


DB_NAME = os.getenv('DB_NAME', 'argos_db')
DB_USER = os.getenv('DB_USER', 'admin')
DB_PASSWORD = os.getenv('DB_PASSWORD', '1234')
DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = os.getenv('DB_PORT', '5432')


def create_db():
    conn = psycopg.connect(
        f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASSWORD} dbname=postgres",
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            if cur.fetchone():
                print(f"Database {DB_NAME} already exists")
                return

            cur.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"Database {DB_NAME} created successfully")
    finally:
        conn.close()


if __name__ == "__main__":
    create_db()
