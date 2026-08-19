# 05 — Survey Analysis (ArcGIS Survey123)

**Form title:** "Report Playground Equipments"
**Form subtitle:** "Report on playground facilities and equipment age appropriate"
**Item title (link card):** "Playground Equipment"
**Access:** Public web form, anonymous submission (no sign-in prompt observed). Delivered via Survey123 web app; embedded in the StoryMap via the Survey123 JS-API embed (`open=web&embed=jsapi`, `hide=navbar,footer,theme`); also shared via short link `arcg.is/1n5O5H0`.
**Authoring tool (inferred):** Survey123 **web designer**, starting from an Esri template — the item summary still contains the template's pothole-reporting description, and the URL uses the web-designer share pattern.

---

## Full field specification

### Group 1: "Park info" (collapsible section)

| Field | Type | Required | Validation observed | Hint text | Notes |
|---|---|---|---|---|---|
| Park / Playground Name | Text (single line) | **Yes** (red asterisk) | Non-empty on submit | — | Free text. This is the de facto foreign key for park-level aggregation in the dashboard; typos fragment parks. |
| Playground Surfacing Material | Single select dropdown | No | — | — | Choice list (confirmed via dashboard values): **Rubber, Wood Chips, Sand**. Additional unused choices possible but not observed. |
| How Many Water Fountains? | Number | No | Numeric-only input mask (123 placeholder) | "Please answer this only once per park" | Count, not boolean. The dashboard renders park-level "Water: 9", suggesting per-park interpretation of a per-record field. |
| Washroom near the playground? | Single select, radio buttons | No | — | "Please answer this only once per park" | Observed choice: **Yes** (and by convention **No**; second option cut off in screenshot). |

### Group 2: "Equipment Information" (collapsible section)

| Field | Type | Required | Validation observed | Notes |
|---|---|---|---|---|
| Equipment type | Single select dropdown | **Yes** | Must select | Choice list (from dashboard categories): **Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers** |
| Age Group | Single select dropdown | **Yes** | Must select | Choices: **Toddler (6–23 months), Pre-schoolers (2–5 years), School-age (5–12 years)** — exactly the CSA/CPSC-style age bands |
| Equipment Conditions | Single select dropdown | **Yes** | Must select | Choices: **Like New, Acceptable, Very old** (3-point condition scale) |
| Please upload an image of the equipment | Image/file upload | No | Image types; drag-drop zone + camera-icon button | Stored as feature attachment. Max count/size not observable (Survey123 default: 1 image unless raised; 10 MB default cap — verify) |
| Any notes? | Text (single line) | No | — | Free-form comments |

### Location question: "Playground equipments"

| Property | Observed value |
|---|---|
| Type | Geopoint (map question) → point geometry of the record |
| Basemap | Esri World Imagery (attribution: "City of Toronto, ON, New York State, Microsoft, Vantor \| Esri, HERE, Garmin, iPC, NRCan") |
| Controls | Address/place search box (geocoding), zoom +/−, home extent, use-my-location, fullscreen, delete-pin (trash icon) |
| Manual entry | Lat / Lon numeric fields in degrees below the map |
| Geolocation handling | Red error banner "Can not find your location. Please check your browser to ensure that your location is shared." when browser permission denied — with graceful fallback to search/manual pin |
| Default extent | Toronto area (inferred from imagery/attribution) |
| Semantics | **Location of the individual equipment item** (one point per submission), not the park centroid |

### Submission
- Single green **Submit** button; writes one record to the hosted feature layer with the photo as attachment.
- "Powered by ArcGIS Survey123" footer link.

---

## Conditional logic, calculations, hidden fields
- **None observed.** No question visibility changed while options were unselected; no cascading selects; no visible calculated fields. Hidden fields (e.g., auto-captured submission timestamp, username) cannot be seen from the public form, but Survey123 always stores system fields: `objectid`, `globalid`, `CreationDate`, `Creator`, `EditDate`, `Editor` on the feature layer. Treat those as available metadata.

## Scoring / ratings
- No numeric scoring. The only evaluative field is the 3-level condition scale. There is **no accessibility scoring** of any kind (no ramp/transfer/inclusive-equipment questions) — important gap given the project's stated accessibility ambition.

## Data-quality mechanics (or absence thereof)
1. **Park identity is free text** → same physical park can appear as multiple strings; the dashboard's park list and "Number of Parks" indicator depend on exact-string grouping.
2. **Park-level attributes ride on equipment-level records** with an honor-system "only once per park" hint → park amenities are stored sparsely/inconsistently across rows; dashboard indicators (Water 9 / Washroom 9) work only because contributors followed the convention.
3. **No duplicate detection**, no proximity check, no picklist of existing parks.
4. **No moderation** — submissions publish instantly.
5. **No contributor identity** — anonymous; no way to contact or credit contributors, no spam defense beyond obscurity.

## Rebuild directives derived from this form
- Preserve: low-friction anonymous submission; map-pin + GPS + search + manual lat/lon options; photo upload; required core trio (type/age/condition); grouped form UX; graceful geolocation fallback.
- Fix: park as a first-class selectable entity (autocomplete/create-new), equipment entries as repeatable child items in one session, park amenities asked once per park, moderation queue, corrected copy/metadata, optional accessibility question block.
