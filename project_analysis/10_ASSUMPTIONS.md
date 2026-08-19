# 10 — Assumptions, Inferences & Open Questions

Everything in this package that was **inferred** rather than directly observed in the provided screenshots, plus information that is **missing** and should be validated before implementation.

## Evidence basis
- 11 screenshots covering: the full Survey123 form (3), the StoryMap top-to-bottom (5, including embedded survey card and embedded dashboard), and the standalone dashboard in default + two park-filtered states (3).
- Live URLs were not machine-fetchable during analysis; one earlier successful metadata fetch of the survey share page confirmed the item title "Playground Equipment" and the leftover pothole-template description.

## Inferences made (with confidence)

| # | Inference | Basis | Confidence |
|---|---|---|---|
| 1 | Total equipment records = **41** | Condition donut 51.22/34.15/14.63% = 21/14/6 of 41; surface donut 48.78/36.59/14.63% = 20/15/6 of 41 | High |
| 2 | Choice lists for equipment type, age group, condition, surface | Read off dashboard chart categories/legends, which reflect actual submitted values; unused extra choices in the form can't be ruled out | High for observed values; Medium for completeness |
| 3 | Backing store is a Survey123-created hosted feature layer with system fields (globalid, CreationDate, …) and photo attachments | Standard Survey123 architecture | High |
| 4 | Survey authored in web designer from an Esri template | Share-URL pattern; leftover pothole description in item summary | High |
| 5 | Anonymous public submission (no login) | Form loads and is fillable with no sign-in prompt in screenshots | High |
| 6 | Bar chart, condition donut, and map extent act as filters | Stated in the StoryMap's own "Interact with the map" instructions; park-list filtering directly verified | High |
| 7 | Washroom question has a "No" option | Only "Yes" visible (viewport cut); Yes/No is the obvious design | High |
| 8 | Water/Washroom indicators = count of **parks** with fountains/washroom (9 of 10) | Both show 1 under single-park selection; phrasing of park-level questions | Medium — could be count of records with non-null values |
| 9 | "Number of Parks" = distinct park names | Value 10 matches the 10-item park list | Medium (mechanism unclear; Dashboards lacks native count-distinct) |
| 10 | Map popups enabled with attribute + photo | Standard default; not screenshotted | Medium |
| 11 | Thank-you/confirmation screen after submit | Survey123 default | Medium |
| 12 | Bar-height readings (Swings 14, Climbers 11, Slides 9, See saws 3, Spring riders 2, Tubes 1, Merry-go-round 1) | Visual estimation against axis | Medium — verify against exported data |
| 13 | Storage projection Web Mercator, input WGS84 | ArcGIS Online defaults | High |
| 14 | Data concentrated in Toronto/North York + Barrie (Painswick) | Map states + park names | High |

## Missing information — validate with the owner before build

**Data & schema**
1. Export of the actual feature layer (field names, exact coded-value domains, null rates) — the single most valuable artifact for migration.
2. Whether the image question allows >1 photo; max attachment size.
3. Any hidden/calculated fields, or additional survey pages not visible in screenshots (none apparent, but confirm).
4. Whether any records were admin-edited or deleted (data-quality history).

**Product / operational**
5. Update cadence and whether contributors were coordinated (a class/community group?) — affects trust model.
6. Who besides the author needs admin access in the rebuild.
7. Moderation policy the owner wants (pre- vs post-publication).
8. Whether "accessibility" in the project vision means disability accessibility (schema extension required) or just general family-friendliness — current schema supports only the latter.
9. Expected geographic scope (Toronto? Ontario? beyond?) and expected data volume — affects clustering/search decisions.
10. Budget/hosting constraints and any preferred open-source stack (deferred to Phase 2 architecture).

**Behavioral confirmations (10-minute owner checklist)**
11. Click a map point → screenshot the popup.
12. Click a bar and a donut slice → confirm cross-filter direction(s).
13. Submit a test record → confirm thank-you screen and time-to-appear on dashboard.
14. Open Survey123 Data tab → screenshot column headers (real field names).

## Explicit non-goals of this package
- No final architecture, stack selection, SQL, or code (Phase 2).
- No redesign of the visual identity — only documentation of what exists and scoped recommendations tied to this playground project.
