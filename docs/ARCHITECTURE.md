# Architecture

Decision record for the Phase 2 rebuild. Source of truth for scope: `project_analysis/` (Phase 1) + owner validation memo (park-centric model, moderation, accessibility, image optimization, Ontario-wide, open source/free-first, no AI-provisioned accounts).

## System shape

```
Browser ── static HTML/CSS/JS (Leaflet + Chart.js via CDN)
   │   fetch /api/*
   ▼
FastAPI (single Uvicorn process)
   ├── routes/public.py       GET /api/parks /parks/{id} /stats /meta
   ├── routes/submissions.py  POST /api/submissions (multipart) → pending Park
   ├── routes/admin.py        login · queue · approve/reject/delete · export.csv
   ├── images.py              Pillow: resize → WebP + thumb, EXIF stripped
   ├── StaticFiles            /            → frontend/
   └── StaticFiles            /uploads/*   → data/uploads/
   ▼
SQLAlchemy → SQLite (default) │ PostgreSQL (DATABASE_URL)
```

One process, one directory of data. This is the whole deployment.

## Decisions & rationale

### D1 — Monolith over microservices; server serves the frontend
Traffic profile is a community civic app. A single FastAPI process serving both API and static files minimizes hosting cost (one free-tier dyno / one tiny VPS) and ops knowledge required. **Trade-off:** frontend and backend scale together; acceptable at this scale forever, and a CDN can front the static files later without code change.

### D2 — No frontend build step
Plain HTML/CSS/JS with Leaflet and Chart.js from CDN. Rationale: owner priorities are cost and maintainability by a small team; removing Node/bundler eliminates the most common bit-rot source in small civic projects. **Trade-off:** no TypeScript/components; mitigated by small page-scoped scripts (`common/explore/submit/admin.js`). CDN files can be vendored into `frontend/` for full self-hosting.

### D3 — SQLite default, Postgres switchable (no PostGIS yet)
The only spatial operations the product needs are point storage and bounding-box filtering — served by indexed `lat`/`lng` float columns in any SQL database. Province-wide scale is roughly thousands of parks: trivially within SQLite capacity. `DATABASE_URL` flips to Postgres (multi-process deployments, managed backups). **PostGIS is deliberately deferred**: adopt it only when a real spatial feature arrives (park polygons, "within X km" queries, spatial joins). This was the single biggest cost/complexity saving vs. replicating ArcGIS.

### D4 — Park-centric snapshot model with revision chain (moderation built into the schema)
Owner-mandated change from the MVP's per-equipment rows. One `Park` row = one submission snapshot with `status ∈ {pending, approved, rejected, archived}` and children `EquipmentItem[]`, `Photo[]`. Updates are new pending rows pointing at the live row via `revision_of_id`; approval archives the predecessor. Benefits: the moderation queue is a `WHERE status='pending'`; full edit history is retained for free; the public API is a `WHERE status='approved'`; no separate versioning tables. **Trade-off:** duplicate storage per revision — negligible at these volumes.

### D5 — Accessibility as tri-state fields
`accessible_parking / accessible_washroom / step_free_access / accessible_surfacing / inclusive_equipment` are nullable booleans (Yes / No / not assessed) plus free-text notes. Tri-state matters: crowdsourced absence-of-data must not read as "not accessible". The UI's ♿ filter and badge only assert on explicit `true`.

### D6 — Image pipeline on upload, storage-format = WebP
Owner requirements (≤10 photos, auto-resize, cost optimization, no manual resizing) implemented in `images.py`: validate → orient → re-encode to WebP q80 capped at 1600 px + 480 px thumbnail. Re-encoding also strips EXIF (camera GPS = privacy win). Local-disk storage keeps costs at zero; the S3-compatible seam is isolated in `process_upload()` + the two `filename` columns — swapping to R2/B2 later touches one module.

