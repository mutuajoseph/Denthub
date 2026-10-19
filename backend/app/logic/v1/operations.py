"""Operations console logic: division-scoped operator work (PRD §2, §3.13).

A Platform Operator belongs to exactly one Division (Jobs, Shop, Training,
Dentist, International, Suppliers) at a Lead or Assistant tier (``CONTEXT.md``
"Operator"). Unlike the admin console's platform-wide view, every function here
is constrained to the caller's own Division on the server: a call from another
Division is refused before any row is read, so the client never decides scope.

An Assistant may read their Division; only a Lead may write to it. The tier is
read from the user row on each request, so promoting or demoting an operator
takes effect immediately rather than when their token next refreshes.

This slice ships the console shell, the division scoping and the Jobs write;
the other Divisions' actions are follow-ups.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.exceptions import ForbiddenException, NotFoundException
from app.logic.v1.auth import UserResponse, get_current_staff
from app.repositories.job import JobPosting, JobsRepository
from app.repositories.user import (
    OperatorDivision,
    OperatorTier,
    User,
    UserRepository,
)
from app.utils.state import AppState

#: The stored role a Platform Operator holds.
OPERATOR_ROLE = "platform_operator"

#: The Division whose write actions this slice implements.
JOBS_DIVISION: OperatorDivision = "jobs"

#: How many rows a console list returns.
OPERATIONS_LIST_LIMIT = 50

#: The two states a Job posting can be put into from the console.
JobStatus = Literal["published", "hidden"]


class OperationsOverview(BaseModel):
    """Which Division the caller runs, at what tier, and whether they may write."""

    division: str
    tier: str
    can_write: bool


class DivisionJob(BaseModel):
    """One Job posting in the operator's Division queue."""

    id: str
    title: str
    status: str
    country_code: str
    posted_at: datetime


class DivisionJobList(BaseModel):
    items: list[DivisionJob]


class UpdateJobStatusRequest(BaseModel):
    """Publish or hide a Job posting."""

    status: JobStatus


@dataclass(frozen=True)
class OperatorContext:
    """The signed-in Operator, with their Division and tier already narrowed."""

    user: User
    division: OperatorDivision
    tier: OperatorTier

    @property
    def can_write(self) -> bool:
        """Only a Lead writes inside a Division; an Assistant only reads."""
        return self.tier == "lead"


async def _require_operator(state: AppState, token: str) -> OperatorContext:
    """The signed-in Operator with an assigned Division, or a 403.

    A public token is refused by ``get_current_staff`` before the role is
    considered; an Admin's staff token reaches this function but fails the role
    check, because the console belongs to the Operator role.
    """
    actor: UserResponse = await get_current_staff(state, token)

    if actor.role != OPERATOR_ROLE:
        raise ForbiddenException(message="Only Platform Operators may use the operations console")

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

    if user is None or user.operator_division is None or user.operator_tier is None:
        raise ForbiddenException(message="This Operator has no Division assigned")

    return OperatorContext(
        user=user,
        division=user.operator_division,
        tier=user.operator_tier,
    )


def _require_division(context: OperatorContext, division: OperatorDivision) -> None:
    """Refuse a Division other than the caller's, before any row is read."""
    if context.division != division:
        raise ForbiddenException(message=f"This Operator is not scoped to the {division} Division")


def _require_write(context: OperatorContext) -> None:
    """Refuse a write from an Assistant; only a Lead may change their Division."""
    if not context.can_write:
        raise ForbiddenException(
            message="An Assistant Operator may view this Division but not write to it"
        )


def _serialize_job(posting: JobPosting) -> DivisionJob:
    return DivisionJob(
        id=posting.id,
        title=posting.title,
        status=posting.status,
        country_code=posting.country_code,
        posted_at=posting.posted_at,
    )


async def get_overview(state: AppState, *, token: str) -> OperationsOverview:
    """The caller's Division, tier, and whether they may write."""
    context = await _require_operator(state, token)

    return OperationsOverview(
        division=context.division,
        tier=context.tier,
        can_write=context.can_write,
    )


async def list_division_jobs(state: AppState, *, token: str) -> DivisionJobList:
    """Every Job posting in the caller's Division, whatever its status.

    Only an Operator scoped to the Jobs Division reaches the query; any other
    Division is refused first.
    """
    context = await _require_operator(state, token)
    _require_division(context, JOBS_DIVISION)

    async with state.db_session_maker() as session:
        postings = await JobsRepository.list_recent(session, limit=OPERATIONS_LIST_LIMIT)

    return DivisionJobList(items=[_serialize_job(posting) for posting in postings])


async def set_job_status(
    state: AppState,
    *,
    token: str,
    posting_id: str,
    request: UpdateJobStatusRequest,
) -> DivisionJob:
    """Publish or hide a Job posting. A Lead action within the Jobs Division."""
    context = await _require_operator(state, token)
    _require_division(context, JOBS_DIVISION)
    _require_write(context)

    async with state.db_session_maker() as session:
        posting = await JobsRepository.get_any(session, posting_id)

        if posting is None:
            raise NotFoundException(message="Job posting not found")

        posting.status = request.status
        await session.commit()

        return _serialize_job(posting)
