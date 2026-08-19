# 09 — Strengths, Weaknesses & Rebuild Scope

## A. Strengths of the current ArcGIS MVP (preserve these qualities)

1. **Complete closed loop with zero code** — collect → store → visualize → narrate, all live and integrated. The three-system framing (Record / Insights / Engagement) is a sound product architecture worth keeping.
2. **Excellent contribution UX fundamentals** — anonymous, no-login web form; grouped questions; required-field enforcement; photo upload; four redundant ways to set location (GPS, search, pin, manual lat/lon) with graceful geolocation-denied fallback.
3. **Strong analytics UX** — genuine cross-filtering (park list ↔ map extent ↔ type bars ↔ condition donut) that answers real parent questions in two clicks; verified working in filtered screenshots.
4. **Sensible domain vocabulary** — age bands match child-development playground standards; equipment taxonomy and surface types are realistic; 3-point condition scale is contributor-friendly.
5. **Clear storytelling** — the StoryMap explains method, legend, and how-to; explicit calls to action; distributable link that works on social (fbclid observed).
6. **Real data already collected** — 10 parks / 41 equipment records is a working seed dataset and proof of concept.
7. **Free infrastructure worries** — hosting, TLS, imagery basemaps, geocoding, attachments all handled by ArcGIS Online.

## B. Weaknesses (motivate the rebuild)

**Platform / strategic**
1. **Licensing dependency & cost** — everything (form, layer, dashboard, story) lives inside one ArcGIS Online org subscription; credits consumed for storage/geocoding; public access depends on subscription staying active.
2. **Data ownership & portability** — data locked in a hosted feature layer; export exists but the public apps are not portable.
3. **Single-owner bus factor** — one personal account owns all items.
4. **Limited customization** — dashboard theme/layout, form branding, popups constrained to Esri builders; can't add custom logic (dedup, moderation, park picklists).

**Data quality**
5. Free-text park names as the grouping key; honor-system "once per park" amenity questions; no duplicate detection; instant unmoderated publishing; updates create disconnected duplicate rows.

**UX / functional**
6. No on-map legend (explained only in StoryMap prose) and inconsistent age-group colors between map and chart.
7. Re-entering park info for each equipment item = high contributor friction.
8. No "near me" search, no directions, no park detail page, no photo display in the dashboard, no data export for planners, no observation dates shown.
9. Template hygiene: survey card still shows Esri's pothole-template description; typos ("Equipments", "refres", "toddles").
10. **Accessibility gap (double meaning)** — (a) the schema captures no disability-accessibility attributes despite the project's framing; (b) WCAG accessibility of the dashboard (contrast, keyboard, screen reader) is not controllable in the builder.
11. Mobile experience of the dashboard is untuned; parents are mobile-first users.

## C. Rebuild scope for the replacement app (playground project only — not a generic GIS platform)

### Must-have (parity + critical fixes)
- Public **map explorer**: point map with age-group symbology **plus on-map legend**, popups with full record + photo, extent-synced stats.
- **Stats panel** equivalent to the dashboard: equipment-type-by-age stacked bar, condition breakdown, surface breakdown, parks/water/washroom counts; all cross-filtering with park selector and map bounds.
- **Contribution form**: anonymous by default; park selected from autocomplete of existing parks **or** create-new; park amenities asked once per park; **multiple equipment items per session** (repeat block); photo upload; GPS/pin/search/manual location with fallback; required type/age/condition.
- **Moderation queue** for admin approve/reject before publish; basic admin table view with edit/delete and CSV/GeoJSON export.
- **About/landing page** replicating the StoryMap's narrative (method, legend, how-to, call to action).
- Data migration of the 41 existing records / 10 parks.

### Nice-to-have
- Condition **observation history** per equipment item (enables the promised "update existing" flow).
- Disability-accessibility attribute block (ramps/transfer/inclusive equipment, accessible surfacing, accessible parking/washroom) + filterable "inclusive playground" badge.
- "Near me" geolocation, directions link, shareable URL-encoded filter state, park detail pages with photo galleries, marker clustering, basemap toggle, contributor accounts with credit, multilingual (EN/FR for Ontario), simple analytics for the owner.
- WCAG 2.1 AA conformance as an explicit requirement.

### Do NOT rebuild
- StoryMap authoring platform (a static/CMS about page suffices).
- Generic dashboard builder — hard-code the one dashboard this product needs.
- Survey form builder — hard-code the one form.
- Esri-specific mechanics: credits, hosted-layer views, ArcGIS org/user management, 3D scenes, advanced geoprocessing.
- The pothole-template artifacts and per-record park amenity duplication (fixed by the data model, not replicated).
