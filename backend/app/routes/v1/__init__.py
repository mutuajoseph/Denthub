"""v1 API router — aggregates every v1 route module under one router.

Mounted in ``main.py`` at the ``/api/v1`` prefix. New feature routers are
included here (e.g. ``v1_router.include_router(patients.router)``).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routes.v1 import auth, health, products

v1_router = APIRouter()
v1_router.include_router(health.router)
v1_router.include_router(auth.router, prefix="/auth")
v1_router.include_router(products.router)
