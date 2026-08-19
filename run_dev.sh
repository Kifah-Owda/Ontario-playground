#!/usr/bin/env sh
# Dev quickstart: create venv, install deps, seed, run.
set -e
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m backend.app.seed
exec uvicorn backend.app.main:app --reload --port 8000