### D7 — Single-admin auth, stdlib HMAC tokens
One `ADMIN_PASSWORD` env var; login mints `expiry.hmac(SECRET_KEY, expiry)` bearer tokens (12 h TTL) held in `sessionStorage`. Zero dependencies, zero accounts, constant-time comparisons. **Upgrade path documented:** if multiple moderators are ever needed, replace `security.py` with a users table + passlib hashes or an OSS IdP; route contracts don't change.

### D8 — Client-side filtering on the explore page
The page loads all approved parks once (a full-province dataset is a few hundred KB of JSON) and does age/type/condition/name/♿/extent filtering plus chart aggregation in the browser. This exactly reproduces the ArcGIS dashboard's instant cross-filter feel with zero query latency. The server nevertheless implements the same filters (`/api/parks?bbox=…`, `/api/stats`) so the switch to server-side filtering at, say, >5k parks is a frontend-only change.

### D9 — Anti-abuse: honeypot + per-IP rate limit + moderation
Anonymous submission is a product requirement, so defense is layered: hidden honeypot field (silently discarded), in-memory sliding-window limit (default 10/hr/IP), hard caps (photo count/size, equipment count, Ontario coordinate bounds, choice-list validation), and finally human moderation as the backstop. **Trade-off:** the rate limiter is per-process; move it to the DB or a proxy rule if scaled to multiple workers. **Deployment requirement:** the limiter keys on `request.client.host`, so behind any reverse proxy Uvicorn must run with `--proxy-headers` (and an appropriate `--forwarded-allow-ips`) or all visitors share one IP bucket — see MANUAL_SETUP.md § Hosting. Trusting `X-Forwarded-For` in application code was deliberately rejected: it would let direct-to-origin connections spoof the header and bypass the limit entirely.

### D10 — Vocabularies as code constants
Equipment types / age groups / conditions / surfaces live in `models.py` and are served via `/api/meta`, so the three age bands and their shapes stay consistent across form, map, charts, and validation. Promoting them to DB lookup tables is a later refactor if admins need to edit them without deploys.

## Requirements traceability
| Owner requirement | Where implemented |
|---|---|
| Park-centric submission w/ equipment inventory | `schemas.SubmissionIn`, `routes/submissions.py`, `submit.html/js` repeater |
| ≤10 images, auto resize/compress, low storage cost | `images.py`, `MAX_PHOTOS_PER_SUBMISSION`, WebP pipeline |
| Manual approval before public visibility | `Park.status`, admin routes, `admin.html/js`; public routes filter `approved` |
| Disability-accessibility attributes | D5 fields + form section + ♿ filter/badges/notes |
| Ontario-wide scalability | D3/D8 + Ontario bounds validation + bbox/stats endpoints |
| Open source / free / low-cost | D1–D3, D6–D7; `MANUAL_SETUP.md` costs |
| No AI-provisioned accounts; placeholders + docs | `.env.example`, `MANUAL_SETUP.md` incl. consolidated checklist |
| Preserve UX where appropriate | Age-shape legend, four location-capture methods, dashboard widget set & cross-filters, confirmation screen |

## Assumptions made during implementation
1. **Seed data** reconstructs the MVP snapshot: two parks match screenshots exactly; eight are plausible fills that reproduce validated totals; coordinates approximate. Replace freely.
2. Public Nominatim + OSM tiles are acceptable at launch traffic (usage policies documented; both swappable via env).
3. Single moderator; single process; province-scale data ≤ a few thousand parks near-term (D7/D8/D9 sized accordingly).
4. English-only UI at launch; FR strings are a frontend-only addition.
5. Schema management via `create_all` is fine until first post-launch schema change; adopt Alembic then.
6. Photos are park-level (matches owner's park-centric list). Per-equipment photo linkage is a possible later addition (add `equipment_item_id` FK to `photos`).

## Deferred (deliberately)
PostGIS & park polygons · marker clustering · contributor accounts & notifications · object storage · multi-moderator auth · automated tests beyond validation (add pytest + httpx `TestClient` as the first CI step) · French localization.
