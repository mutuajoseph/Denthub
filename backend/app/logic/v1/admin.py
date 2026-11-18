"""Admin console logic: the staff surface that runs the platform (PRD §2–3.13).

Only ``admin`` and ``super_admin`` may call these functions, and only with a
staff-surface token (``/staff/access``). Every write records an audit row in the
same transaction, so "who changed this, and when" is answerable for every action
the console offers.

The console covers four things:

* Countries and their feature flags. A flag is a row, so "this market does not
  offer the module" stays distinct from "nobody configured it yet"
  (``CONTEXT.md`` "Country"). Flags are read by the public ``/config/country``
  path, so an edit here is visible to clients without a second cache to clear.
* Verification tiers. One graded value on a Facility or Specialist, set by
  staff — never a set of independent flags (``CONTEXT.md`` "Verification tier").
* Moderation. A Magazine Item or Job posting can be hidden from every public
  read path and published again; both already carry a ``status`` column. The
  console's lever is the two states it can set (``published``/``hidden``); a row
  in any other status is publishable, and the module that owns its drafts is
  responsible for them.
* The audit trail those writes produce.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.exceptions import NotFoundException
from app.logic.v1.audit import audit
from app.repositories.admin import AdminAuditLog, AdminAuditRepository
from app.repositories.country import (
    Country,
    CountryFeature,
    CountryFeatureRepository,
    CountryRepository,
)
from app.repositories.job import JobPosting, JobsRepository
from app.repositories.listing import (
    VERIFICATION_TIERS,
    Facility,
    FacilityRepository,
    Specialist,
    SpecialistRepository,
    VerificationTier,
)
from app.repositories.magazine import MagazineArticle, MagazineRepository
from app.repositories.user import User
from app.utils.state import AppState

#: How many rows a console list returns when the caller asks for nothing else.
ADMIN_LIST_LIMIT = 50
MAX_LIST_LIMIT = 200

#: The two states moderation can put a Magazine Item or Job posting into. Any
#: other stored status (a draft, a scheduled row) is left alone by this slice.
ModerationStatus = Literal["published", "hidden"]

#: What an admin may act on in the moderation queue.
ModerationEntityType = Literal["magazine", "job"]

VerificationEntityType = Literal["facility", "specialist"]


class AdminCountryFeature(BaseModel):
    """One feature flag as the console edits it."""

    feature: str
    is_enabled: bool
    primary_scheme: str | None


class AdminCountry(BaseModel):
    """A Country row in the admin list, flags included."""

    code: str
    name: str
    currency: str
    currency_symbol: str
    is_active: bool
    features: list[AdminCountryFeature]


class AdminCountryList(BaseModel):
    items: list[AdminCountry]


class UpdateCountryFeatureRequest(BaseModel):
    """Turn one flag on or off, and optionally set its market scheme."""

    is_enabled: bool
    primary_scheme: str | None = Field(default=None, max_length=100)


class UpdateCountryRequest(BaseModel):
    """Activate or retire a market."""

    is_active: bool


class VerificationItem(BaseModel):
    """One Facility or Specialist and the tier it is graded at."""

    entity_type: VerificationEntityType
    id: str
    name: str
    country_code: str
    verification_tier: VerificationTier


class VerificationList(BaseModel):
    items: list[VerificationItem]
    #: The grades in order, so the console renders the same vocabulary the
    #: server enforces rather than keeping a second copy.
    tiers: list[str]


class UpdateVerificationTierRequest(BaseModel):
    """Set the single graded value a profile is verified at."""

    verification_tier: VerificationTier


class ModerationItem(BaseModel):
    """One Magazine Item or Job posting in the moderation queue."""

    entity_type: ModerationEntityType
    id: str
    title: str
    status: str
    country_code: str


class ModerationList(BaseModel):
    items: list[ModerationItem]


class UpdateModerationStatusRequest(BaseModel):
    """Publish or hide a moderated row."""

    status: ModerationStatus


class AdminAuditEntry(BaseModel):
    """One row of the audit trail, as the console renders it."""

    id: int
    actor_email: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    before: dict[str, object] | None
    after: dict[str, object] | None
    created_at: datetime


class AdminAuditList(BaseModel):
    items: list[AdminAuditEntry]


def _serialize_flag(feature: CountryFeature) -> AdminCountryFeature:
    return AdminCountryFeature(
        feature=feature.feature,
        is_enabled=feature.is_enabled,
        primary_scheme=feature.primary_scheme,
    )


def _serialize_country(country: Country) -> AdminCountry:
    return AdminCountry(
        code=country.code,
        name=country.name,
        currency=country.currency,
        currency_symbol=country.currency_symbol,
        is_active=country.is_active,
        features=[
            _serialize_flag(feature)
            for feature in sorted(country.features, key=lambda row: row.feature)
        ],
    )


def _serialize_facility_verification(facility: Facility) -> VerificationItem:
    return VerificationItem(
        entity_type="facility",
        id=facility.id,
        name=facility.name,
        country_code=facility.country_code,
        verification_tier=facility.verification_tier,
    )


def _serialize_specialist_verification(specialist: Specialist) -> VerificationItem:
    return VerificationItem(
        entity_type="specialist",
        id=specialist.id,
        name=specialist.name,
        country_code=specialist.country_code,
        verification_tier=specialist.verification_tier,
    )


def _serialize_article(article: MagazineArticle) -> ModerationItem:
    return ModerationItem(
        entity_type="magazine",
        id=article.id,
        title=article.title,
        status=article.status,
        country_code=article.country_code,
    )


def _serialize_job(posting: JobPosting) -> ModerationItem:
    return ModerationItem(
        entity_type="job",
        id=posting.id,
        title=posting.title,
        status=posting.status,
        country_code=posting.country_code,
    )


def _serialize_audit(row: AdminAuditLog) -> AdminAuditEntry:
    return AdminAuditEntry(
        id=row.id,
        actor_email=row.actor_email,
        actor_role=row.actor_role,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        before=row.before,
        after=row.after,
        created_at=row.created_at,
    )


def _limit(limit: int) -> int:
    return max(1, min(limit, MAX_LIST_LIMIT))


async def list_countries(state: AppState, *, actor: User) -> AdminCountryList:
    """Every Country, active or retired, with its feature flags."""

    async with state.db_session_maker() as session:
        countries = await CountryRepository.list_all(session)

    return AdminCountryList(items=[_serialize_country(country) for country in countries])


async def update_country(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    request: UpdateCountryRequest,
) -> AdminCountry:
    """Activate or retire a market.

    A retired Country drops out of the public switcher (``list_active``), so no
    client is offered it as a market to choose. A caller that already holds the
    code can still read its configuration, so this is a discovery switch rather
    than a hard takedown; gating the config endpoint itself is a public API
    change left to its own issue.
    """

    async with state.db_session_maker() as session:
        country = await CountryRepository.get(session, country_code)

        if country is None:
            raise NotFoundException(message="Country not found")

        before: dict[str, object] = {"is_active": country.is_active}
        country.is_active = request.is_active
        after: dict[str, object] = {"is_active": country.is_active}

        await audit(
            session,
            actor=actor,
            action="country.update",
            entity_type="country",
            entity_id=country.code,
            before=before,
            after=after,
        )
        await session.commit()

        return _serialize_country(country)


async def update_country_feature(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    feature: str,
    request: UpdateCountryFeatureRequest,
) -> AdminCountryFeature:
    """Turn one Country feature flag on or off.

    A market that never configured the flag gets a row created on first write:
    "switched off by staff" and "never configured" are different facts, and the
    console is where the first one is recorded.
    """

    async with state.db_session_maker() as session:
        country = await CountryRepository.get(session, country_code)

        if country is None:
            raise NotFoundException(message="Country not found")

        row = await CountryFeatureRepository.get(
            session,
            country_code=country.code,
            feature=feature,
        )

        before: dict[str, object] | None = None
        if row is None:
            row = await CountryFeatureRepository.create(
                session,
                country_code=country.code,
                feature=feature,
                is_enabled=request.is_enabled,
                primary_scheme=request.primary_scheme,
            )
        else:
            before = {
                "is_enabled": row.is_enabled,
                "primary_scheme": row.primary_scheme,
            }
            row.is_enabled = request.is_enabled
            row.primary_scheme = request.primary_scheme

        after: dict[str, object] = {
            "is_enabled": row.is_enabled,
            "primary_scheme": row.primary_scheme,
        }

        await audit(
            session,
            actor=actor,
            action="country.feature.update",
            entity_type="country_feature",
            entity_id=f"{country.code}:{feature}",
            before=before,
            after=after,
        )
        await session.commit()

        return _serialize_flag(row)


async def list_verifications(state: AppState, *, actor: User) -> VerificationList:
    """Every Facility and Specialist with its current verification tier."""

    async with state.db_session_maker() as session:
        facilities = await FacilityRepository.list_all(session)
        specialists = await SpecialistRepository.list_all(session)

    return VerificationList(
        items=[
            *[_serialize_facility_verification(row) for row in facilities],
            *[_serialize_specialist_verification(row) for row in specialists],
        ],
        tiers=list(VERIFICATION_TIERS),
    )


async def _set_verification(
    state: AppState,
    *,
    actor: User,
    entity_type: VerificationEntityType,
    entity_id: str,
    request: UpdateVerificationTierRequest,
) -> VerificationItem:

    async with state.db_session_maker() as session:
        if entity_type == "facility":
            facility = await FacilityRepository.get(session, entity_id)
            if facility is None:
                raise NotFoundException(message="Facility not found")
            before: dict[str, object] = {"verification_tier": facility.verification_tier}
            facility.verification_tier = request.verification_tier
            after: dict[str, object] = {"verification_tier": facility.verification_tier}
            item = _serialize_facility_verification(facility)
        else:
            specialist = await SpecialistRepository.get(session, entity_id)
            if specialist is None:
                raise NotFoundException(message="Specialist not found")
            before = {"verification_tier": specialist.verification_tier}
            specialist.verification_tier = request.verification_tier
            after = {"verification_tier": specialist.verification_tier}
            item = _serialize_specialist_verification(specialist)

        await audit(
            session,
            actor=actor,
            action="verification.set",
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
        )
        await session.commit()

        return item


async def set_facility_verification(
    state: AppState,
    *,
    actor: User,
    facility_id: str,
    request: UpdateVerificationTierRequest,
) -> VerificationItem:
    """Set a Facility's single graded verification tier."""
    return await _set_verification(
        state,
        actor=actor,
        entity_type="facility",
        entity_id=facility_id,
        request=request,
    )


