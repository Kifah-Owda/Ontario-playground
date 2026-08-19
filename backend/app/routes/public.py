"""Public read API: parks, stats, meta. Only APPROVED parks are ever returned."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..database import get_db
from ..models import (AGE_GROUPS, CONDITIONS, EQUIPMENT_TYPES, LOCATION_TYPES,
                      SURFACES, EquipmentItem, Park)
from ..schemas import ParkOut, PhotoOut

router = APIRouter(prefix="/api", tags=["public"])


def _park_out(p: Park) -> ParkOut:
    return ParkOut(
        id=p.id,
        name=p.name,
        location_type=p.location_type or "playground",
        city=p.city,
        address=p.address,
        lat=p.lat,
        lng=p.lng,
        surfacing_material=p.surfacing_material,
        washroom_nearby=p.washroom_nearby,
        water_fountains=p.water_fountains,
        parking=p.parking,
        shade=p.shade,
        fenced=p.fenced,
        water_access=p.water_access,
        notes=p.notes,
        review_comment=p.review_comment,
        accessible_parking=p.accessible_parking,
        accessible_washroom=p.accessible_washroom,
        step_free_access=p.step_free_access,
        accessible_surfacing=p.accessible_surfacing,
        inclusive_equipment=p.inclusive_equipment,
        accessibility_notes=p.accessibility_notes,
        equipment=[e for e in p.equipment],  # via from_attributes on EquipmentOut
        photos=[
            PhotoOut(
                url=f"/uploads/{ph.filename}",
                thumb_url=f"/uploads/{ph.thumb_filename}",
                width=ph.width,
                height=ph.height,
            )
            for ph in p.photos
        ],
        age_groups_present=sorted({e.age_group for e in p.equipment}),
        updated=p.approved_at or p.created_at,
    )


def _apply_filters(
    stmt,
    bbox: str | None,
    equipment_type: str | None,
    age_group: str | None,
    condition: str | None,
    accessible: bool | None,
    q: str | None,
    location_type: str | None = None,
    washroom: bool | None = None,
    water: bool | None = None,
    parking: bool | None = None,
    shade: bool | None = None,
    fenced: bool | None = None,
    surface: str | None = None,
):
    stmt = stmt.where(Park.status == "approved")
    if location_type:
        stmt = stmt.where(Park.location_type == location_type)
    if washroom:
        stmt = stmt.where(Park.washroom_nearby.is_(True))
    if water:
        stmt = stmt.where(Park.water_fountains > 0)
    if parking:
        stmt = stmt.where(Park.parking.is_(True))
    if shade:
        stmt = stmt.where(Park.shade.is_(True))
    if fenced:
        stmt = stmt.where(Park.fenced.is_(True))
    if surface:
        stmt = stmt.where(Park.surfacing_material == surface)
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = (float(x) for x in bbox.split(","))
        except ValueError:
            raise HTTPException(400, "bbox must be 'minLng,minLat,maxLng,maxLat'")
        stmt = stmt.where(
            Park.lat >= min_lat, Park.lat <= max_lat,
            Park.lng >= min_lng, Park.lng <= max_lng,
        )
    if q:
        stmt = stmt.where(Park.name.ilike(f"%{q}%"))
    if accessible:
        stmt = stmt.where(
            (Park.step_free_access.is_(True))
            | (Park.inclusive_equipment.is_(True))
            | (Park.accessible_surfacing.is_(True))
        )
    if equipment_type or age_group or condition:
        sub = select(EquipmentItem.park_id)
        if equipment_type:
            sub = sub.where(EquipmentItem.equipment_type == equipment_type)
        if age_group:
            sub = sub.where(EquipmentItem.age_group == age_group)
        if condition:
            sub = sub.where(EquipmentItem.condition == condition)
        stmt = stmt.where(Park.id.in_(sub))
    return stmt


FilterParams = {
    "bbox": Query(None, description="minLng,minLat,maxLng,maxLat"),
    "equipment_type": Query(None),
    "age_group": Query(None),
    "condition": Query(None),
    "accessible": Query(None),
    "q": Query(None, description="park name contains"),
}


@router.get("/parks", response_model=list[ParkOut])
def list_parks(
    db: Session = Depends(get_db),
    bbox: str | None = FilterParams["bbox"],
    equipment_type: str | None = FilterParams["equipment_type"],
    age_group: str | None = FilterParams["age_group"],
    condition: str | None = FilterParams["condition"],
    accessible: bool | None = FilterParams["accessible"],
    q: str | None = FilterParams["q"],
    location_type: str | None = Query(None),
    washroom: bool | None = Query(None),
    water: bool | None = Query(None),
    parking: bool | None = Query(None),
    shade: bool | None = Query(None),
    fenced: bool | None = Query(None),
    surface: str | None = Query(None),
    limit: int = Query(500, le=2000),
):
    stmt = select(Park).options(
        selectinload(Park.equipment), selectinload(Park.photos)
    )
    stmt = _apply_filters(
        stmt, bbox, equipment_type, age_group, condition, accessible, q,
        location_type, washroom, water, parking, shade, fenced, surface,
    )
    stmt = stmt.order_by(Park.name).limit(limit)
    return [_park_out(p) for p in db.scalars(stmt).all()]


@router.get("/parks/{park_id}", response_model=ParkOut)
def get_park(park_id: int, db: Session = Depends(get_db)):
    p = db.get(Park, park_id)
    if p is None or p.status != "approved":
        raise HTTPException(404, "Park not found")
    return _park_out(p)


@router.get("/stats")
def stats(
    db: Session = Depends(get_db),
    bbox: str | None = FilterParams["bbox"],
    equipment_type: str | None = FilterParams["equipment_type"],
    age_group: str | None = FilterParams["age_group"],
    condition: str | None = FilterParams["condition"],
    accessible: bool | None = FilterParams["accessible"],
    q: str | None = FilterParams["q"],
):
    """Aggregates powering the dashboard panel, honouring the same filters."""
    park_ids_stmt = _apply_filters(
        select(Park.id), bbox, equipment_type, age_group, condition, accessible, q
    )
    park_ids = [row for row in db.scalars(park_ids_stmt).all()]
    if not park_ids:
        return {
            "parks": 0, "equipment_total": 0,
            "by_type_age": {}, "by_condition": {}, "by_surface": {},
            "parks_with_water": 0, "parks_with_washroom": 0, "accessible_parks": 0,
        }

    eq = select(
        EquipmentItem.equipment_type,
        EquipmentItem.age_group,
        func.count(EquipmentItem.id),
    ).where(EquipmentItem.park_id.in_(park_ids))
    # The type/age/condition filters also narrow WHICH equipment is counted,
    # matching the ArcGIS dashboard's cross-filter behaviour.
    if equipment_type:
        eq = eq.where(EquipmentItem.equipment_type == equipment_type)
    if age_group:
        eq = eq.where(EquipmentItem.age_group == age_group)
    if condition:
        eq = eq.where(EquipmentItem.condition == condition)
    eq = eq.group_by(EquipmentItem.equipment_type, EquipmentItem.age_group)

    by_type_age: dict[str, dict[str, int]] = {}
    total = 0
    for etype, age, count in db.execute(eq).all():
        by_type_age.setdefault(etype, {})[age] = count
        total += count

    cond = select(EquipmentItem.condition, func.count(EquipmentItem.id)).where(
        EquipmentItem.park_id.in_(park_ids)
    )
    if equipment_type:
        cond = cond.where(EquipmentItem.equipment_type == equipment_type)
    if age_group:
        cond = cond.where(EquipmentItem.age_group == age_group)
    if condition:
        cond = cond.where(EquipmentItem.condition == condition)
    by_condition = dict(db.execute(cond.group_by(EquipmentItem.condition)).all())

    surf = (
        select(Park.surfacing_material, func.count(Park.id))
        .where(Park.id.in_(park_ids), Park.surfacing_material.is_not(None))
        .group_by(Park.surfacing_material)
    )
    by_surface = dict(db.execute(surf).all())

    water = db.scalar(
        select(func.count(Park.id)).where(
            Park.id.in_(park_ids), Park.water_fountains > 0
        )
    )
    washroom = db.scalar(
        select(func.count(Park.id)).where(
            Park.id.in_(park_ids), Park.washroom_nearby.is_(True)
        )
    )
    accessible_ct = db.scalar(
        select(func.count(Park.id)).where(
            Park.id.in_(park_ids),
            (Park.step_free_access.is_(True))
            | (Park.inclusive_equipment.is_(True))
            | (Park.accessible_surfacing.is_(True)),
        )
    )

    return {
        "parks": len(park_ids),
        "equipment_total": total,
        "by_type_age": by_type_age,
        "by_condition": by_condition,
        "by_surface": by_surface,
        "parks_with_water": water or 0,
        "parks_with_washroom": washroom or 0,
        "accessible_parks": accessible_ct or 0,
    }


@router.get("/meta")
def meta():
    """Controlled vocabularies + frontend runtime config."""
    return {
        "location_types": LOCATION_TYPES,
        "equipment_types": EQUIPMENT_TYPES,
        "age_groups": AGE_GROUPS,
        "conditions": CONDITIONS,
        "surfaces": SURFACES,
        "map": {
            "tile_url": settings.TILE_URL,
            "tile_attribution": settings.TILE_ATTRIBUTION,
            "start": [settings.MAP_START_LAT, settings.MAP_START_LNG],
            "zoom": settings.MAP_START_ZOOM,
        },
        "geocoder": {
            "enabled": settings.GEOCODER_ENABLED,
            "url": settings.GEOCODER_URL,
        },
        "max_photos": settings.MAX_PHOTOS_PER_SUBMISSION,
    }
