# DEPLOYMENT — getting Kindred Play onto a public URL

**Honest scope note:** an AI assistant can prepare everything *up to* the hosting
account — config, run commands, environment, database steps — but cannot create
the account or click "Deploy" for you, so the public URL appears at the end of
the ~15 minutes of steps below, done by you. Nothing here requires a credit card
on the free tier.

The app is one Python process (API + frontend together), so any host that runs
`uvicorn` works. Recommended: **Render** (simplest, blueprint included).
Alternatives at the bottom.

---

## Option A — Render (recommended, ~15 min)

### 1. Put the code on GitHub
- Create a GitHub account (github.com) if needed → **New repository** →
  name it `kindred-play` → keep it public or private.
- Upload the project folder (web UI "uploading an existing file" works for a
  zip's contents, or use git locally):
  ```bash
  cd playground-ontario
  git init && git add -A && git commit -m "Kindred Play MVP"
  git remote add origin https://github.com/<you>/kindred-play.git
  git push -u origin main
  ```
- Make sure `.env` is NOT in the repo (`.gitignore` already excludes it).

### 2. Create the Render service
- Sign up at render.com (free, can use your GitHub login).
- **New → Blueprint** → select your repo. Render reads `render.yaml` and shows
  one web service, `kindred-play`.
- It will prompt for **ADMIN_PASSWORD** (marked `sync: false`): type a strong
  password — this is your moderator sign-in. `SECRET_KEY` is auto-generated.
- Click **Apply**. First build takes ~2–4 minutes.

**Free tier variant:** the blueprint uses the `starter` plan because it includes
a persistent disk (the SQLite database and photos survive restarts). On the
**free** plan there is no disk — the database resets on every deploy/restart,
which is fine for a short demo but wrong for real community data. For free-tier
persistence instead: create a free **Neon** or **Supabase** Postgres, copy its
connection string, and add env var
`DATABASE_URL=postgresql+psycopg://…` plus `psycopg[binary]` in
requirements.txt; photos will still be ephemeral on free (acceptable for
testing; move to the starter disk or S3-style storage before real launch).

### 3. Seed the database (one time)
- Service page → **Shell** tab →
  ```bash
  python -m backend.app.seed
  ```
  Expect: `Seeded 10 playgrounds / 41 equipment items + 3 sample splash pads & beaches.`

### 4. You have a public URL
- Render shows it at the top: `https://kindred-play.onrender.com` (yours will
  differ). Open it — hero page, dashboard, wizard, admin all live.
- Sign in at `/admin.html` with your ADMIN_PASSWORD.

### 5. Post-deploy checklist (from MANUAL_SETUP.md)
- [ ] Two-network rate-limit test (phone on cellular + laptop) — both can submit.
- [ ] Submit a test report with a photo → approve → photo renders.
- [ ] Restart the service (Manual Deploy → Clear cache & deploy) → data still
      there (persistence confirmed).
- [ ] OSM tiles: fine for launch-scale traffic; add a keyed tile provider via
      `TILE_URL`/`TILE_ATTRIBUTION` env vars if traffic grows.

---

## Option B — Railway / Fly.io
Same shape: build `pip install -r requirements.txt`, start command exactly as in
`render.yaml` (keep `--proxy-headers`), attach a volume mounted at `data/`, set
`SECRET_KEY` + `ADMIN_PASSWORD`, then run the seed once in their shell.

## Option C — Any VPS (Hetzner/DO, ~$4/mo)
```bash
git clone <repo> && cd playground-ontario
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit: SECRET_KEY, ADMIN_PASSWORD
python -m backend.app.seed
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
```
Put Caddy in front (`caddy reverse-proxy --from yourdomain.ca --to :8000`) for
automatic HTTPS. Binding uvicorn to 127.0.0.1 behind the proxy is what makes
`--forwarded-allow-ips` safe here — see docs/ARCHITECTURE.md § D9.

## Environment reference
| Variable | Required | Notes |
|---|---|---|
| SECRET_KEY | yes | long random string; signs admin tokens |
| ADMIN_PASSWORD | yes | moderator sign-in; login refused while empty |
| DATABASE_URL | no | default SQLite at `data/app.db`; Postgres string to upgrade |
| UPLOAD_DIR, TILE_URL, GEOCODER_*, MAP_START_*, limits | no | see `.env.example` / MANUAL_SETUP.md |

## Database setup summary
- **SQLite (default):** created automatically; run the seed once. Needs a
  persistent disk in production.
- **PostgreSQL:** set `DATABASE_URL`, add `psycopg[binary]` to
  requirements.txt, run the seed once. `docker-compose.yml` ships a local
  Postgres for testing this path.
- **Schema changes in this release:** `parks` gained `location_type`,
  `address`, `parking`, `shade`, `fenced`, `water_access`. Fresh deploys need
  nothing; a pre-2026 dev database should be deleted and re-seeded (or
  `ALTER TABLE parks ADD COLUMN …` each column manually if it holds real data).
