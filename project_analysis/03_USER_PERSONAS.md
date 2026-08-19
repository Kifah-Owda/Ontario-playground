# 03 — User Personas

Personas grounded in the MVP's own language ("families", "contribute to the map", "local communities and city planners") plus the roles inherent to operating the system. Ranked by importance to the current product.

---

## P1. Parent / Caregiver (primary consumer)
- **Who**: Parent, grandparent, nanny, or daycare provider planning outings for a child of a specific age. Mobile-heavy usage; low GIS literacy.
- **Goals**: Find a nearby playground that suits their child's age; avoid wasted trips to unsuitable or run-down playgrounds.
- **Actions**: Opens StoryMap or dashboard link (often from social media); reads the legend; filters by park or zooms to their neighborhood; checks equipment types, age-group symbols, condition, surfacing, washroom/water availability.
- **Information needed**: Playground location; equipment list per park; age suitability; condition; surface material (relevant for toddlers/mobility); washrooms; water fountains; photos.
- **Problems solved**: "Which playground near me is right for my 18-month-old?" "Does it have a washroom?" "Is the equipment in decent shape?"
- **Pain points in current MVP**: Legend explained only in StoryMap prose, not on the map; free-text park names; no directions/address per park; dashboard not obviously mobile-optimized; no search by "near me."

## P2. Community Data Collector / Volunteer (primary contributor)
- **Who**: Resident (often also a parent) who visits playgrounds and submits observations; recruited by the "Contribute to the Map!" call to action. May overlap heavily with P1.
- **Goals**: Add missing playgrounds; update stale or incorrect records; feel their contribution appears on the map.
- **Actions**: Opens survey (short link or embedded); enters park name and amenities; for each piece of equipment, selects type/age/condition, drops a map pin (or uses device GPS / address search / manual lat-lon), attaches a photo, adds notes, submits; repeats per equipment item.
- **Information needed**: Clear field definitions; confirmation of successful submission; ideally, existing records so they don't duplicate.
- **Problems solved**: "The map is missing my local park." "This slide is broken now."
- **Pain points**: Must re-enter park info for every equipment item; must remember the "answer only once per park" convention; no way to see or edit their own past submissions; no duplicate-park detection; typo-prone free-text park names.

## P3. Administrator / Project Owner (operator)
- **Who**: The MVP author (single ArcGIS Online account owner). Builds and maintains the survey, dashboard, StoryMap, and feature layer.
- **Goals**: Keep data clean and trustworthy; grow contributions; evolve the product; eventually migrate off ArcGIS licensing.
- **Actions**: Edits form/dashboard/story in ArcGIS builders; reviews submissions in the Survey123 data tab or feature-layer table; fixes/merges/deletes bad records; manages sharing settings; monitors usage.
- **Information needed**: Raw submission table with attachments; edit access; duplicate/quality flags; usage stats.
- **Problems solved**: "Is the crowdsourced data accurate and consistent?" "How do I fix 'Downsview' vs 'DownsView Park'?"
- **Pain points**: No moderation/approval queue — submissions are live immediately; data cleanup requires ArcGIS tooling; single-owner bus factor; license cost.

## P4. City Planner / Parks & Recreation Staff (secondary consumer)
- **Who**: Municipal staff or community-association organizer; explicitly invited by the StoryMap to use the data "to improve playground conditions and accessibility."
- **Goals**: Identify playgrounds with aging/"Very old" equipment; understand equipment/age-group coverage gaps by area; justify maintenance and investment.
- **Actions**: Explores dashboard aggregates (condition donut, surface donut, type-by-age bars); filters by park/area; would want data export (not currently exposed in the dashboard).
- **Information needed**: Condition distributions, per-park inventories, locations, dates of observation (not currently shown), data provenance/reliability.
- **Problems solved**: "Where should we prioritize playground renewal?"
- **Pain points**: Crowdsourced data is unverified; no export/report; no observation timestamps or contributor counts visible; small sample (10 parks).

## P5. Researcher / Advocate (tertiary)
- **Who**: Accessibility advocate, public-health or urban-planning researcher, journalist.
- **Goals**: Analyze playground equity/accessibility patterns; reuse the dataset.
- **Actions**: Reads StoryMap for methodology; explores dashboard; would request the raw dataset.
- **Information needed**: Methodology, field definitions, raw data download, license/terms of the data.
- **Pain points**: No data dictionary or download published; "accessibility" is aspirational — the current schema captures age suitability and condition, not disability-accessibility attributes (ramps, transfer stations, inclusive equipment, accessible surfacing certification).

---

## Persona → component matrix

| Persona | StoryMap | Survey | Dashboard | Admin tools (ArcGIS) |
|---|---|---|---|---|
| P1 Parent | Read | Rare | **Primary** | — |
| P2 Collector | Entry point | **Primary** | Verify their pin appears | — |
| P3 Admin | Author | Author | Author | **Primary** |
| P4 Planner | Read | — | **Primary** | Would want export |
| P5 Researcher | Read (method) | — | Read | Would want export |
