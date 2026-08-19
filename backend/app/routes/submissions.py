"""Public submission endpoint — park-centric, multipart (JSON payload + photos).

Every submission lands as a PENDING park and is invisible to the public until
an admin approves it (owner-required moderation workflow).
"""
from __future__ import annotations

import json

from fastapi import (APIRouter, Depends, File, Form, HTTPException, Request,
                     UploadFile)
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..images import ImageError, process_upload
from ..models import EquipmentItem, Park, Photo
from ..schemas import SubmissionIn
from ..security import rate_limit_submission

router = APIRouter(prefix="/api", tags=["submissions"])


@router.post("/submissions", status_code=201)
async def create_submission(
    request: Request,
    payload: str = Form(..., description="SubmissionIn as a JSON string"),
    photos: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    rate_limit_submission(request)

    try:
        data = SubmissionIn.model_validate(json.loads(payload))
    except json.JSONDecodeError:
        raise HTTPException(400, "payload must be valid JSON")
    except ValidationError as exc:
        raise HTTPException(422, exc.errors())

    # Honeypot: pretend success, store nothing.
    if data.website:
        return {"status": "pending", "id": 0}

    if len(photos) > settings.MAX_PHOTOS_PER_SUBMISSION:
        raise HTTPException(
            400, f"At most {settings.MAX_PHOTOS_PER_SUBMISSION} photos per submission."
        )

    if data.revision_of_id is not None:
        original = db.get(Park, data.revision_of_id)
        if original is None or original.status != "approved":
            raise HTTPException(400, "revision_of_id does not match a public park")

    park = Park(
        status="pending",
        revision_of_id=data.revision_of_id,
        name=data.name.strip(),
        location_type=data.location_type,
        city=(data.city or "").strip() or None,
        address=(data.address or "").strip() or None,
        lat=data.lat,
        lng=data.lng,
        surfacing_material=data.surfacing_material,
        washroom_nearby=data.washroom_nearby,
        water_fountains=data.water_fountains,
        parking=data.parking,
        shade=data.shade,
        fenced=data.fenced,
        water_access=data.water_access,
        notes=data.notes,
        review_comment=data.review_comment,
        accessible_parking=data.accessibility.accessible_parking,
        accessible_washroom=data.accessibility.accessible_washroom,
        step_free_access=data.accessibility.step_free_access,
        accessible_surfacing=data.accessibility.accessible_surfacing,
        inclusive_equipment=data.accessibility.inclusive_equipment,
        accessibility_notes=data.accessibility.accessibility_notes,
        submitter_name=(data.submitter_name or "").strip() or None,
    )
    for item in data.equipment:
        park.equipment.append(
            EquipmentItem(
                equipment_type=item.equipment_type,
                age_group=item.age_group,
                condition=item.condition,
                notes=item.notes,
            )
        )

    saved_files: list[dict] = []
    for up in photos:
        raw = await up.read()
        if not raw:
            continue
        try:
            saved_files.append(process_upload(raw, up.filename))
        except ImageError as exc:
            raise HTTPException(400, f"{up.filename}: {exc}")
    for meta in saved_files:
        park.photos.append(
            Photo(
                filename=meta["filename"],
                thumb_filename=meta["thumb_filename"],
                original_name=meta["original_name"],
                width=meta["width"],
                height=meta["height"],
                bytes=meta["bytes"],
            )
        )

    db.add(park)
    db.commit()
    return {
        "status": "pending",
        "id": park.id,
        "message": "Thanks! Your report was received and will appear "
        "on the map once a moderator approves it.",
    }
