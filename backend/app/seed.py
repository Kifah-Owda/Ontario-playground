"""Seed the database with the RECONSTRUCTED MVP dataset.

The original ArcGIS feature layer is not available (owner-confirmed), so this
recreates the documented snapshot: 10 parks, 41 equipment items, with
per-park equipment/conditions matching the dashboard screenshots exactly for
DownsView Park and Edithvale Park, and a plausible distribution elsewhere that
reproduces the validated global totals:
  types:      Swings 14, Climbers 11, Slides 9, See saws 3, Spring riders 2,
              Tubes 1, Merry go round 1
  conditions: Like new 21, Acceptable 14, Very old 6
  amenities:  9/10 parks with water, 9/10 with washroom

Coordinates are approximate park locations (marked here as such); correct them
in the admin console or by editing this file. Accessibility fields are seeded
as NULL (= not yet assessed) since the MVP never collected them.

Usage:  python -m backend.app.seed          (adds data if DB is empty)
        python -m backend.app.seed --force  (wipes everything — parks,
                                             equipment, photos AND their
                                             uploaded files — then re-seeds)
"""
from __future__ import annotations

import sys

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .images import delete_files
from .models import EquipmentItem, Park, Photo, utcnow

T = "Toddler (6-23 months)"
P = "Pre-schoolers (2-5 years)"
S = "School-age (5-12 years)"
LN, AC, VO = "Like new", "Acceptable", "Very old"

# (name, city, lat, lng, surface, washroom, fountains, [(type, age, condition), ...])
PARKS = [
    # Verified per-park breakdowns from dashboard screenshots:
    ("DownsView Park", "Toronto", 43.7420, -79.4780, "Rubber", True, 1, [
        ("Tubes", P, LN), ("Swings", P, LN), ("Slides", P, LN), ("Climbers", S, AC),
    ]),
    ("Edithvale Park", "Toronto", 43.7770, -79.4230, "Rubber", True, 1, [
        ("Swings", T, LN), ("Swings", S, LN), ("Slides", P, AC),
        ("See saws", S, LN), ("Climbers", P, LN), ("Climbers", S, AC),
    ]),
    # Reconstructed (plausible) breakdowns for the remaining eight parks:
    ("Driftwood Park", "Toronto", 43.7600, -79.5140, "Wood chips", True, 1, [
        ("Swings", T, LN), ("Swings", P, AC), ("Slides", P, LN), ("Climbers", S, VO),
    ]),
    ("Earl Bales Park", "Toronto", 43.7520, -79.4350, "Wood chips", True, 2, [
        ("Swings", P, LN), ("Swings", S, AC), ("Slides", T, LN),
        ("Climbers", P, AC), ("Spring riders", P, LN),
    ]),
    ("Futura Parkette", "Toronto", 43.7480, -79.5030, "Sand", False, 0, [
        ("Swings", P, VO), ("Slides", P, AC), ("Climbers", S, VO),
    ]),
    ("Irving W. Chapley Community Centre", "Toronto", 43.7520, -79.4480, "Rubber", True, 1, [
        ("Swings", T, LN), ("Slides", P, LN), ("Climbers", P, LN),
        ("Merry go round", P, AC),
    ]),
    ("McAllister Park", "Toronto", 43.7440, -79.4430, "Wood chips", True, 1, [
        ("Swings", S, LN), ("Climbers", S, AC), ("See saws", P, LN),
    ]),
    ("Painswick Park", "Barrie", 44.3530, -79.6780, "Wood chips", True, 1, [
        ("Swings", S, LN), ("Slides", S, AC), ("Climbers", S, VO),
        ("Spring riders", P, AC),
    ]),
    ("Spenvalley Park", "Toronto", 43.7410, -79.5080, "Sand", True, 1, [
        ("Swings", T, AC), ("Swings", P, LN), ("Slides", T, VO), ("Climbers", P, AC),
    ]),
    ("Stanley Park", "Toronto", 43.6410, -79.4080, "Wood chips", True, 1, [
        ("Swings", P, LN), ("Slides", S, VO), ("Climbers", T, LN),
        ("See saws", S, AC),
    ]),
]


