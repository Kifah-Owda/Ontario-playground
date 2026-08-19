# 08 — Data Model

Conceptual model only (per Phase 1 scope — no SQL). Two views: the **as-is flat model** ArcGIS actually stores, and the **conceptual target model** the domain implies. The rebuild should migrate from the first to the second.

---

## A. As-is: single flat table (hosted feature layer)

Survey123 publishes one point feature layer; **one row = one survey submission = one piece of equipment**, with park-level fields denormalized onto every row.

### Entity: `EquipmentReport` (feature, point geometry)

| Attribute | Type | Domain / notes | Origin |
|---|---|---|---|
| objectid | integer (PK) | auto | system |
| globalid | GUID | auto | system |
| geometry | Point (lat/lon → Web Mercator) | equipment location | geopoint question |
| park_name | text | free text; de facto grouping key ("DownsView Park", …) | required question |
| surfacing_material | coded text | {Rubber, Wood Chips, Sand} | optional question |
| water_fountains | integer | count; intended once-per-park | optional question |
| washroom_nearby | coded text | {Yes, No} | optional question |
| equipment_type | coded text | {Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers} | required |
| age_group | coded text | {Toddler (6–23 months), Pre-schoolers (2–5 years), School-age (5–12 years)} | required |
| equipment_condition | coded text | {Like New, Acceptable, Very old} | required |
| notes | text | free text | optional |
| CreationDate / Creator / EditDate / Editor | timestamp / text | Survey123 editor-tracking system fields (Creator likely blank/shared for anonymous) | system |

### Related: `Attachment`
- 0..n photos per EquipmentReport (Survey123 attachment table keyed by parent globalid). Observed: single image-upload question → typically 0..1.

### Known integrity weaknesses of the as-is model
1. Park is a **string, not an entity** → duplicates/typos fragment aggregations.
2. Park amenities (surface? no — surface is per-playground; fountains, washroom) are **repeated and nullable** per equipment row; honor-system "once per park".
3. Ambiguity: `surfacing_material` sits in the "Park info" group, but a park can have multiple play areas with different surfaces; currently it behaves as a per-record value (donuts count records, not parks).
4. Updates are new rows — **no versioning or supersession** link.
5. No contributor identity, no verification status.

---

## B. Conceptual target model (normalized)

```
┌──────────────┐ 1      n ┌────────────────────┐ 1     n ┌──────────────┐
│    PARK      │──────────│  EQUIPMENT_ITEM    │─────────│    PHOTO     │
└──────────────┘          └────────────────────┘         └──────────────┘
   ▲    │ 1                        ▲ n
   │    └────────n───┐             │ (observation history)
   │                 ▼             │
   │        ┌──────────────┐   ┌───┴──────────────┐
   └────────│  AMENITY     │   │  OBSERVATION /   │n────1┌─────────────┐
            │ (fountains,  │   │  SUBMISSION      │──────│ CONTRIBUTOR │
            │  washroom…)  │   └──────────────────┘      │ (optional)  │
            └──────────────┘                              └─────────────┘
```

### PARK
- id, name (unique-ish, with aliases), centroid or boundary geometry (optional), city/region, created/updated.
- Amenities either as columns (washroom_nearby bool, water_fountain_count int) or a child AMENITY table if the list grows.

### EQUIPMENT_ITEM
- id, park_id (FK), point geometry, equipment_type (lookup), age_group (lookup), surfacing_material (lookup — per item or per play area), current_condition (derived from latest observation), status (active/removed), created/updated.

### OBSERVATION (a.k.a. submission)
- id, equipment_item_id (FK, nullable when reporting a brand-new item), observed_condition, notes, observed_at, contributor_id (nullable/anonymous), moderation_status {pending, approved, rejected}.
- Preserves the "update existing" story the MVP promises but can't deliver: condition history over time.

### PHOTO
- id, observation_id (FK), file ref/URL, exif-stripped, moderation_status.

### Lookup tables (seed from observed domains)
- equipment_type: Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers.
- age_group: Toddler (6–23 months), Pre-schoolers (2–5 years), School-age (5–12 years).
- surfacing_material: Rubber, Wood Chips, Sand (extensible: Engineered Wood Fiber, Poured-in-place, Grass, Asphalt…).
- condition: Like New, Acceptable, Very old (consider ordinal scale rename: Good / Fair / Poor).

### Geographic data
- EQUIPMENT_ITEM.geometry: Point, WGS84 storage recommended.
- PARK.geometry: optional Point (centroid) in v1; Polygon later enables true spatial join ("which park is this pin inside?") and fixes park identity at capture time.

### Migration note
The 41 existing records map cleanly: distinct park_name → PARK rows (10); each row → one EQUIPMENT_ITEM + one initial OBSERVATION; attachments → PHOTO. Fountain/washroom values: take max/any non-null per park.

### Explicit accessibility extension (aligns with project name, absent from MVP)
Reserve an optional attribute block — on PARK: accessible_parking, accessible_washroom, paths_to_playground; on EQUIPMENT_ITEM: wheelchair_accessible, transfer_station, inclusive_design (bool/enum). Not in the current schema; listed as nice-to-have in `09`.
