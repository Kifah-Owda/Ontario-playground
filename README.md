# Kindred Play — Ontario Playground & Recreation Finder

Open-source rebuild of the ArcGIS playground MVP ("Find the Perfect Playground: A Guide to Ontario's Play Areas"), redesigned with the **Kindred Play** design system (2026). Communities report **playgrounds, splash pads, and beaches** — amenities, disability accessibility, photos, and (for playgrounds) every piece of play equipment with its age group and condition — moderators approve reports, and families explore them through a friendly landing page, a filterable map dashboard, and rich location detail pages.

Built to the Phase 1 documentation package (`project_analysis/`) plus the owner-approved Phase 2 changes: **park-centric submissions**, **moderation-before-publish**, **accessibility attributes**, **automatic image resizing**, and a **free/open-source stack**.

## Stack (all open source)
| Layer | Choice | Why |
|---|---|---|
| API + static hosting | Python 3.11+ / FastAPI / Uvicorn | One process serves everything; tiny ops surface |
| Database | SQLite (default) or PostgreSQL via `DATABASE_URL` | Zero-cost start; clean upgrade path |
| ORM | SQLAlchemy 2 | Portable across both databases |
| Images | Pillow → WebP + thumbnail, EXIF stripped | Owner requirement: auto resize/compress, low storage cost |
| Frontend | Static HTML/CSS/JS (no build step) | Nothing to install, nothing to break |
| Map | Leaflet 1.9 + OpenStreetMap tiles | Free; no API key by default |
| Charts | Chart.js 4 | Recreates the dashboard's bar + doughnut cross-filters |
| Geocoding | Nominatim (optional, public endpoint) | Free address search in the form |

No accounts, keys, or paid services are required to run it. Optional external services are documented in **MANUAL_SETUP.md**.

## Quickstart (local, ~2 minutes)
```bash
cd playground-ontario
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then EDIT .env: set SECRET_KEY and ADMIN_PASSWORD
python -m backend.app.seed      # 10 playgrounds / 41 items + 3 sample splash pads & beaches
uvicorn backend.app.main:app --reload
```
Or just: `./run_dev.sh`

Then open:
- **http://localhost:8000/** — landing (hero + category cards) + explore dashboard
- **/park.html?id=N** — location detail page (photos, amenities, equipment, map + copy-address)
- **/submit.html** — 4-step "Add a Park" wizard (playground / splash pad / beach)
- **/admin.html** — moderation console: review, approve/reject, **edit**, delete, CSV (ADMIN_PASSWORD)
- **/about.html** — project story
- **/api/docs** — interactive API documentation

**Upgrading an existing dev copy (schema changed in 2026):** the `parks` table gained
`location_type`, `address`, `parking`, `shade`, `fenced`, `water_access`. There is no
migration tool — for development, delete `data/app.db` and re-seed
(`python -m backend.app.seed`). If you already have real community data, export the
CSV from the admin first, or add the columns manually with `ALTER TABLE`.

Configuration: the app loads `.env` from the project root automatically at startup, so editing that file is all local setup requires. Variables set in the real environment (shell `export`s, or your host's dashboard) always take precedence over the file — set them there in production.

## Project layout
```
backend/app/          FastAPI application
  config.py           env-driven settings
  database.py         engine/session (SQLite or Postgres)
  models.py           Park / EquipmentItem / Photo + vocabularies
  schemas.py          API contracts + validation (Ontario bounds, choice lists)
  security.py         admin HMAC tokens + submission rate limiter
  images.py           resize/compress/EXIF-strip pipeline
  seed.py             reconstructed MVP dataset (verified totals)
  routes/             public.py · submissions.py · admin.py
frontend/             no-build static app (index, park, submit, about, admin)
frontend/css/style.css  Kindred Play design tokens (hand-written; no Tailwind runtime)
data/                 SQLite DB + processed uploads (gitignored)
docs/                 ARCHITECTURE.md · API.md
MANUAL_SETUP.md       every external value you must supply + final checklist
project_analysis/     Phase 1 reverse-engineering package
```

## Feature parity map (MVP → rebuild)
| MVP (ArcGIS) | Rebuild |
|---|---|
| Survey123 per-equipment form | Park-centric form with repeatable equipment entries (owner change) |
| Geopoint: GPS / search / pin / manual lat-lon | Same four methods, same graceful geolocation fallback |
| Dashboard: type×age bars, condition + surface doughnuts, KPIs, park list, extent filter | Same widgets, same cross-filter model, plus age chips and ♿ filter |
| Age-group symbols (●◆▲) explained in StoryMap prose | Unified shape system everywhere **with an on-map legend** |
| Instant publish | **Moderation queue** (owner requirement) |
| No accessibility data | Tri-state accessibility attributes + notes (owner requirement) |
| StoryMap narrative | `/about.html` |
| No export | Admin CSV export (equipment-level, planner-friendly) |
| Playgrounds only | **Three location types** (playground / splash pad / beach) with type-aware survey + filters |
| Popup-only details | **Dedicated detail pages** with gallery, amenities, accessibility, map + copy-address |
| — | **Admin in-place editing** + moderation dashboard counts |

## Operating notes
- **Moderation:** every submission is `pending` until approved. Approving an update archives the park's previous snapshot, preserving history; the update form pre-fills the park's current public data, and moderation cards show a change summary (with removals highlighted) for revisions. Permanently deleting a record also removes its photo files from disk; rejected/archived records keep theirs as history.
- **Seed data caveat:** DownsView Park and Edithvale Park breakdowns match the dashboard screenshots exactly; the other eight parks are plausible reconstructions that reproduce the validated global totals (41 items; 21/14/6 conditions). Coordinates are approximate — correct them via an update submission or by editing `seed.py`.
- **Design system:** the frontend implements the approved Stitch "Kindred Play" tokens (cream surfaces, Forest Deep primary, Plus Jakarta Sans + Be Vietnam Pro, Material Symbols icons, pill buttons, 16/24px radii) as hand-written CSS — deliberately **no Tailwind runtime** (the Play CDN is not for production and would break the no-build architecture). Age groups keep their ●◆▲ shapes with the new approved colours (Toddler Blue / Preschool Purple / School-age Orange), so meaning never relies on colour alone.
- **Sample data:** the three seeded splash pads/beaches are clearly-marked plausible samples so those categories aren't empty — verify and correct them via admin **Edit**.
- **Scale:** client-side filtering is used because a full-province dataset (thousands of parks) is still a small payload; the `/api/parks?bbox=` and `/api/stats` endpoints already support server-side filtering when it's time to switch. See `docs/ARCHITECTURE.md`.

## License
Choose and add a license before publishing (MIT recommended for maximum reuse). OSM tiles and Nominatim have their own attribution/usage requirements — see MANUAL_SETUP.md.
