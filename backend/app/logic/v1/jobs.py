"""Jobs board logic: read-only, public, per-market.

The board is a module a Country may or may not offer (``JOBS_BOARD`` flag). An
unconfigured or disabled market gets an explicit 503 rather than an empty list,
so the UI can say "not available here" instead of looking broken. Only published
postings are ever served, and a salary band is never returned without its
currency, per the root ``AGENTS.md`` money rule.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal, cast

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BaseApiException, NotFoundException
from app.logic.v1.country import CountryConfigurationMissingException
from app.repositories.country import Country, CountryRepository
from app.repositories.job import (
    JobFilters,
    JobPosting,
    JobSalaryRange,
    JobsRepository,
)
from app.utils.money import quantize_money
from app.utils.state import AppState

JOBS_PAGE_SIZE = 12
MAX_PAGE_SIZE = 100

#: The module's feature key in ``country_features`` (matches the client flag).
JOBS_BOARD_FEATURE = "JOBS_BOARD"

EmploymentType = Literal["Full Time", "Part Time", "Contract", "Internship"]
Seniority = Literal["Entry Level", "Mid Level", "Senior", "Lead"]


class JobsBoardUnavailableException(BaseApiException):
    """The active Country has the jobs board switched off (or unconfigured).

    Distinct from an empty page: a market that considered the board and
    disabled it should be able to say so rather than look broken.
    """

    code = 503
    message = "The jobs board is not available in this country"


class JobSalaryRangeResponse(BaseModel):
    """One salary band. ``currency`` is always present (root ``AGENTS.md``)."""

    min_amount: Decimal | None
    max_amount: Decimal | None
    currency: str


class WorkplaceResponse(BaseModel):
    """The Branch a posting belongs to, flattened for a card.

    ``facility_name`` is the clinic a candidate applies to; ``branch_name``
    distinguishes multi-site Facilities ("Westlands", "24-Hour Emergency").
    """

    facility_name: str
    branch_name: str | None
    subdivision_code: str
    address: str | None
    phone: str | None


class JobPostingResponse(BaseModel):
    """One published posting as a card and a detail page can render it."""

    id: str
    title: str
    description: str
    requirements: str | None
    employment_type: EmploymentType
    seniority: Seniority
    posted_at: datetime
    specialty_codes: list[str]
    workplace: WorkplaceResponse
    salary_range: JobSalaryRangeResponse | None


class JobPage(BaseModel):
    """One page of postings plus the market it belongs to."""

    items: list[JobPostingResponse]
    total: int
    limit: int
    offset: int
    country_code: str
    currency: str


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


async def _resolve_jobs_market(session: AsyncSession, country_code: str) -> Country:
    """The Country a page is priced in, rejecting markets without the board.

    An unknown market and a market with the board disabled are both explicit
    503s, because both otherwise read as "just returned nothing".
    """
    country = await CountryRepository.get(session, country_code.upper())

    if country is None:
        raise CountryConfigurationMissingException()

    flag = next(
        (feature for feature in country.features if feature.feature == JOBS_BOARD_FEATURE),
        None,
    )

    if flag is None or not flag.is_enabled:
        raise JobsBoardUnavailableException()

    return country


def _serialize_salary(
    ranges: list[JobSalaryRange] | None,
) -> JobSalaryRangeResponse | None:
    """The headline salary band: the lowest minimum across a posting's ranges."""
    if not ranges:
        return None

    head = ranges[0]
    return JobSalaryRangeResponse(
        min_amount=None if head.min_amount is None else quantize_money(Decimal(head.min_amount)),
        max_amount=None if head.max_amount is None else quantize_money(Decimal(head.max_amount)),
        currency=head.currency,
    )


def _serialize_posting(posting: JobPosting) -> JobPostingResponse:
    return JobPostingResponse(
        id=posting.id,
        title=posting.title,
        description=posting.description,
        requirements=posting.requirements,
        employment_type=cast(EmploymentType, posting.employment_type),
        seniority=cast(Seniority, posting.seniority),
        posted_at=posting.posted_at,
        specialty_codes=[
            specialty.code for specialty in sorted(posting.specialties, key=lambda row: row.code)
        ],
        workplace=WorkplaceResponse(
            facility_name=posting.branch.facility.name,
            branch_name=posting.branch.name,
            subdivision_code=posting.subdivision_code,
            address=posting.branch.address,
            phone=posting.branch.phone,
        ),
        salary_range=_serialize_salary(posting.salary_ranges),
    )


async def list_jobs(
    state: AppState,
    *,
    country_code: str,
    subdivision_code: str | None = None,
    specialty_code: str | None = None,
    limit: int = JOBS_PAGE_SIZE,
    offset: int = 0,
) -> JobPage:
    """One page of published postings for a Country, filtered."""
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = JobFilters(
        country_code=country_code.upper(),
        subdivision_code=subdivision_code,
        specialty_code=specialty_code,
    )

    async with state.db_session_maker() as session:
        country = await _resolve_jobs_market(session, filters.country_code)
        rows = await JobsRepository.search(session, filters, limit=page_size, offset=start)
        total = await JobsRepository.count(session, filters)

    return JobPage(
        items=[_serialize_posting(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
        currency=country.currency,
    )


async def get_job(state: AppState, *, posting_id: str) -> JobPostingResponse:
    """One published posting with its salary range and Workplace."""
    async with state.db_session_maker() as session:
        posting = await JobsRepository.get(session, posting_id)

        if posting is None:
            raise NotFoundException(message="Job posting not found")

    return _serialize_posting(posting)
