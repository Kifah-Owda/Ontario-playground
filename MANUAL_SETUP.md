# Manual Setup

No accounts or credentials were created during development (per project rules). The app runs **fully locally with zero external accounts**. Everything below is either a value only you can set, or an *optional* hosted service with a documented placeholder.

---

## Manual Setup Required: Application secrets (required)
- **Service name:** none — local configuration
- **Why needed:** `SECRET_KEY` signs admin session tokens; `ADMIN_PASSWORD` is the moderator sign-in. Logins are refused until `ADMIN_PASSWORD` is set.
- **Required?** **Yes**, before anyone else can reach the app.
- **Account to create:** none.
- **Values to obtain:** generate `SECRET_KEY` yourself (e.g. `openssl rand -hex 32`); choose a strong `ADMIN_PASSWORD`.
- **Where to put them:** `.env` (copy from `.env.example`) → `SECRET_KEY=…`, `ADMIN_PASSWORD=…`; or your host's environment-variable settings. The `.env` file is loaded automatically at startup; values set in the real environment (host dashboard, shell exports) take precedence over the file.
- **Cost:** free.

## Manual Setup Required: Map tiles (default works; key optional)
- **Service name:** OpenStreetMap raster tiles (default) — or any XYZ provider (MapTiler, Stadia, Thunderforest…).
- **Why needed:** the basemap under the explore map and the form's location picker.
- **Required?** A tile source is required; **the default needs no account**. OSM's public tiles are fine for light/community use but their [usage policy](https://operations.osmfoundation.org/policies/tiles/) prohibits heavy production traffic — switch providers if the app grows.
- **Account to create (only if switching):** e.g. MapTiler Cloud or Stadia Maps account.
- **Values to obtain:** the provider's tile URL template containing your key.
- **Where to put them:** `.env` → `TILE_URL=https://…/{z}/{x}/{y}.png?key=YOUR_KEY` and `TILE_ATTRIBUTION=…` (HTML allowed).
- **Cost:** OSM free; MapTiler/Stadia free tiers ≈ 100k–200k tile requests/month, then ~US$25+/mo.

## Manual Setup Required: Address search / geocoding (optional)
- **Service name:** Nominatim (default: the public `nominatim.openstreetmap.org` endpoint).
- **Why needed:** the "Search address" box in the submission form. Everything else (tap-to-pin, GPS, manual lat/lng) works without it.
- **Required?** No — set `GEOCODER_ENABLED=false` to remove the feature cleanly.
- **Account to create:** none for the public endpoint (absolute limit ~1 req/sec, attribution required, no heavy use); optionally self-host Nominatim or use a provider (LocationIQ, Geoapify) later.
- **Values to obtain:** none by default; a provider URL+key if you switch.
- **Where to put them:** `.env` → `GEOCODER_URL=…`, `GEOCODER_ENABLED=true|false`.
- **Cost:** free (public endpoint); LocationIQ/Geoapify free tiers ≈ 3k–5k requests/day.

## Manual Setup Required: Database (default works; Postgres optional)
- **Service name:** SQLite (default, embedded) or PostgreSQL 14+.
- **Why needed:** all application data. SQLite is genuinely sufficient for province-scale volumes here (thousands of parks, moderate write rate); move to Postgres for multi-process deployments or managed backups.
- **Required?** SQLite: nothing to do. Postgres: only if you choose it.
- **Account to create (if Postgres, hosted):** e.g. Neon, Supabase (database only), Railway, or your own server / `docker-compose.yml`.
- **Values to obtain:** a connection string.
- **Where to put it:** `.env` → `DATABASE_URL=postgresql+psycopg://user:pass@host:5432/playgrounds`, and uncomment `psycopg[binary]` in `requirements.txt`.
- **Cost:** SQLite free; Neon/Supabase free tiers ≈ 0.5 GB (plenty), paid from ~US$19–25/mo.