async def set_specialist_verification(
    state: AppState,
    *,
    actor: User,
    specialist_id: str,
    request: UpdateVerificationTierRequest,
) -> VerificationItem:
    """Set a Specialist's single graded verification tier."""
    return await _set_verification(
        state,
        actor=actor,
        entity_type="specialist",
        entity_id=specialist_id,
        request=request,
    )


async def list_moderation(
    state: AppState, *, actor: User, limit: int = ADMIN_LIST_LIMIT
) -> ModerationList:
    """The newest Magazine Items and Job postings, whatever their status."""
    page_size = _limit(limit)

    async with state.db_session_maker() as session:
        articles = await MagazineRepository.list_recent(session, limit=page_size)
        postings = await JobsRepository.list_recent(session, limit=page_size)

    return ModerationList(
        items=[
            *[_serialize_article(row) for row in articles],
            *[_serialize_job(row) for row in postings],
        ]
    )


async def _set_moderation_status(
    state: AppState,
    *,
    actor: User,
    entity_type: ModerationEntityType,
    entity_id: str,
    request: UpdateModerationStatusRequest,
) -> ModerationItem:

    async with state.db_session_maker() as session:
        if entity_type == "magazine":
            article = await MagazineRepository.get_any(session, entity_id)
            if article is None:
                raise NotFoundException(message="Magazine item not found")
            before: dict[str, object] = {"status": article.status}
            article.status = request.status
            after: dict[str, object] = {"status": article.status}
            item = _serialize_article(article)
        else:
            posting = await JobsRepository.get_any(session, entity_id)
            if posting is None:
                raise NotFoundException(message="Job posting not found")
            before = {"status": posting.status}
            posting.status = request.status
            after = {"status": posting.status}
            item = _serialize_job(posting)

        await audit(
            session,
            actor=actor,
            action="moderation.status",
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
        )
        await session.commit()

        return item


async def moderate_magazine(
    state: AppState,
    *,
    actor: User,
    article_id: str,
    request: UpdateModerationStatusRequest,
) -> ModerationItem:
    """Publish or hide a Magazine Item."""
    return await _set_moderation_status(
        state,
        actor=actor,
        entity_type="magazine",
        entity_id=article_id,
        request=request,
    )


async def moderate_job(
    state: AppState,
    *,
    actor: User,
    posting_id: str,
    request: UpdateModerationStatusRequest,
) -> ModerationItem:
    """Publish or hide a Job posting."""
    return await _set_moderation_status(
        state,
        actor=actor,
        entity_type="job",
        entity_id=posting_id,
        request=request,
    )


async def list_audit(
    state: AppState,
    *,
    actor: User,
    limit: int = ADMIN_LIST_LIMIT,
) -> AdminAuditList:
    """The newest staff writes first, so the console shows recent activity."""
    page_size = _limit(limit)

    async with state.db_session_maker() as session:
        rows = await AdminAuditRepository.list_recent(session, limit=page_size)

    return AdminAuditList(items=[_serialize_audit(row) for row in rows])
