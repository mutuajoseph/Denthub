"""Verification applications: submit, review and the decision state machine (PRD §3.13).

An application is pending until a staff member decides it. Approval verifies
the subject (tier `verified` for a Facility/Specialist, `is_verified` for a
Supplier/Training Provider); rejection needs a reason; revocation applies to a
verified application and drops verification entirely. Every decision is
audited and emailed to the applicant.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal, cast

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ForbiddenException, InvalidRequestError, NotFoundException
from app.logic.v1.audit import audit
from app.logic.v1.operations import (
    OperatorContext,
    _require_division,
    _require_operator,
    _require_write,
)
from app.repositories.listing import Facility, Specialist, SpecialistRepository
from app.repositories.product import Supplier, SupplierRepository
from app.repositories.profile import ProfileRepository
from app.repositories.training import TrainingProvider, TrainingRepository
from app.repositories.user import OperatorDivision, User
from app.repositories.verification import (
    ApplicationStatus,
    SubjectKind,
    VerificationApplication,
    VerificationRepository,
)
from app.utils.mailer import OutgoingEmail
from app.utils.state import AppState

Decision = Literal["approve", "reject", "revoke"]
MAX_APPLICATIONS_LIST = 50
MAX_DOCUMENT_KEYS = 5

#: Which Operator Division reviews which subject kind (ADR-0005, #124).
SUBJECT_DIVISION: dict[SubjectKind, OperatorDivision] = {
    "specialist": "dentist",
    "facility": "dentist",
    "supplier": "suppliers",
    "training_provider": "training",
}

#: Which stored roles may apply for each subject kind (PRD §2). Roles are set
#: by the server, never chosen in the request body.
SUBJECT_ROLES: dict[SubjectKind, frozenset[str]] = {
    "specialist": frozenset({"dentist", "specialist", "intern"}),
    "facility": frozenset({"facility_owner"}),
    "supplier": frozenset({"supplier"}),
    "training_provider": frozenset({"training_provider"}),
}


class CreateVerificationRequest(BaseModel):
    """A professional's evidence, with opaque private-bucket object keys."""

    subject_kind: SubjectKind
    licence_number: str = Field(min_length=1, max_length=100)
    issuing_body: str = Field(min_length=1, max_length=200)
    document_keys: list[str] = Field(min_length=1, max_length=MAX_DOCUMENT_KEYS)


class DecisionRequest(BaseModel):
    """A reason is required to reject or revoke, never to approve."""

    reason: str | None = Field(default=None, max_length=500)


class VerificationApplicationView(BaseModel):
    """One application, as the applicant or a reviewer reads it."""

    id: str
    subject_kind: SubjectKind
    subject_id: str
    applicant_email: str
    licence_number: str
    issuing_body: str
    document_keys: list[str]
    status: ApplicationStatus
    rejection_reason: str | None
    created_at: datetime
    decided_at: datetime | None


class VerificationApplicationList(BaseModel):
    items: list[VerificationApplicationView]


def _view(application: VerificationApplication) -> VerificationApplicationView:
    return VerificationApplicationView(
        id=application.id,
        subject_kind=application.subject_kind,
        subject_id=application.subject_id,
        applicant_email=application.applicant_email,
        licence_number=application.licence_number,
        issuing_body=application.issuing_body,
        document_keys=list(application.document_keys),
        status=application.status,
        rejection_reason=application.rejection_reason,
        created_at=application.created_at,
        decided_at=application.decided_at,
    )


async def _resolve_subject(session: AsyncSession, *, actor: User, kind: SubjectKind) -> str:
    """The one subject of this kind the caller acts for, or a 400/404."""
    if kind == "specialist":
        listing = await SpecialistRepository.get_by_user(session, actor.id)
        if listing is None:
            raise NotFoundException(message="Create your Specialist listing before applying")
        return listing.id

    if kind == "facility":
        owned = await ProfileRepository.owned_facility_ids(session, actor.id)
        if len(owned) != 1:
            raise InvalidRequestError(message="An owner must act for exactly one Facility")
        return owned[0]

    if kind == "supplier":
        supplier = await SupplierRepository.get_by_owner(session, actor.id)
        if supplier is None:
            raise NotFoundException(message="No Supplier owned by this account")
        return supplier.id

    provider = await TrainingRepository.get_provider_by_owner(session, actor.id)
    if provider is None:
        raise NotFoundException(message="No Training Provider owned by this account")
    return provider.id


async def submit_verification(
    state: AppState, *, actor: User, data: CreateVerificationRequest
) -> VerificationApplicationView:
    """Open a new application for a subject the caller actually acts for."""
    for key in data.document_keys:
        if not key.strip() or len(key) > 255:
            raise InvalidRequestError(message="Document keys must be 1–255 characters")

    if actor.role not in SUBJECT_ROLES[data.subject_kind]:
        raise ForbiddenException(message="Your account may not apply for this subject kind")

    async with state.db_session_maker() as session:
        subject_id = await _resolve_subject(session, actor=actor, kind=data.subject_kind)
        if (
            await VerificationRepository.pending_for_subject(
                session, subject_kind=data.subject_kind, subject_id=subject_id
            )
            is not None
        ):
            raise ConflictError(message="This subject already has a pending application")

        application = await VerificationRepository.create(
            session,
            user_id=actor.id,
            applicant_email=actor.email,
            subject_kind=data.subject_kind,
            subject_id=subject_id,
            licence_number=data.licence_number.strip(),
            issuing_body=data.issuing_body.strip(),
            document_keys=data.document_keys,
        )
        await session.commit()
        return _view(application)


