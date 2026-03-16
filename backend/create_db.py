import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_db():
    try:
        con = psycopg2.connect(user='admin', password='1234', host='localhost')
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        cur.execute("CREATE DATABASE argos_db")
        cur.close()
        con.close()
        print("Database argos_db created successfully")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_db()
