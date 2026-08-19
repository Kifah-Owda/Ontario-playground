"""Admin API: login, moderation queue, approve/reject, delete, CSV export."""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..images import delete_files
from ..models import EquipmentItem, Park, utcnow
from ..routes.public import _park_out
from ..schemas import AdminEditIn, AdminParkOut, LoginIn, ModerationIn
from ..security import issue_admin_token, require_admin, verify_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login")
def login(body: LoginIn):
    if not verify_password(body.password):
        raise HTTPException(401, "Wrong password (or ADMIN_PASSWORD not configured)")
    return {"token": issue_admin_token()}


def _admin_out(p: Park) -> AdminParkOut:
    base = _park_out(p).model_dump()
    base.update(
        status=p.status,
        revision_of_id=p.revision_of_id,
        submitter_name=p.submitter_name,
        moderation_note=p.moderation_note,
        created_at=p.created_at,
    )
    return AdminParkOut(**base)


@router.get("/parks", response_model=list[AdminParkOut], dependencies=[Depends(require_admin)])
def list_all(
    status: str = Query("pending", pattern="^(pending|approved|rejected|archived|all)$"),
    db: Session = Depends(get_db),
):
    stmt = select(Park).options(selectinload(Park.equipment), selectinload(Park.photos))
    if status != "all":
        stmt = stmt.where(Park.status == status)
    stmt = stmt.order_by(Park.created_at.desc())
    return [_admin_out(p) for p in db.scalars(stmt).all()]


@router.post("/parks/{park_id}/approve", dependencies=[Depends(require_admin)])
def approve(park_id: int, body: ModerationIn, db: Session = Depends(get_db)):
    p = db.get(Park, park_id)
    if p is None or p.status != "pending":
        raise HTTPException(404, "No pending submission with that id")
    p.status = "approved"
    p.approved_at = utcnow()
    p.moderation_note = body.note
    # If this revises an existing public park, archive the old snapshot.
    if p.revision_of_id:
        old = db.get(Park, p.revision_of_id)
        if old and old.status == "approved":
            old.status = "archived"
    db.commit()
    return {"ok": True, "id": p.id, "status": p.status}


@router.post("/parks/{park_id}/reject", dependencies=[Depends(require_admin)])
def reject(park_id: int, body: ModerationIn, db: Session = Depends(get_db)):
    p = db.get(Park, park_id)
    if p is None or p.status != "pending":
        raise HTTPException(404, "No pending submission with that id")
    p.status = "rejected"
    p.moderation_note = body.note
    db.commit()
    return {"ok": True, "id": p.id, "status": p.status}


@router.put("/parks/{park_id}", response_model=AdminParkOut,
            dependencies=[Depends(require_admin)])
def edit_park(park_id: int, body: AdminEditIn, db: Session = Depends(get_db)):
    """In-place moderator edit (typo fixes, corrections). Does NOT change
    status or create a revision — community updates still go through the
    submission flow. Photos are unaffected; revision/honeypot fields ignored."""
    p = db.get(Park, park_id)
    if p is None:
        raise HTTPException(404, "Not found")
    p.name = body.name.strip()
    p.location_type = body.location_type
    p.city = (body.city or "").strip() or None
    p.address = (body.address or "").strip() or None
    p.lat, p.lng = body.lat, body.lng
    p.surfacing_material = body.surfacing_material
    p.washroom_nearby = body.washroom_nearby
    p.water_fountains = body.water_fountains
    p.parking, p.shade = body.parking, body.shade
    p.fenced, p.water_access = body.fenced, body.water_access
    p.notes, p.review_comment = body.notes, body.review_comment
    a = body.accessibility
    p.accessible_parking = a.accessible_parking
    p.accessible_washroom = a.accessible_washroom
    p.step_free_access = a.step_free_access
    p.accessible_surfacing = a.accessible_surfacing
    p.inclusive_equipment = a.inclusive_equipment
    p.accessibility_notes = a.accessibility_notes
    p.equipment.clear()  # ORM cascade delete-orphan replaces the list
    for item in body.equipment:
        p.equipment.append(EquipmentItem(
            equipment_type=item.equipment_type, age_group=item.age_group,
            condition=item.condition, notes=item.notes,
        ))
    db.commit()
    db.refresh(p)
    return _admin_out(p)


@router.delete("/parks/{park_id}", dependencies=[Depends(require_admin)])
def delete_park(park_id: int, db: Session = Depends(get_db)):
    p = db.get(Park, park_id)
    if p is None:
        raise HTTPException(404, "Not found")
    # Capture file names before the ORM cascade removes the Photo rows.
    # Note: reject/archive deliberately KEEP their photos (moderation history);
    # only this hard delete purges files.
    photo_files = [(ph.filename, ph.thumb_filename) for ph in p.photos]
    db.delete(p)
    db.commit()
    # Unlink only after a successful commit: a DB failure must never leave
    # rows pointing at deleted files (orphaned files are recoverable).
    for filename, thumb_filename in photo_files:
        delete_files(filename, thumb_filename)
    return {"ok": True}


@router.get("/export.csv", dependencies=[Depends(require_admin)])
def export_csv(db: Session = Depends(get_db)):
    """Flat equipment-level CSV of all approved data (for planners/researchers)."""
    stmt = (
        select(Park)
        .options(selectinload(Park.equipment))
        .where(Park.status == "approved")
        .order_by(Park.name)
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "park_id", "park_name", "location_type", "city", "address", "lat", "lng",
            "surfacing_material", "washroom_nearby", "water_fountains",
            "parking", "shade", "fenced", "water_access",
            "accessible_parking", "accessible_washroom", "step_free_access",
            "accessible_surfacing", "inclusive_equipment",
            "equipment_type", "age_group", "condition", "equipment_notes",
        ]
    )
    for p in db.scalars(stmt).all():
        rows = p.equipment or [None]  # splash pads/beaches export one row
        for e in rows:
            writer.writerow(
                [
                    p.id, p.name, p.location_type, p.city or "", p.address or "", p.lat, p.lng,
                    p.surfacing_material or "",
                    p.washroom_nearby, p.water_fountains,
                    p.parking, p.shade, p.fenced, p.water_access,
                    p.accessible_parking, p.accessible_washroom, p.step_free_access,
                    p.accessible_surfacing, p.inclusive_equipment,
                    e.equipment_type if e else "", e.age_group if e else "",
                    e.condition if e else "", (e.notes or "") if e else "",
                ]
            )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=playgrounds.csv"},
    )
