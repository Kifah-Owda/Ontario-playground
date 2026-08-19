# 07 — Dashboard Analysis (ArcGIS Dashboards)

**Title:** "Play Ground Equipment by Age Group and Conditions, Ontario, Canada"
**Theme:** Dark (standalone); embedded StoryMap views show both dark and light renderings.
**Data source:** the single Survey123 hosted feature layer (equipment points). Every widget aggregates the same layer.

---

## Layout (desktop)

```
┌─────────────────────────────── Header: title ───────────────────────────────┐
├──────────────────────┬───────────────────────────┬──────────────────────────┤
│ Equipment Types by   │                           │ Number of Parks   [10]   │
│ Age Group            │                           ├───────────────┬──────────┤
│ (stacked bar chart)  │        MAP                │ Park/Play     │ Water  9 │
├──────────────────────┤  (imagery + age-group     │ Ground Name   ├──────────┤
│ Equipment Conditions │   symbols, layer list)    │ (list, scroll)│ Washrm 9 │
│ (donut)              │                           ├───────────────┴──────────┤
│                      │                           │ Play Ground Surface Area │
│                      │                           │ (donut)                  │
└──────────────────────┴───────────────────────────┴──────────────────────────┘
```

## Widget-by-widget specification

### 1. Header
Static title text. No date selector, no logo, no links.

### 2. "Equipment Types by Age Group" — serial (stacked bar) chart
- **Category axis:** Equipment type — Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers.
- **Split-by / stacks:** Age Group. Legend: 🔵 Pre-schoolers (2–5 years), 🟣 School-age (5–12 years), 🟢 Toddler (6–23 months).
- **Value axis:** count of equipment records (max observed ≈ 14–16 for Swings).
- Observed global distribution (approx., from bar heights): Swings 14, Climbers 11, Slides 9, See saws 3, Spring riders 2, Tubes 1, Merry Go Round 1 — total 41, consistent with donut math.
- **Acts as a filter**: clicking a bar/category filters other widgets (per StoryMap instructions).
- Re-renders under selection (verified: Downsview shows Tubes/Swings/Slides/Climbers = 1 each; Edithvale shows Swings 2, Slides 1, See saws 1, Climbers 2).

### 3. "Equipment Conditions" — pie/donut chart
- Slices with % labels. Global: **Like New 51.22% (21), Acceptable 34.15% (14), Very old 14.63% (6)** → n = 41.
- Colors: green (Like New), grey (Acceptable), red/pink (Very old).
- Acts as a filter (per StoryMap how-to). Re-renders under park selection (Downsview: Like New 75% / Acceptable 25%; Edithvale: Like New 66.67% / Acceptable 33.33%).

### 4. Map widget (center)
- World Imagery basemap; equipment point layer with age-group symbology (see `06_MAP_ANALYSIS.md`).
- Layer-list button (top-right). Zoom/pan.
- **Extent filters other widgets**; **park selection zooms the map** to the selected park's cluster (verified at parcel-level zoom for Downsview and Edithvale).

### 5. "Number of Parks" — indicator
- Icon (ferris wheel) + big number. Global **10**; becomes **1** under a park selection.
- Statistic: count distinct of Park/Playground Name (inferred; ArcGIS Dashboards indicators can't do true count-distinct natively — may be a filtered count of a park-level view, or the data simply has consistent names. Verify; see `10`).

### 6. "Park / Play Ground Name" — list (selector) widget
- Alphabetical, scrollable: DownsView Park, Driftwood Park, Earl Bales Park, Edithvale Park, Futura Parkette, Irving W. Chapley Community Centre, McAllister Park, Painswick Park, Spenvalley Park, Stanley Park.
- **Single-select global filter**; selected row highlighted green; re-click/none to clear (standard).

### 7. "Water" — indicator
- Faucet icon + **9** globally; **1** under a single-park selection.
- Interpretation: number of parks reporting ≥1 water fountain (or sum/count of records with a fountain value — the per-park "1" under selection suggests park-level semantics). Field source: "How Many Water Fountains?". Verify exact statistic — see `10`.

### 8. "Washroom" — indicator
- Restroom icon + **9** globally; **1** under selection. Count of parks with Washroom = Yes (same caveat as Water).

### 9. "Play Ground Surface Area" — donut
- Global: **Wood Chips 48.78% (20), Rubber 36.59% (15), Sand 14.63% (6)** of 41 records.
- Despite the name "Surface *Area*", it is a **count of records by Surfacing Material**, not measured area.
- Re-renders under selection (Downsview: Rubber 50 / Wood Chips 50; Edithvale: Rubber 66.67 / Wood Chips 33.33).

## Interaction model (verified)
- The park list, map extent, bar chart, and condition donut all act as **cross-filters**; all widgets subscribe to all filters (classic ArcGIS Dashboards action wiring).
- Selection state is visually indicated (green highlight in list).
- Expand-to-fullscreen available on the StoryMap embed.

## Gaps / not present
- No data table, no export/download, no date filter or time series (submission dates exist in the layer but are unused), no photo display in the dashboard, no legend widget for map symbols, no mobile-specific layout observed, no auto-refresh interval confirmed.

## Rebuild translation
Must-have equivalents: choropleth-free point map + 2 donuts + 1 stacked bar + 3 KPI indicators + park selector, all bound to one filter state (park, map bounds, equipment type, condition). This is a straightforward single-page app pattern: shared filter store → parameterized aggregate queries → chart library + web map, with URL-encodable filter state as an improvement.
