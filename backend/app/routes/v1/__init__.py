"""v1 API router — aggregates every v1 route module under one router.

Mounted in ``main.py`` at the ``/api/v1`` prefix. New feature routers are
included here (e.g. ``v1_router.include_router(patients.router)``).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routes.v1 import health

v1_router = APIRouter()
v1_router.include_router(health.router)
