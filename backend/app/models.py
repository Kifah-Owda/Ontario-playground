"""ORM models — park-centric data model (Phase 2, owner-approved).

One Park row = one submission snapshot. Moderation is a status on the park:
  pending -> approved | rejected
  approved -> archived (when a newer approved revision supersedes it)

Equipment items and photos are children of the park row. An update to an
existing park is a NEW pending Park row with revision_of_id pointing at the
currently approved row; on approval the old row is archived. This gives a
simple moderation queue plus full history without a separate versioning table.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# --- Controlled vocabularies (seeded from the documented ArcGIS MVP) --------
EQUIPMENT_TYPES = [
    "Swings", "Slides", "Climbers", "Tubes", "See saws",
    "Spring riders", "Merry go round", "Other",
]
AGE_GROUPS = [
    "Toddler (6-23 months)",
    "Pre-schoolers (2-5 years)",
    "School-age (5-12 years)",
]
CONDITIONS = ["Like new", "Acceptable", "Very old"]
SURFACES = [
    "Rubber", "Wood chips", "Sand",
    "Engineered wood fibre", "Grass", "Pavement", "Mixed", "Other",
]
LOCATION_TYPES = ["playground", "splash_pad", "beach"]
STATUSES = ["pending", "approved", "rejected", "archived"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Park(Base):
    __tablename__ = "parks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    revision_of_id: Mapped[int | None] = mapped_column(
        ForeignKey("parks.id"), nullable=True
    )

    # --- Park info -----------------------------------------------------------
    # Recreation-location model (2026 redesign): a "park" row can be a
    # playground, splash pad, or beach. Equipment items remain playground-only.
    location_type: Mapped[str] = mapped_column(
        String(20), default="playground", index=True
    )
    name: Mapped[str] = mapped_column(String(200), index=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float] = mapped_column(Float, index=True)
    lng: Mapped[float] = mapped_column(Float, index=True)
    surfacing_material: Mapped[str | None] = mapped_column(String(60), nullable=True)
    washroom_nearby: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    water_fountains: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Facility tri-states (True / False / NULL = unknown), 2026 redesign:
    parking: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    shade: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fenced: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Beaches / splash pads: is the water entry accessible (ramp/zero-entry)?
    water_access: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)          # description
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)  # user review

    # --- Disability accessibility (owner-required extension) ------------------
    # Tri-state: True / False / NULL (= unknown / not assessed)
    accessible_parking: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    accessible_washroom: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    step_free_access: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    accessible_surfacing: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    inclusive_equipment: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    accessibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- Provenance / moderation ----------------------------------------------
    submitter_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    equipment: Mapped[list["EquipmentItem"]] = relationship(
        back_populates="park", cascade="all, delete-orphan", order_by="EquipmentItem.id"
    )
    photos: Mapped[list["Photo"]] = relationship(
        back_populates="park", cascade="all, delete-orphan", order_by="Photo.id"
    )


class EquipmentItem(Base):
    __tablename__ = "equipment_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    park_id: Mapped[int] = mapped_column(ForeignKey("parks.id"), index=True)
    equipment_type: Mapped[str] = mapped_column(String(60))
    age_group: Mapped[str] = mapped_column(String(60))
    condition: Mapped[str] = mapped_column(String(30))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    park: Mapped[Park] = relationship(back_populates="equipment")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    park_id: Mapped[int] = mapped_column(ForeignKey("parks.id"), index=True)
    filename: Mapped[str] = mapped_column(String(200))        # processed WebP
    thumb_filename: Mapped[str] = mapped_column(String(200))
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    park: Mapped[Park] = relationship(back_populates="photos")
