# 02 — Current Feature Inventory

Complete inventory of observed functionality, by component. Deep dives: survey → `05`, map/GIS → `06`, dashboard → `07`.

---

## A. StoryMap features

### Page structure & sections (in order)
1. **Cover** — full-width hero photo of a colorful playground; title; subtitle ("Helping families discover playgrounds that match their children's ages and interests."); author byline (Kifah Owda); publish date (March 20, 2025).
2. **Project Description** — paragraph: interactive map of playground equipment across Ontario; explore by equipment type, age suitability, and condition; promises step-by-step guidance through the project.
3. **Section separator** (thin horizontal rule) — used between every major section.
4. **"How we collect the data? System of Record"** — explains the survey collected park names, general facilities (washroom availability, water fountains), and equipment details (type, recommended age group, surface material, overall condition).
5. **"Contribute to the Map!"** — call to action with short survey link `https://arcg.is/1n5O5H0` and an **embedded Survey123 link card** (title "Playground Equipment", thumbnail, description — note: description still shows leftover pothole-template text; see `05`).
6. **"System of Insights: Playground Insights Hub"** —
   - Explanatory paragraph of the dashboard.
   - **Legend explanation in prose**: green circle = Toddler (6–23 months), cyan diamond = Pre-school (2–5 years), pink triangle = School age (5–12 years).
   - Side-by-side layout: text left, **static/embedded map image** right with caption "PlayGround Equipment by Age Group" (imagery basemap, labeled parks: Chalkfarm/Downsview area, Glenfield-Jane Heights, Northwood Park, Spenvalley Park, Stanley Park).
   - Checkmark bullet list of dashboard capabilities: view park facilities and available equipment; understand recommended age group and equipment conditions; filter by area or select a specific park.
7. **Embedded live Dashboard** — the full "Play Ground Equipment by Age Group and Conditions" dashboard iframe, with expand button; caption "ArcGIS Dashboards".
8. **"Interact with the map"** — numbered how-to instructions:
   1. Filter by park via the park-name list on the right.
   2. Filter by area by zooming the map in/out.
   3. Filter by equipment type via the bar chart.
   4. Filter by equipment condition via the pie chart.
9. **"System of Engagement: Community Engagement & Impact"** — text + stock photo (family on swings): invites adding new playground details or updating existing ones via the survey; encourages local communities and city planners to use the data to improve playground conditions and accessibility; closing line "Let's build a more family-friendly Ontario together!"

### Navigation & interaction
- Single-page vertical scroll narrative (classic StoryMap pattern); sticky top header bar shows story title.
- Share button and overflow (…) menu in header.
- Inline hyperlinks (survey short link), embedded interactive iframes (survey card, dashboard), expand-to-full-screen on the dashboard embed.
- No sidecar/slideshow blocks, no scroll-driven map animations, no navigation menu/table of contents observed.

### Media
- Hero playground photo (stock).
- Static map screenshot with caption.
- Embedded live dashboard.
- Survey link card with thumbnail (playground photo).
- Stock photo of family at playground.

### Storytelling approach
Problem → data collection method → insights tool → how-to → call to action. Frames the product as three systems (Record / Insights / Engagement). Written for a general audience; instructional tone.

---

## B. Survey123 features (form: "Report Playground Equipments")

Form subtitle: *"Report on playground facilities and equipment age appropriate"*. Public web form (embedded in StoryMap and direct link), green theme, grouped sections with collapse toggles.

### Field table

| # | Field | Type | Purpose | Required | Notes |
|---|---|---|---|---|---|
| 1 | Park / Playground Name | Single-line text | Identifies the park; also drives the dashboard park list & grouping | **Yes** | Free text — no picklist; same park must be retyped identically per equipment record (data-quality risk) |
| 2 | Playground Surfacing Material | Single select (dropdown) | Ground surface under equipment | No | Observed domain values (from dashboard): Rubber, Wood Chips, Sand. "-Please select-" placeholder |
| 3 | How Many Water Fountains? | Number | Park amenity count | No | Hint: "Please answer this only once per park" — manual dedup convention, not enforced |
| 4 | Washroom near the playground? | Single select (radio) | Park amenity flag | No | Yes/No; same "only once per park" hint |
| 5 | Equipment type | Single select (dropdown) | Equipment classification | **Yes** | Observed domain: Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers |
| 6 | Age Group | Single select (dropdown) | Recommended age range | **Yes** | Domain: Toddler (6–23 months), Pre-schoolers (2–5 years), School-age (5–12 years) |
| 7 | Equipment Conditions | Single select (dropdown) | Condition assessment | **Yes** | Domain: Like New, Acceptable, Very old |
| 8 | Please upload an image of the equipment | Image upload | Photo evidence | No | Drag-and-drop zone + camera icon; stored as feature attachment |
| 9 | Any notes? | Single-line text | Free-form comments | No | |
| 10 | Playground equipments (location) | Geopoint (map) | Equipment location | Effectively yes (geometry) | Interactive map: address/place search box, zoom +/−, home, use-my-location, fullscreen; manual Lat/Lon entry fields; imagery basemap (Toronto-area attribution); browser-geolocation error banner when location sharing is off |
| — | Submit | Button | Writes record + attachment to hosted feature layer | — | Anonymous public submission (no sign-in observed) |

