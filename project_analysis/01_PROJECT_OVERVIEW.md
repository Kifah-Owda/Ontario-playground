# 01 — Project Overview

## Product name (as published)
**"Find the Perfect Playground: A Guide to Ontario's Play Areas"**
- Author: Kifah Owda
- Published: March 20, 2025
- Tagline: *"Helping families discover playgrounds that match their children's ages and interests."*

## What this document package is
A reverse-engineering of an existing MVP built on three ArcGIS Online SaaS components:

| Component | ArcGIS Product | Role in the system |
|---|---|---|
| Public narrative site | ArcGIS StoryMaps | Landing page, project explanation, entry point to survey + dashboard |
| Data collection form | ArcGIS Survey123 (form: "Report Playground Equipments") | Crowdsourced field data entry, one submission per piece of playground equipment |
| Analytics view | ArcGIS Dashboards ("Play Ground Equipment by Age Group and Conditions, Ontario, Canada") | Interactive map + charts + indicators over the collected data |

All three are stitched together by the StoryMap, which embeds the survey and the dashboard inline. The underlying data store is an ArcGIS Online **hosted feature layer** automatically created by Survey123 (point geometry + attributes + photo attachments).

## Problem the MVP solves
Parents and caregivers in Ontario have no easy way to know **which playgrounds suit their child** before visiting: what equipment exists, what age range it targets, what condition it is in, what the ground surface is, and whether basic amenities (washrooms, water fountains) are nearby. Municipal open data rarely captures equipment-level detail or condition, and it is not presented in a family-friendly way.

The MVP's own framing (from the StoryMap) describes three subsystems:
1. **System of Record** — the Survey123 form collecting park + equipment data.
2. **System of Insights** — the "Playground Insights Hub" dashboard for exploring the data.
3. **System of Engagement** — the StoryMap narrative inviting the community to contribute and inviting city planners to use the data to improve playground conditions and accessibility.

## Target users
- **Parents / caregivers** choosing a playground for a specific child age (primary audience).
- **Community members / volunteers** who submit playground and equipment observations.
- **Local communities and city planners** — explicitly invited in the StoryMap to use the data to improve playground conditions and accessibility.
- **The project owner/administrator** who curates data and maintains the apps.

(Full personas in `03_USER_PERSONAS.md`.)

## Main purpose
Enable communities to **collect, visualize, and analyze playground equipment data** (type, age suitability, condition, surfacing, amenities) across Ontario, and present it so families can pick the right playground.

## Value proposition
- For families: one interactive place to compare playgrounds by age suitability, equipment mix, condition, and amenities — instead of visiting blind.
- For contributors: a frictionless public web form (no login) with map-based location capture and photo upload.
- For planners: crowdsourced, geolocated, equipment-level condition data that municipal inventories typically lack.

## How users interact with the product (high level)
1. User lands on the **StoryMap** (shared via link/social media — the observed URL carries a Facebook click ID, indicating social distribution).
2. They read the project description and the legend explanation (symbol shapes/colors = age groups).
3. They either:
   - **Contribute**: open the embedded Survey123 form (also shareable directly via short link `arcg.is/1n5O5H0`), fill in park info, equipment info, drop a pin on the map, optionally attach a photo, and submit anonymously; or
   - **Explore**: use the embedded dashboard (also available standalone) to filter by park, map extent, equipment type, or condition.
4. Submissions write to the hosted feature layer and appear in the dashboard/map (near real time, standard Survey123 → Dashboards behavior).

## Current dataset snapshot (observed at time of analysis)
- **10 parks**, concentrated in the Toronto/North York area plus at least one in Barrie (Painswick Park).
- **41 equipment records** (inferred: condition donut percentages 51.22% / 34.15% / 14.63% correspond exactly to 21 / 14 / 6 of 41).
- 9 of 10 parks report water fountains; 9 of 10 report a nearby washroom (interpretation of the "Water: 9" and "Washroom: 9" indicators; see `10_ASSUMPTIONS.md`).
- Parks list: DownsView Park, Driftwood Park, Earl Bales Park, Edithvale Park, Futura Parkette, Irving W. Chapley Community Centre, McAllister Park, Painswick Park, Spenvalley Park, Stanley Park.

## Rebuild intent (owner's stated goal)
The owner intends to rebuild this as an **independent web application on open/affordable technologies**, removing the ArcGIS Online licensing dependency while preserving the collect → visualize → analyze loop. This package documents *what exists* so a coding agent can rebuild it; it deliberately does **not** prescribe the final architecture.

## How to read this package
- `02_CURRENT_FEATURES.md` — complete feature inventory across all three components.
- `03_USER_PERSONAS.md`, `04_USER_WORKFLOWS.md` — who uses it and how, end to end.
- `05_SURVEY_ANALYSIS.md` — every form field, type, validation, and known form defects.
- `06_MAP_ANALYSIS.md` — GIS/mapping requirements: layers, geometry, symbology, interactions.
- `07_DASHBOARD_ANALYSIS.md` — every widget, its data source, and cross-filter behavior.
- `08_DATA_MODEL.md` — inferred conceptual data model (current flat model + normalized target concept).
- `09_IMPROVEMENT_OPPORTUNITIES.md` — strengths/weaknesses and must/nice/don't-rebuild lists.
- `10_ASSUMPTIONS.md` — everything inferred rather than directly observed; validate before build.
