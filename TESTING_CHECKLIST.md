# TESTING CHECKLIST — Ontario Playground (Stitch redesign release)

Run top-to-bottom on a fresh local install (`.\run_dev.ps1` on Windows,
`./run_dev.sh` on macOS/Linux), then repeat the ★ items once on the deployed URL. Sandbox note: automated checks
already passed (all Python compiles, all JS passes syntax checks, diff-summary
unit tests green); everything below is the runtime pass that needs a browser.

## 1. Setup & seed

> **Two storage modes.** With no Supabase variables in `.env`, the app uses
> SQLite at `data/app.db` and writes photos to `data/uploads/`. Setting both
> `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` switches photos to Supabase
> Storage; `DATABASE_URL` switches the database. Run this checklist in
> whichever mode you are about to ship, and note that in Supabase mode the
> `data/` directory is not used at all.

- [ ] `pip install -r requirements.txt` completes
- [ ] Delete any old `data/app.db` (schema changed) → `python -m backend.app.seed`
      prints `Seeded 10 playgrounds / 41 equipment items + 3 sample splash pads & beaches.`
- [ ] Start with `.env` values only (nothing exported) → admin login works (C1)
- [ ] Start once without `.env` → two WARNING lines in terminal

## 2. Landing & navigation ★
- [ ] Hero renders (cream/forest theme, Plus Jakarta Sans headings, Material Symbols icons visible — not empty boxes)
- [ ] "Find a Park" scrolls to the explorer
- [ ] Category cards: Playgrounds → dashboard filtered to playgrounds (chip active);
      Splash Pads → 2 results; Beaches → 1 result; each clears previous filters
- [ ] Header/footer consistent on all five pages; keyboard focus rings visible

## 3. Dashboard / explorer ★
- [ ] 13 markers: 10 age-glyph pills + 2 water-drop + 1 beach icon; legend matches (blue ● / purple ◆ / orange ▲)
- [ ] Search box narrows by name; Clear all filters resets everything
- [ ] Age chips filter playgrounds; facility chips work: Washroom, Water fountain,
      Parking, Shade, Fenced, Accessible (seed: accessible=9 playgrounds; parking/shade only on samples)
- [ ] Condition + Surface selects filter; "Filter by map view" follows panning
- [ ] KPI strip updates live; Places count pill matches list length
- [ ] Community Insights collapsed by default; opens to 3 live charts using the
      new age colours; charts ignore splash pads/beaches (equipment is playground-only)
- [ ] List cards show photo thumb or type-icon placeholder + mini-chips

## 4. Map behaviour ★
- [ ] Click a list card → map zooms (≥15), marker gets the highlight ring, popup opens
- [ ] Popup is the slim version: name, facts, shapes, "View details" button
- [ ] Click the selected card again → deselects, highlight clears
- [ ] Marker click → popup + card highlight without zoom jump

## 5. Park detail page ★
- [ ] "View details" opens /park.html?id=N; title, breadcrumb, tags (type, ♿, ages)
- [ ] Seed park (no photos): friendly placeholder with "add some" link
- [ ] Accessibility card: tri-states, fenced tag, surface; amenities grid shows only known fields
- [ ] Playground: equipment cards with shape + condition pill; splash pad/beach: no equipment section, water-entry row shown
- [ ] Mini-map centred with highlighted marker; address line; **Copy address** copies and flashes "Copied!"
- [ ] /park.html?id=999999 → graceful "couldn't find" card
- [ ] Mobile width (≤900px): single column, gallery stacks

## 6. Add-a-Park wizard ★
- [ ] Step 1: three type cards; playground preselected; name, geocoder search
      (autofills Address), manual address, city, Use my location, tap-map pin, draggable pin
- [ ] Validation: no name/pin → friendly error, cannot advance
- [ ] Step 2: washroom/parking/shade tri-pills; Fenced only for playground;
      Accessible water entry only for splash pad/beach; Surface hidden for beach; 5 accessibility tri-states + notes
- [ ] Step 3: playground → equipment repeater (add/remove, age shows short labels);
      splash pad/beach → skips straight from 2 to 4 (progress bar still sensible)
- [ ] Step 4: dropzone (click + drag-drop), previews with remove ✕, photo cap enforced,
      Description/Review/Name fields, Review-your-report summary correct per type
- [ ] Submit playground → success card; appears in admin Pending with all new fields
- [ ] Submit splash pad → succeeds with zero equipment (server accepts; playground with zero equipment is rejected by API if forced)
- [ ] Honeypot: filling the hidden Website field → fake success, nothing stored

## 7. Update flow (I1 regression) ★
- [ ] Detail page → Suggest an update → type card, every field, tris, a11y, equipment rows pre-filled; Review box empty
- [ ] Submit unchanged → admin diff: "no equipment or amenity changes detected" → approve → public data identical
- [ ] Remove one equipment + flip Parking → diff shows red Removed + "Changed: parking" → approve → old snapshot Archived
- [ ] /submit.html?update=999999 → warning notice, blank form still usable

## 8. Admin portal ★
- [ ] Login (wrong password → error; correct → console); Sign out returns to login
- [ ] Dashboard counts strip (Pending/Live/Rejected/Archived/Photos) correct and updates after actions
- [ ] Tabs filter; cards show type chip, address, amenities, photos, equipment table
- [ ] Approve/Reject with note; note appears on the card afterwards
- [ ] **Edit**: dialog pre-filled; change name + shade + add equipment → Save →
      card updates, status unchanged, photos intact; edit a splash pad → equipment section hidden
- [ ] Edit validation: set a playground to zero equipment rows → save fails with clear message
- [ ] Delete → confirm text mentions photos → row gone, files gone from data/uploads (I2)
- [ ] Export CSV → opens; has location_type/address/parking/shade/fenced/water_access columns; sample beach appears as one row
- [ ] Expired/invalid token (clear sessionStorage value to garbage) → any action returns to login

## 9. Data integrity
- [ ] `python -m backend.app.seed` on populated DB → "already has data" guard
- [ ] `python -m backend.app.seed --force` after approving a photo submission →
      re-seeds clean, photos table empty, uploads dir empty (I3)
- [ ] Optional Postgres pass: docker compose db + DATABASE_URL → seed, submit, approve, force re-seed all work

## 10. Deployment ★ (from DEPLOYMENT.md)
- [ ] Public URL loads over HTTPS; seeded data visible
- [ ] Two-network rate-limit test: laptop + phone-on-cellular can both submit (I4)
- [ ] Restart/redeploy → data persists (disk or Postgres configured)
- [ ] Admin login on the public URL; approve the phone's test submission end-to-end