### Form structure & logic
- Two visible groups: **Park info** (fields 1–4) and **Equipment Information** (fields 5–10).
- **One submission = one piece of equipment**; park-level info is re-entered on each submission (flat/denormalized capture — see `08_DATA_MODEL.md`).
- No conditional visibility/skip logic observed; no calculated or hidden fields observed (cannot be fully ruled out — see `10`).
- Validation observed: required-field enforcement (red asterisks), numeric input mask on the fountain count, geolocation error handling on the map question.

### Known form defects (carry into rebuild as "fix, don't replicate")
- Survey item metadata (thumbnail card description) still contains the Esri **pothole-report template text** ("Report road potholes that require maintenance…") — the form was built from a template and the summary was never updated.
- Grammatical issues ("Playground Equipments", "equipment age appropriate").
- Park-level questions repeated per equipment submission with only an honor-system hint.

---

## C. Dashboard features ("Play Ground Equipment by Age Group and Conditions, Ontario, Canada")

Dark-theme ArcGIS Dashboard; also rendered in a light theme when embedded in the StoryMap on some views.

### Widgets
| Widget | Type | Content / data |
|---|---|---|
| Header | Title bar | Dashboard title |
| Equipment Types by Age Group | Stacked bar (serial) chart | X = equipment type (Tubes, Swings, Spring riders, Slides, See saws, Merry Go Round, Climbers); stacks + legend = age group (blue Pre-schoolers, magenta School-age, green Toddler); Y = count of equipment |
| Equipment Conditions | Donut (pie) chart | Like New 51.22%, Acceptable 34.15%, Very old 14.63% (of 41 records) |
| Map | Map widget | Imagery basemap; equipment point layer symbolized by age group (green circle / cyan-blue diamond / pink triangle); layer-list button; zoom/pan |
| Number of Parks | Indicator (count + icon) | 10 (distinct park count) |
| Park / Play Ground Name | List (selector) | Alphabetical park list; scrollable; click to select/filter (selected row highlights green) |
| Water | Indicator | 9 (parks with water fountains — interpretation, see `10`) |
| Washroom | Indicator | 9 (parks with washroom nearby) |
| Play Ground Surface Area | Donut chart | Wood Chips 48.78%, Rubber 36.59%, Sand 14.63% |

### Interactions (verified across filtered screenshots)
- **Park list selection acts as a global filter**: selecting "DownsView Park" or "Edithvale Park" re-filters the bar chart, both donuts, the Water/Washroom indicators, Number of Parks (→1), and zooms/filters the map to that park.
- **Map-extent filtering**: panning/zooming filters connected widgets (documented in the StoryMap's own how-to).
- **Chart cross-filtering**: bar chart (equipment type) and condition donut act as filters per the StoryMap instructions.
- Map layer list toggle; "Powered by Esri" attribution.

### Not observed
- No table widget, no date/time filtering, no embedded content widgets, no edit capability, no export button, no legend widget separate from chart legends (age-group legend lives in the bar chart; map symbology legend is explained in StoryMap prose).

---

## D. Cross-cutting / platform features (implicit, provided by ArcGIS Online)
- Hosted feature layer storing submissions (point geometry + attributes + photo attachments), auto-created by Survey123.
- Anonymous public submission; public read access for dashboard/map.
- Near-real-time propagation from survey submission → feature layer → dashboard.
- Hosting, TLS, scaling, basemaps (Esri World Imagery), geocoding for the address search in the geopoint question.
- Item sharing/permissions, and the Survey123 website's built-in data/Analyze tabs available to the owner (standard capability; not directly observed).
