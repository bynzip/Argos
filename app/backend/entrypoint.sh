#!/bin/sh
set -e

echo "Esperando PostgreSQL en ${DB_HOST}:${DB_PORT}..."
python - <<'PY'
import os
import socket
import time

host = os.getenv("DB_HOST", "postgres")
port = int(os.getenv("DB_PORT", "5432"))
deadline = time.time() + 120

while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=3):
            print("PostgreSQL disponible.")
            break
    except OSError:
        time.sleep(2)
else:
    raise SystemExit(f"No se pudo conectar a PostgreSQL en {host}:{port}")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ "${RUN_SETUP_INITIAL_DATA:-true}" = "true" ]; then
    python manage.py setup_initial_data
fi

if [ "${RUN_DEMO_SEED:-false}" = "true" ]; then
    python manage.py seed_phase1_demo_data
fi

exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
