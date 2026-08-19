# 04 — User Workflows

End-to-end journeys through the current MVP. All flows verified against the live UI except where marked *(standard ArcGIS behavior, inferred)*.

---

## W1. Public visitor — discover & explore (P1 Parent)

```
Social/shared link (fbclid observed)
        │
        ▼
StoryMap cover ──▶ Project Description ──▶ "System of Record" section
        │
        ▼
"System of Insights" section (learns symbol legend:
 ● green circle = Toddler 6–23m, ◆ cyan diamond = Pre-school 2–5y, ▲ pink triangle = School-age 5–12y)
        │
        ▼
Embedded dashboard (or expand to full-screen standalone dashboard)
        │
        ├─ select park in list ──▶ all widgets + map filter to that park
        ├─ zoom/pan map ─────────▶ widgets filter to visible extent
        ├─ click bar (equip type)▶ cross-filter
        └─ click donut (condition)▶ cross-filter
        │
        ▼
Decision: "Edithvale Park has toddler swings, like-new condition,
 rubber surface, washroom — we'll go there."
```
Exit points: leaves with a park choice; no account, no saved state, no directions link.

## W2. Contributor — submit equipment data (P2 Collector)

```
StoryMap "Contribute to the Map!" ── or ── direct short link arcg.is/1n5O5H0
        │
        ▼
Survey123 web form "Report Playground Equipments" (public, no login)
        │
        ▼
[Park info group]
  Park/Playground Name* (free text)
  Surfacing Material (Rubber | Wood Chips | Sand)
  # Water Fountains (number, "once per park" honor rule)
  Washroom nearby? (Yes/No, "once per park" honor rule)
        │
        ▼
[Equipment Information group]
  Equipment type* ▸ Age Group* ▸ Equipment Conditions*
  Photo (optional, drag-drop or camera)
  Notes (optional)
        │
        ▼
[Location: geopoint map question]
  browser geolocation ──(denied → red error banner)──▶ fallback:
  address/place search ─ or ─ tap/drop pin ─ or ─ type Lat/Lon manually
        │
        ▼
Submit ──▶ record + attachment written to hosted feature layer
        │                                    *(standard behavior)*
        ▼
Thank-you screen *(standard Survey123 behavior, not screenshotted)*
        │
        ▼
Repeat entire form for the NEXT piece of equipment at the same park
(park fields re-entered each time — known friction)
```

## W3. Contributor — update an existing playground
The StoryMap invites "adding new playground details **or updating existing ones** through our survey." There is **no edit flow**: an update is just a *new submission*. Nothing links, versions, or supersedes the old record; reconciliation is manual by the admin. Flag for rebuild.

## W4. Administrator — curate data (P3)

```
Sign in to ArcGIS Online (owner account)
        │
        ├─▶ Survey123 website ▸ survey ▸ Data / Analyze tabs
        │      view records, photos; edit/delete rows; export CSV/GeoJSON/etc.
        │                                  *(standard capability, inferred)*
        ├─▶ Hosted feature layer item ▸ table view / Map Viewer edits
        ├─▶ Survey123 web designer ▸ modify form ▸ republish
        ├─▶ Dashboard builder ▸ modify widgets/filters
        └─▶ StoryMaps builder ▸ edit narrative ▸ republish
```
No approval/moderation queue exists — public submissions are immediately live in the dashboard.

## W5. Planner/Researcher — assess conditions (P4/P5)
StoryMap (methodology) → dashboard → filter to their area/park → read condition & surface distributions and per-park equipment mix → **dead end at export** (no download exposed; must contact owner).

---

## Sequence summary (data flow)

```
Contributor ▶ Survey123 form ▶ ArcGIS hosted feature layer (points + attachments)
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
             ArcGIS Dashboard  ◀── embedded in ──   ArcGIS StoryMap  ◀── Public visitor
             (map, charts, indicators, cross-filters)
```
