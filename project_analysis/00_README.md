# Project Analysis Package — Playground Accessibility MVP (ArcGIS → Rebuild)

Reverse-engineering documentation for **"Find the Perfect Playground: A Guide to Ontario's Play Areas"**, an MVP built on ArcGIS StoryMaps + Survey123 + Dashboards. Purpose: give an AI coding agent everything needed to understand the existing product before rebuilding it as an independent web application.

## Reading order
| File | Answers |
|---|---|
| 01_PROJECT_OVERVIEW.md | What is it, for whom, why, current dataset snapshot |
| 02_CURRENT_FEATURES.md | Complete feature inventory of all three components |
| 03_USER_PERSONAS.md | Five personas, goals, pain points, persona×component matrix |
| 04_USER_WORKFLOWS.md | End-to-end journeys and system data flow |
| 05_SURVEY_ANALYSIS.md | Every form field, type, validation, defects (the field table) |
| 06_MAP_ANALYSIS.md | Layers, geometry, symbology, spatial interactions; essential vs optional GIS |
| 07_DASHBOARD_ANALYSIS.md | Every widget, its statistic, verified cross-filter behavior |
| 08_DATA_MODEL.md | As-is flat model + conceptual normalized target + migration note |
| 09_IMPROVEMENT_OPPORTUNITIES.md | Strengths/weaknesses; must-have / nice-to-have / don't-rebuild |
| 10_ASSUMPTIONS.md | Inferences with confidence levels; validation checklist for the owner |

## How a coding agent should use this
1. Read 01–04 for product context; treat 09's "Must-have" list as the parity spec.
2. Implement the form from 05, the map from 06, the analytics from 07, on the schema in 08.
3. Before coding, resolve the "Missing information" items in 10 (especially: export the real feature-layer data for migration).
4. Do not replicate items under "Do NOT rebuild" (09) or the defects flagged in 05.

Evidence basis: 11 screenshots of the live apps (form, story, dashboard incl. two filtered states) + survey item metadata. Anything not directly observed is flagged in 10_ASSUMPTIONS.md.
