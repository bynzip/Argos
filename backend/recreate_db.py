import psycopg

def create_db():
    try:
        # Connect to the default 'postgres' database
        conn = psycopg.connect(
            "host=127.0.0.1 user=admin password=1234 dbname=postgres",
            autocommit=True
        )
        cur = conn.cursor()
        
        # Check if DB exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'argos_db'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute("CREATE DATABASE argos_db")
            print("Database argos_db created successfully")
        else:
            print("Database argos_db already exists")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_db()
