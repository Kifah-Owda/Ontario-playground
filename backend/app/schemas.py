"""Pydantic schemas — request/response contracts for the JSON API."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from .models import (AGE_GROUPS, CONDITIONS, EQUIPMENT_TYPES, LOCATION_TYPES,
                     SURFACES)

ONTARIO_BOUNDS = {"min_lat": 41.6, "max_lat": 56.9, "min_lng": -95.2, "max_lng": -74.3}


class EquipmentIn(BaseModel):
    equipment_type: str
    age_group: str
    condition: str
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("equipment_type")
    @classmethod
    def _type_ok(cls, v: str) -> str:
        if v not in EQUIPMENT_TYPES:
            raise ValueError(f"equipment_type must be one of {EQUIPMENT_TYPES}")
        return v

    @field_validator("age_group")
    @classmethod
    def _age_ok(cls, v: str) -> str:
        if v not in AGE_GROUPS:
            raise ValueError(f"age_group must be one of {AGE_GROUPS}")
        return v

    @field_validator("condition")
    @classmethod
    def _cond_ok(cls, v: str) -> str:
        if v not in CONDITIONS:
            raise ValueError(f"condition must be one of {CONDITIONS}")
        return v


class AccessibilityIn(BaseModel):
    accessible_parking: bool | None = None
    accessible_washroom: bool | None = None
    step_free_access: bool | None = None
    accessible_surfacing: bool | None = None
    inclusive_equipment: bool | None = None
    accessibility_notes: str | None = Field(default=None, max_length=2000)


class SubmissionIn(BaseModel):
    """One park-centric submission (new park or update to an existing one)."""

    name: str = Field(min_length=2, max_length=200)
    location_type: str = "playground"
    city: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    lat: float
    lng: float
    surfacing_material: str | None = None
    washroom_nearby: bool | None = None
    water_fountains: int | None = Field(default=None, ge=0, le=50)
    parking: bool | None = None
    shade: bool | None = None
    fenced: bool | None = None
    water_access: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)
    review_comment: str | None = Field(default=None, max_length=2000)
    accessibility: AccessibilityIn = AccessibilityIn()
    # Equipment is a playground concept: required (>=1) for playgrounds,
    # must be empty for splash pads and beaches (enforced below).
    equipment: list[EquipmentIn] = Field(default_factory=list, max_length=60)
    submitter_name: str | None = Field(default=None, max_length=120)
    # Update flow: id of the approved park this submission revises.
    revision_of_id: int | None = None
    # Honeypot — must be empty; bots that fill it are dropped silently.
    website: str | None = None

    @field_validator("surfacing_material")
    @classmethod
    def _surface_ok(cls, v: str | None) -> str | None:
        if v is not None and v not in SURFACES:
            raise ValueError(f"surfacing_material must be one of {SURFACES}")
        return v

    @field_validator("location_type")
    @classmethod
    def _loc_ok(cls, v: str) -> str:
        if v not in LOCATION_TYPES:
            raise ValueError(f"location_type must be one of {LOCATION_TYPES}")
        return v

    @model_validator(mode="after")
    def _equipment_matches_type(self) -> "SubmissionIn":
        if self.location_type == "playground" and len(self.equipment) < 1:
            raise ValueError("A playground needs at least one equipment entry")
        if self.location_type != "playground" and self.equipment:
            raise ValueError("Equipment entries only apply to playgrounds")
        return self

    @field_validator("lat")
    @classmethod
    def _lat_ok(cls, v: float) -> float:
        if not (ONTARIO_BOUNDS["min_lat"] <= v <= ONTARIO_BOUNDS["max_lat"]):
            raise ValueError("Location must be within Ontario")
        return v

    @field_validator("lng")
    @classmethod
    def _lng_ok(cls, v: float) -> float:
        if not (ONTARIO_BOUNDS["min_lng"] <= v <= ONTARIO_BOUNDS["max_lng"]):
            raise ValueError("Location must be within Ontario")
        return v


class EquipmentOut(BaseModel):
    id: int
    equipment_type: str
    age_group: str
    condition: str
    notes: str | None

    model_config = {"from_attributes": True}


class PhotoOut(BaseModel):
    url: str
    thumb_url: str
    width: int | None
    height: int | None


class ParkOut(BaseModel):
    id: int
    name: str
    location_type: str
    city: str | None
    address: str | None
    lat: float
    lng: float
    surfacing_material: str | None
    washroom_nearby: bool | None
    water_fountains: int | None
    parking: bool | None
    shade: bool | None
    fenced: bool | None
    water_access: bool | None
    notes: str | None
    review_comment: str | None
    accessible_parking: bool | None
    accessible_washroom: bool | None
    step_free_access: bool | None
    accessible_surfacing: bool | None
    inclusive_equipment: bool | None
    accessibility_notes: str | None
    equipment: list[EquipmentOut]
    photos: list[PhotoOut]
    age_groups_present: list[str]
    updated: datetime | None = None


class AdminParkOut(ParkOut):
    status: str
    revision_of_id: int | None
    submitter_name: str | None
    moderation_note: str | None
    created_at: datetime


class ModerationIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class AdminEditIn(SubmissionIn):
    """Admin in-place edit of an existing park. Same shape/validation as a
    submission; revision/honeypot fields are ignored server-side."""


class LoginIn(BaseModel):
    password: str