## Manual Setup Required: Photo storage (default works; object storage optional)
- **Service name:** local disk (default: `data/uploads/`) — optionally S3-compatible object storage (Cloudflare R2, Backblaze B2) later.
- **Why needed:** processed WebP photos. Images are already resized/compressed server-side (~100–300 KB each), so 10 GB holds roughly 40–100k photos — local disk goes a long way.
- **Required?** No account needed for local disk. If you later adopt object storage, that's a small code change in `backend/app/images.py` (flagged in ARCHITECTURE.md); create the bucket + key then.
- **Where values go (future):** `.env` → `UPLOAD_DIR` today; `S3_*` variables would be added with that change.
- **Cost:** local free; R2 free tier 10 GB + no egress fees; B2 10 GB free.

## Manual Setup Required: Hosting (needed to go public)
- **Service name:** any host that runs a Python process — a €4–6/mo VPS (Hetzner, DigitalOcean), a free-tier PaaS (Render/Railway/Fly.io), or a Raspberry Pi.
- **Why needed:** to serve the app publicly; locally none is needed.
- **Required?** Only for public deployment.
- **Account to create:** your chosen host.
- **Values to obtain:** whatever the host needs (SSH key or Git connection); set all `.env` values in its dashboard.
- **Run command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
- **Why the proxy flags matter:** every recommended host (PaaS or a VPS behind Caddy/Nginx) puts a reverse proxy in front of the app. Without `--proxy-headers`, the anti-spam limiter sees *every visitor as the proxy's single IP* and will block real contributors after 10 submissions/hour site-wide. `--forwarded-allow-ips='*'` is safe on PaaS platforms where the app is only reachable through the platform's proxy; on your own VPS, bind uvicorn to `127.0.0.1` behind your proxy (or set the flag to the proxy's IP instead of `'*'`) so the forwarded header can't be spoofed by direct connections.
- **Cost:** free tiers exist (Render free instances sleep when idle); VPS ≈ US$4–6/mo.
- **Note:** persistent disk matters (SQLite file + uploads). On ephemeral-disk platforms, attach a volume or switch to Postgres + object storage.

## Manual Setup Required: Domain & TLS (optional)
- **Service name:** any registrar (~CA$15/yr); TLS free via Let's Encrypt (Caddy/Certbot) or automatic on PaaS.
- **Required?** No — hosts give you a working subdomain.
- **Where values go:** DNS at the registrar; no app config needed.

## Explicitly NOT needed
Email service, OAuth/auth provider, analytics/monitoring accounts, payment services, ArcGIS/Esri anything. Frontend libraries (Leaflet, Chart.js, Fredoka font) load from public CDNs with no keys; vendor the files into `frontend/` if you prefer zero third-party requests.

---

# Manual Setup Checklist

Complete in one pass before public deployment:

- [ ] Copy `.env.example` → `.env`
- [ ] `SECRET_KEY` — generate: `openssl rand -hex 32` → `.env`
- [ ] `ADMIN_PASSWORD` — choose a strong password → `.env`
- [ ] Decide database: **SQLite (do nothing)** ☐ or Postgres → create DB, set `DATABASE_URL` in `.env`, add `psycopg[binary]` to `requirements.txt` ☐
- [ ] Decide tiles: **OSM default (do nothing, light use only)** ☐ or provider account → `TILE_URL` + `TILE_ATTRIBUTION` in `.env` ☐
- [ ] Decide address search: **public Nominatim default** ☐ / disable (`GEOCODER_ENABLED=false`) ☐ / provider URL in `GEOCODER_URL` ☐
- [ ] Choose hosting; create account; set all `.env` values in host dashboard; ensure persistent disk for `data/`
- [ ] (Optional) Domain: register + point DNS; TLS via host/Let's Encrypt
- [ ] Run `python -m backend.app.seed` once (or start empty)
- [ ] Sign in at `/admin.html`, submit a test report at `/submit.html`, approve it, confirm it appears on `/`
- [ ] Add a LICENSE file before publishing the repository
