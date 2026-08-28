# DEPLOYMENT — getting Ontario Playground onto a public URL

**Honest scope note:** an AI assistant can prepare everything *up to* the hosting
account — config, run commands, environment, database steps — but cannot create
the account or click "Deploy" for you, so the public URL appears at the end of
the ~15 minutes of steps below, done by you. Nothing here requires a credit card
on the free tier.

The app is one Python process (API + frontend together), so any host that runs
`uvicorn` works. Recommended: **Render + Supabase** — free, and the only part of
the app that needs a persistent disk (database + photos) moves to Supabase.
Alternatives at the bottom.

---

## Option A — Render + Supabase (recommended, ~25 min, free)

Render's free tier has **no persistent disk**, so nothing may be stored on the
instance itself: a restart wipes it. State therefore lives in Supabase — free
Postgres for the data, free Storage for the photos — and Render runs only the
stateless app. Render Blueprints are now a paid feature, so the service is
created by hand; this is free and equivalent, since a Blueprint only fills in
the form for you (`render.yaml` records the exact values).

### 1. Supabase — database + photo storage
- Create a project at supabase.com. **Save the database password**; it is shown
  once. Avoid `@ : / ? # &` in it, or percent-encode them — they are URL
  delimiters and will break the connection string.
- Pick a region near your Render region (Render free has no Canadian region;
  East US pairs well).
- Project Settings → Database → Connection string → **Session pooler**.
  Not "Direct connection": Supabase direct connections are **IPv6-only** and
  Render's free tier cannot reach them. Symptom if you get this wrong: a
  confusing "cannot connect"/timeout at deploy time, with correct credentials.
  A session-pooler string has host `…pooler.supabase.com`, port `5432`, and a
  username like `postgres.<project-ref>`.
- Storage → New bucket → name `park-photos`, **Public bucket ON**. A private
  bucket makes every image 400 and would require signed URLs.
- Project Settings → API → copy the **Project URL** and the **`service_role`**
  key (the secret one, not `anon`). It bypasses RLS so the server can write.

### 2. Put the code on GitHub
```bash
git add -A && git commit -m "Ontario Playground"
git remote add origin https://github.com/<you>/ontario-playground.git
git push -u origin main
```
Confirm `.env` is NOT in the repo — `git ls-files .env` must print nothing.
It holds your real `SECRET_KEY`, and now your Supabase service key too.

### 3. Seed the hosted database (from your machine, once)
Do this **before** the first deploy, and do it locally — Render's Shell tab is a
**paid** feature, so there is no way to run a command on a free instance.

```powershell
$env:DATABASE_URL = "<session pooler string>"
.\.venv\Scripts\python.exe -m backend.app.seed
```
The seed calls `create_all` itself, so this one command builds the schema and
loads the 13 locations. It is idempotent — rerunning is safe (`--force` wipes
and reloads).

### 4. Create the Render service
- render.com → **New → Web Service** → connect the repo.
- **Runtime** Python · **Plan** Free
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
  The proxy flags are required: without them the rate limiter sees every
  visitor as one IP and blocks the whole internet after 10 submissions.
- **Health check path:** `/api/meta`
- **Environment variables:**

  | Key | Value |
  |---|---|
  | `DATABASE_URL` | session pooler string |
  | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `SUPABASE_SERVICE_KEY` | `service_role` key (secret) |
  | `SUPABASE_BUCKET` | `park-photos` |
  | `SECRET_KEY` | long random string |
  | `ADMIN_PASSWORD` | your moderator password |
  | `PYTHON_VERSION` | `3.12` |

First build takes ~2–4 minutes.

### 5. Keep Supabase from pausing
Free Supabase projects **pause after ~7 days idle**, which takes the site down
until you resume them by hand. Schedule a request to **`/api/parks`** every
3 days (cron-job.org is a good fit; UptimeRobot's 5-minute minimum interval is
too frequent for this purpose).

It must be `/api/parks`, not `/api/meta`: `/api/meta` returns constants without
touching the database, so it would let Supabase pause anyway.

Separately, Render free spins down after ~15 minutes idle, so the first visitor
after a quiet spell waits ~50 s for a cold start. That is a latency cost, not a
data cost — keeping the instance permanently awake would consume ~730 of
Render's 750 monthly instance-hours (a per-account budget).

### 6. Post-deploy checklist
- [ ] Open the URL — hero page, dashboard, map all live.
- [ ] Sign in at `/admin.html` with `ADMIN_PASSWORD`.
- [ ] Submit a test report with a photo → approve → photo renders, and the
      object appears in the Supabase Storage bucket.
- [ ] **Manual Deploy → Clear cache & deploy**, then reload: the submitted park
      *and* its photo must survive. This is the whole point of the setup.
- [ ] Delete a park in admin → its objects disappear from the bucket.
- [ ] Two-network rate-limit test (phone on cellular + laptop) — both can submit.

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
| DATABASE_URL | no | default SQLite at `data/app.db`. A `postgresql://…` string is rewritten to psycopg 3 automatically, so paste Supabase's as-is |
| SUPABASE_URL | no | set it *and* `SUPABASE_SERVICE_KEY` to store photos remotely; leave both unset for local disk |
| SUPABASE_SERVICE_KEY | no | `service_role` key. **Secret** — dashboard/`.env` only, never committed |
| SUPABASE_BUCKET | no | defaults to `park-photos`; must be a **public** bucket |
| UPLOAD_DIR, TILE_URL, GEOCODER_*, MAP_START_*, limits | no | see `.env.example` / MANUAL_SETUP.md |

Photo storage is chosen by whether `SUPABASE_URL` **and** `SUPABASE_SERVICE_KEY`
are both present. Either one missing falls back to local disk, so a
half-configured environment degrades instead of failing every upload.

## Database setup summary
- **SQLite (default):** created automatically; run the seed once. Needs a
  persistent disk in production — which the Render free tier does not have.
- **PostgreSQL:** set `DATABASE_URL` and run the seed once. `psycopg[binary]`
  is already in requirements.txt, and a `postgresql://…` URL is rewritten to
  `postgresql+psycopg://…` with `sslmode=require` in `database.py`, so the
  string can be pasted exactly as the host prints it. `docker-compose.yml`
  ships a local Postgres for testing this path.
- **Schema changes in this release:** `parks` gained `location_type`,
  `address`, `parking`, `shade`, `fenced`, `water_access`. Fresh deploys need
  nothing; a pre-2026 dev database should be deleted and re-seeded (or
  `ALTER TABLE parks ADD COLUMN …` each column manually if it holds real data).