async def my_verifications(state: AppState, *, actor: User) -> VerificationApplicationList:
    """The caller's most recent application, if they have one."""
    async with state.db_session_maker() as session:
        latest = await VerificationRepository.latest_for_user(session, actor.id)
        return VerificationApplicationList(items=[_view(latest)] if latest else [])


async def admin_verification_queue(
    state: AppState, *, limit: int = MAX_APPLICATIONS_LIST
) -> VerificationApplicationList:
    """Every application, newest first, for the admin console."""
    async with state.db_session_maker() as session:
        applications = await VerificationRepository.list_applications(
            session, subject_kinds=None, limit=limit
        )
        return VerificationApplicationList(items=[_view(row) for row in applications])


async def operations_verification_queue(
    state: AppState, *, actor: User, limit: int = MAX_APPLICATIONS_LIST
) -> VerificationApplicationList:
    """Only applications in the Operator's own Division (ADR-0005)."""
    context = _require_operator(actor)
    kinds = tuple(
        kind for kind, division in SUBJECT_DIVISION.items() if division == context.division
    )
    async with state.db_session_maker() as session:
        applications = await VerificationRepository.list_applications(
            session, subject_kinds=kinds, limit=limit
        )
        return VerificationApplicationList(items=[_view(row) for row in applications])


async def decide_verification_as_operator(
    state: AppState,
    *,
    actor: User,
    application_id: str,
    decision: Decision,
    reason: str | None,
) -> VerificationApplicationView:
    """Lead-only decision in the caller's own Division (ADR-0005)."""
    return await decide_verification(
        state,
        actor=actor,
        application_id=application_id,
        decision=decision,
        reason=reason,
        operator=_require_operator(actor),
    )


async def _set_subject_verification(
    session: AsyncSession, *, kind: SubjectKind, subject_id: str, verified: bool
) -> list[str]:
    """Verify (or drop verification for) the subject; list a newly verified Facility."""
    model = {
        "specialist": Specialist,
        "facility": Facility,
        "supplier": Supplier,
        "training_provider": TrainingProvider,
    }[kind]
    subject = await session.get(model, subject_id)
    if subject is None:
        raise NotFoundException(message="The application's subject no longer exists")

    field = "verification_tier" if kind in ("specialist", "facility") else "is_verified"
    value = ("verified" if verified else "unverified") if field == "verification_tier" else verified
    setattr(subject, field, value)

    listed: list[str] = []
    if kind == "facility" and verified:
        facility = cast(Facility, subject)
        # The retired /users/{id}/approve route used to list signup Facilities.
        if not facility.listed:
            facility.listed = True
            listed.append(facility.id)
    await session.flush()
    return listed


async def decide_verification(
    state: AppState,
    *,
    actor: User,
    application_id: str,
    decision: Decision,
    reason: str | None,
    operator: OperatorContext | None = None,
) -> VerificationApplicationView:
    """Apply one legal transition, audit it and email the applicant."""
    if decision in ("reject", "revoke") and not (reason or "").strip():
        raise InvalidRequestError(message="A reason is required to reject or revoke")

    if operator is not None:
        _require_write(operator)

    async with state.db_session_maker() as session:
        application = await VerificationRepository.get(session, application_id)
        if application is None:
            raise NotFoundException(message="Verification application not found")

        if operator is not None:
            _require_division(operator, SUBJECT_DIVISION[application.subject_kind])

        before: dict[str, object] = {"status": application.status}
        if decision == "approve":
            if application.status != "pending":
                raise ConflictError(message="Only a pending application may be approved")
            application.status = "verified"
            application.rejection_reason = None
        elif decision == "reject":
            if application.status != "pending":
                raise ConflictError(message="Only a pending application may be rejected")
            application.status = "rejected"
            application.rejection_reason = reason
        else:
            if application.status != "verified":
                raise ConflictError(message="Only a verified application may be revoked")
            application.status = "revoked"
            application.rejection_reason = reason

        listed_facility_ids: list[str] = []
        if decision in ("approve", "revoke"):
            listed_facility_ids = await _set_subject_verification(
                session,
                kind=application.subject_kind,
                subject_id=application.subject_id,
                verified=decision == "approve",
            )

        application.decided_by_user_id = actor.id
        application.decided_at = datetime.now(UTC).replace(tzinfo=None)
        await audit(
            session,
            actor,
            action=f"verification.{decision}",
            entity_type="verification",
            entity_id=application.id,
            before=before,
            after={
                "status": application.status,
                "subject_kind": application.subject_kind,
                "subject_id": application.subject_id,
                **({"reason": reason} if reason else {}),
                **({"listed_facility_ids": listed_facility_ids} if listed_facility_ids else {}),
            },
        )
        await session.commit()
        view = _view(application)

    text = (
        f"Hi,\n\nYour DentHub verification application has been {application.status}.\n\n"
        f"{reason or ''}\n\n"
        "If you did not apply for verification, you can ignore this email."
    )
    await state.mailer.send(
        OutgoingEmail(
            to=view.applicant_email,
            subject=f"DentHub verification {view.status}",
            text=text,
        )
    )
    return view
