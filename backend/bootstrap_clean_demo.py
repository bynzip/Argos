import os
import subprocess
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
PYTHONPATH = str(BASE_DIR / 'venv' / 'Lib' / 'site-packages')


def run_step(*args):
    env = os.environ.copy()
    existing = env.get('PYTHONPATH')
    env['PYTHONPATH'] = PYTHONPATH if not existing else f"{PYTHONPATH};{existing}"
    result = subprocess.run(args, cwd=BASE_DIR, env=env)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main():
    python_exe = sys.executable
    run_step(python_exe, 'recreate_db.py')
    run_step(python_exe, 'manage.py', 'migrate')
    run_step(python_exe, 'manage.py', 'seed_phase1_demo_data')


if __name__ == '__main__':
    main()
