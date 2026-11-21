"""The #126 migration keeps pending professionals awaiting Verification.

Runs the real migration: upgrade a file database to the revision before it,
insert pending users with their subject rows, upgrade to head, and read back
the applications and statuses.
"""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

BEFORE = "6a921743ef9e"


@pytest.fixture
def migrated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> sqlite3.Connection:
    db = tmp_path / "retire-pending.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db}")
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    command.upgrade(config, BEFORE)
    conn = sqlite3.connect(db)
    users = [
        ("specialist", "specialist"),
        ("facility_owner", "facility_owner"),
        ("supplier", "supplier"),
        ("training_provider", "training_provider"),
        ("patient", "patient"),
        ("admin", "admin"),
        ("facility-no-facility", "facility_owner"),
        ("dentist-no-listing", "dentist"),
        ("supplier-no-store", "supplier"),
        ("training-no-provider", "training_provider"),
    ]
    for user_id, role in users:
        conn.execute(
            "INSERT INTO users (id, full_name, email, password_hash, role, account_status,"
            " is_active, created_at, updated_at)"
            " VALUES (?, ?, ?, 'x', ?, 'pending', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            (user_id, role, f"{user_id}@example.com", role),
        )
    conn.execute(
        "INSERT INTO specialists (id, name, slug, user_id, country_code, subdivision_code,"
        " currency, review_count, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, 'KE', 'NAIROBI', 'KES', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        (
            "sp-1",
            "Specialist",
            "specialist",
            "specialist",
        ),
    )
    conn.execute(
        "INSERT INTO facilities (id, name, country_code, subdivision_code, address,"
        " verification_tier, currency, review_count, created_at, updated_at)"
        " VALUES (?, ?, 'KE', 'NAIROBI', 'Road', 'unverified', 'KES', 0,"
        " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ("fac-1", "Facility"),
    )
    conn.execute(
        "INSERT INTO facility_memberships (id, user_id, facility_id, owner, front_office,"
        " clinical, created_at)"
        " VALUES (?, ?, ?, 1, 0, 0, CURRENT_TIMESTAMP)",
        (str(uuid.uuid4()), "facility_owner", "fac-1"),
    )
    conn.execute(
        "INSERT INTO suppliers (id, name, slug, country_code, scope, is_verified, owner_user_id,"
        " created_at) VALUES (?, ?, ?, 'KE', 'local', 0, ?, CURRENT_TIMESTAMP)",
        ("sup-1", "Supplier", "supplier", "supplier"),
    )
    conn.execute(
        "INSERT INTO training_providers (id, name, country_code, is_verified, owner_user_id,"
        " created_at) VALUES (?, ?, 'KE', 0, ?, CURRENT_TIMESTAMP)",
        ("tp-1", "Provider", "training_provider"),
    )
    conn.execute(
        "INSERT INTO verification_applications (id, user_id, subject_kind, subject_id,"
        " applicant_email, licence_number, issuing_body, document_keys, status, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'pending', CURRENT_TIMESTAMP)",
        (
            "existing-application",
            "specialist",
            "specialist",
            "sp-1",
            "specialist@example.com",
            "Already issued",
            "Dental Board",
        ),
    )
    conn.commit()
    command.upgrade(config, "head")
    return conn


def test_pending_professionals_with_a_subject_get_a_pending_application(
    migrated: sqlite3.Connection,
) -> None:
    rows = migrated.execute(
        "SELECT user_id, subject_kind, subject_id, status FROM verification_applications"
        " ORDER BY subject_kind"
    ).fetchall()

    by_user = {row[0]: row for row in rows}
    assert by_user["facility_owner"][1:] == ("facility", "fac-1", "pending")
    assert by_user["specialist"][1:] == ("specialist", "sp-1", "pending")
    assert by_user["supplier"][1:] == ("supplier", "sup-1", "pending")
    assert by_user["training_provider"][1:] == ("training_provider", "tp-1", "pending")
    assert len(rows) == 4


def test_subjectless_pending_users_get_no_placeholder_subject(
    migrated: sqlite3.Connection,
) -> None:
    statuses = dict(migrated.execute("SELECT id, account_status FROM users").fetchall())

    for user_id in (
        "facility-no-facility",
        "dentist-no-listing",
        "supplier-no-store",
        "training-no-provider",
    ):
        assert statuses[user_id] == "active"
        assert (
            migrated.execute(
                "SELECT 1 FROM verification_applications WHERE user_id = ?", (user_id,)
            ).fetchone()
            is None
        )

    assert (
        migrated.execute(
            "SELECT 1 FROM specialists WHERE user_id = ?", ("dentist-no-listing",)
        ).fetchone()
        is None
    )
    assert (
        migrated.execute(
            "SELECT 1 FROM facilities WHERE address = 'Pending migration'"
        ).fetchone()
        is None
    )
    assert (
        migrated.execute(
            "SELECT 1 FROM suppliers WHERE owner_user_id = ?", ("supplier-no-store",)
        ).fetchone()
        is None
    )
    assert (
        migrated.execute(
            "SELECT 1 FROM training_providers WHERE owner_user_id = ?",
            ("training-no-provider",),
        ).fetchone()
        is None
    )


def test_every_pending_account_becomes_active(migrated: sqlite3.Connection) -> None:
    statuses = dict(migrated.execute("SELECT role, account_status FROM users").fetchall())

    assert set(statuses.values()) == {"active"}
