"""The #117 migration backfills Profiles and Facility Memberships from roles.

Runs the real migration: upgrade a file database to the revision before it,
insert one user per interesting role, upgrade to head, and read back what the
backfill wrote. The mapping is the table settled on #117.
"""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

BEFORE = "4b75c2480490"
BACKFILL = "a03c4a379430"
FACILITY_ID = str(uuid.uuid4())

#: (role, has a facility_id) for each user inserted before the backfill.
USERS = [
    ("patient", False),
    ("international_patient", False),
    ("dentist", False),
    ("specialist", False),
    ("intern", False),
    ("supplier", False),
    ("training_provider", False),
    ("facility_owner", True),
    ("facility_owner", False),
    ("front_office", True),
    ("facility_dentist", True),
    ("admin", False),
    ("platform_operator", False),
]


@pytest.fixture
def backfilled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> sqlite3.Connection:
    db = tmp_path / "backfill.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db}")
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    command.upgrade(config, BEFORE)
    conn = sqlite3.connect(db)
    for index, (role, has_facility) in enumerate(USERS):
        conn.execute(
            "INSERT INTO users (id, full_name, email, password_hash, role, account_status,"
            " is_active, facility_id, created_at, updated_at)"
            " VALUES (?, ?, ?, 'x', ?, 'active', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            (
                f"{role}-{index}",
                role,
                f"{role}-{index}@example.com",
                role,
                FACILITY_ID if has_facility else None,
            ),
        )
    conn.commit()
    command.upgrade(config, BACKFILL)
    return conn


def _profiles(conn: sqlite3.Connection) -> dict[str, list[str]]:
    rows = conn.execute("SELECT user_id, kind FROM profiles ORDER BY kind").fetchall()
    held: dict[str, list[str]] = {}
    for user_id, kind in rows:
        held.setdefault(user_id, []).append(kind)
    return held


def test_every_role_gets_the_profile_it_implies(backfilled: sqlite3.Connection) -> None:
    assert _profiles(backfilled) == {
        "patient-0": ["patient"],
        "international_patient-1": ["patient"],
        "dentist-2": ["specialist"],
        "specialist-3": ["specialist"],
        "intern-4": ["specialist"],
        "supplier-5": ["supplier"],
        "training_provider-6": ["training_provider"],
        "facility_dentist-10": ["specialist"],
    }


def test_facility_roles_with_a_facility_get_the_membership_they_imply(
    backfilled: sqlite3.Connection,
) -> None:
    rows = backfilled.execute(
        "SELECT user_id, facility_id, owner, front_office, clinical"
        " FROM facility_memberships ORDER BY user_id"
    ).fetchall()

    assert rows == [
        ("facility_dentist-10", FACILITY_ID, 0, 0, 1),
        ("facility_owner-7", FACILITY_ID, 1, 0, 0),
        ("front_office-9", FACILITY_ID, 0, 1, 0),
    ]


def test_staff_and_unlinked_facility_owners_get_nothing(backfilled: sqlite3.Connection) -> None:
    held = set(_profiles(backfilled))
    members = {row[0] for row in backfilled.execute("SELECT user_id FROM facility_memberships")}

    for user_id in ("facility_owner-8", "admin-11", "platform_operator-12"):
        assert user_id not in held
        assert user_id not in members
