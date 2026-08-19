# 06 — Map / GIS Analysis

Mapping appears in three places: (1) the geopoint question inside the survey, (2) the central map widget in the dashboard, (3) a static map image in the StoryMap. This file specifies the GIS requirements they imply.

---

## 1. Layers

| Layer | Type | Source | Used in |
|---|---|---|---|
| Playground Equipment (submissions) | Point feature layer (operational layer) | Survey123 hosted feature layer | Dashboard map; StoryMap static image |
| Basemap — World Imagery | Raster tile basemap | Esri (attribution observed: Earthstar Geographics / City of Toronto / Microsoft / Vantor / HERE / Garmin / iPC / NRCan) | Dashboard map, survey geopoint map |
| Reference labels/boundaries | Vector reference layer (place labels, admin boundaries, roads visible over imagery) | Esri hybrid reference layer | Dashboard map at small scales |

Only **one operational layer** exists. There is no separate "Parks" polygon layer — park identity lives purely in the attribute `Park / Playground Name`.

## 2. Geometry types
- **Point** only (one point per equipment item). No lines, no polygons. Multiple points cluster within a park footprint (visible at Downsview/Edithvale zoom levels).

## 3. Location data & spatial reference
- Captured via geopoint question: device GPS, geocoded address search, tap-to-place pin, or manual lat/lon (decimal degrees → WGS84 / EPSG:4326 input; ArcGIS hosted layers store Web Mercator EPSG:3857 by default — standard, verify).
- Extent of current data: Southern Ontario — Toronto/North York cluster + Barrie (Painswick Park pink triangle visible near Barrie).

## 4. Symbology
**Unique-value renderer on Age Group**, varying both shape and color:

| Age group | Symbol |
|---|---|
| Toddler (6–23 months) | Green circle ● |
| Pre-schoolers (2–5 years) | Cyan/blue diamond ◆ |
| School-age (5–12 years) | Pink/magenta triangle ▲ |

- Legend is **not** rendered on the map itself; it is explained in StoryMap prose and duplicated (with different colors: blue/magenta/green) in the dashboard bar-chart legend. Note the inconsistency: map uses cyan diamond for pre-school while the bar chart uses blue; rebuild should unify the palette.
- No clustering, no heatmaps, no size ramps observed.

## 5. Pop-ups
- Not captured in screenshots. A pop-up on the equipment layer is standard and almost certainly enabled with the field list (park name, type, age group, condition, surface, notes, photo attachment). **Unverified — see `10_ASSUMPTIONS.md`.** For rebuild: treat "click a point → see full record incl. photo" as a must-have regardless.

## 6. Filters & spatial interactions (dashboard map)
- **Map extent acts as a spatial filter** on other widgets (documented in StoryMap how-to; consistent with observed behavior).
- Map responds to widget selections: selecting a park in the list zooms/filters the map to that park's points (verified: Downsview, Edithvale states).
- Layer-list control (top-right icon) to toggle layers.
- Zoom in/out; pan. No basemap switcher, measure, draw, or bookmarks observed.

## 7. Search
- **Survey geopoint map**: address/place search box (Esri World Geocoder).
- **Dashboard map**: no search box observed — park lookup is done via the list widget instead. A map search is a candidate improvement.

## 8. Spatial relationships
- Implicit only: equipment points ↔ park is an **attribute** relationship (shared name string), not a spatial join. No polygons, buffers, routing, or proximity analysis exist.
- "Filter by area = zoom the map" is the only spatial query (bounding-box intersection).

## 9. Essential vs. optional GIS capability (for rebuild)

**Essential**
- Point layer over a good basemap (imagery or streets) with categorical symbology by age group + on-map legend.
- Click point → popup with attributes + photo.
- Extent-driven filtering synced with charts/indicators.
- Geopoint capture in the form: GPS, pin-drop, address geocode, manual lat/lon, with permission-denied fallback.
- Web Mercator tiles + WGS84 storage (standard web stack: e.g., MapLibre/Leaflet + OSM/imagery tiles + PostGIS — architecture decision deferred).

**Optional / later**
- Park polygons or park centroids as a second layer (would fix the park-identity problem elegantly).
- Marker clustering at small scales; "near me" geolocation on the public map; map search bar; basemap toggle (imagery ↔ streets); offline capture; routing/directions to a park.

**Not needed (never used in MVP)**
- Line/polygon editing, advanced geoprocessing, 3D scenes, tracking.
