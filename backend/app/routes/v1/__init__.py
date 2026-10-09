"""v1 API router — aggregates every v1 route module under one router.

Mounted in ``main.py`` at the ``/api/v1`` prefix. New feature routers are
included here (e.g. ``v1_router.include_router(patients.router)``).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routes.v1 import (
    auth,
    config,
    health,
    home,
    jobs,
    listing,
    magazine,
    products,
    training,
    users,
)

v1_router = APIRouter()
v1_router.include_router(health.router)
v1_router.include_router(auth.router, prefix="/auth")
v1_router.include_router(config.router)
v1_router.include_router(products.router)
v1_router.include_router(listing.router)
v1_router.include_router(home.router)
v1_router.include_router(users.router)
v1_router.include_router(jobs.router)
v1_router.include_router(magazine.router)
v1_router.include_router(training.router)