def _check_totals() -> None:
    types: dict[str, int] = {}
    conds: dict[str, int] = {}
    for *_rest, items in PARKS:
        for etype, _age, cond in items:
            types[etype] = types.get(etype, 0) + 1
            conds[cond] = conds.get(cond, 0) + 1
    expected_types = {
        "Swings": 14, "Climbers": 11, "Slides": 9, "See saws": 3,
        "Spring riders": 2, "Tubes": 1, "Merry go round": 1,
    }
    assert sum(types.values()) == 41, types
    assert conds == {"Like new": 21, "Acceptable": 14, "Very old": 6}, conds
    assert types == expected_types, types


def seed(force: bool = False) -> None:
    _check_totals()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.scalar(select(Park.id).limit(1))
        if existing is not None and not force:
            print("Database already has data — use --force to wipe and re-seed.")
            return
        if force:
            # Wipe children before parents: bulk Query.delete() bypasses ORM
            # cascades, so photos must be removed explicitly or the parks
            # delete violates the FK on PostgreSQL (and silently orphans rows
            # on SQLite). Purge the processed files too, after the commit.
            photo_files = [
                (ph.filename, ph.thumb_filename)
                for ph in db.scalars(select(Photo)).all()
            ]
            db.query(Photo).delete()
            db.query(EquipmentItem).delete()
            db.query(Park).delete()
            db.commit()
            for filename, thumb_filename in photo_files:
                delete_files(filename, thumb_filename)
        for name, city, lat, lng, surface, washroom, fountains, items in PARKS:
            park = Park(
                status="approved",
                name=name, city=city, lat=lat, lng=lng,
                surfacing_material=surface,
                washroom_nearby=washroom,
                water_fountains=fountains,
                notes="Seeded from reconstructed ArcGIS MVP snapshot "
                      "(approximate coordinates).",
                approved_at=utcnow(),
            )
            for etype, age, cond in items:
                park.equipment.append(
                    EquipmentItem(equipment_type=etype, age_group=age, condition=cond)
                )
            db.add(park)
        # --- Sample non-playground locations (2026 recreation-location model).
        # Clearly-marked plausible samples so the Splash Pad / Beach category
        # views aren't empty; they add NO equipment, so the verified 41-item
        # playground totals above remain intact. Replace via admin edit.
        SAMPLES = [
            dict(location_type="splash_pad", name="Earl Bales Splash Pad",
                 city="Toronto", lat=43.7509, lng=-79.4327,
                 surfacing_material="Rubber", washroom_nearby=True,
                 water_fountains=1, parking=True, shade=True,
                 water_access=True, step_free_access=True),
            dict(location_type="splash_pad", name="Chinguacousy Splash Pad",
                 city="Brampton", lat=43.7315, lng=-79.7402,
                 surfacing_material="Pavement", washroom_nearby=True,
                 water_fountains=1, parking=True, shade=False,
                 water_access=True),
            dict(location_type="beach", name="Woodbine Beach",
                 city="Toronto", lat=43.6636, lng=-79.3086,
                 surfacing_material="Sand", washroom_nearby=True,
                 water_fountains=1, parking=True, shade=False,
                 water_access=True, accessible_washroom=True,
                 notes="Supervised swimming in season; Mobi-mat to the water line."),
        ]
        for s in SAMPLES:
            db.add(Park(
                status="approved", approved_at=utcnow(),
                notes=s.pop("notes", "Sample entry — verify details and update."),
                **s,
            ))
        db.commit()
        print(f"Seeded {len(PARKS)} playgrounds / 41 equipment items "
              f"+ {len(SAMPLES)} sample splash pads & beaches.")
    finally:
        db.close()


if __name__ == "__main__":
    seed(force="--force" in sys.argv)
