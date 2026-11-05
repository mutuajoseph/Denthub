from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.appointment import AppointmentRepository
from app.repositories.deletion import DeletionRepository
from app.repositories.health_record import HealthRecordRepository
from app.repositories.message import ConversationRepository
from app.repositories.user import UserRepository
from app.utils.state import AppState


class PurgeResult(BaseModel):
    expired_requests: int
    purged_accounts: int
    purged_specialist_shells: int
    purged_supplier_shells: int
    purged_training_provider_shells: int


DELETED_SPECIALIST_PREFIX = "deleted-specialist-"


async def purge_expired_accounts(
    state: AppState,
    *,
    now: datetime | None = None,
) -> PurgeResult:
    if now is None:
        now = datetime.now(UTC).replace(tzinfo=None)

    request_rows = await _list_expired_request_ids(state, now)
    result = PurgeResult(
        expired_requests=len(request_rows),
        purged_accounts=0,
        purged_specialist_shells=0,
        purged_supplier_shells=0,
        purged_training_provider_shells=0,
    )

    for user_id in request_rows:
        async with state.db_session_maker() as session:
            request = await DeletionRepository.get_by_user(session, user_id)
            if (
                request is None
                or request.status != "completed"
                or request.retention_until is None
                or request.retention_until > now
            ):
                continue

            user = await UserRepository.get_by_id(session, user_id)

            # Health record: drop the Patient's retained entries, then the (now empty) record.
            record = await HealthRecordRepository.get_by_patient(session, user_id)
            if record is not None:
                await HealthRecordRepository.delete_all_entries(session, record_id=record.id)
                await HealthRecordRepository.delete_record(session, record)

            # Appointments, then conversations and messages (children before parents).
            await AppointmentRepository.delete_for_patient(session, patient_id=user_id)
            await ConversationRepository.delete_for_user(session, user_id=user_id)

            # Detached business shells that no longer have an owner.
            specialist_shells = await _purge_specialist_shells(session)
            supplier_shells = await _purge_supplier_shells(session)
            training_shells = await _purge_training_provider_shells(session)
            result.purged_specialist_shells += specialist_shells
            result.purged_supplier_shells += supplier_shells
            result.purged_training_provider_shells += training_shells

            if user is not None:
                await session.delete(user)
            await session.delete(request)
            await session.commit()
            result.purged_accounts += 1

            state.logger.info(
                "deletion.purged",
                user_id=user_id,
                specialist_shells=specialist_shells,
                supplier_shells=supplier_shells,
                training_provider_shells=training_shells,
            )

    return result


async def _list_expired_request_ids(state: AppState, now: datetime) -> list[str]:
    async with state.db_session_maker() as session:
        requests = await DeletionRepository.list_expired(session, now=now)
        return [request.user_id for request in requests]


async def _purge_specialist_shells(session: AsyncSession) -> int:
    from sqlalchemy import select

    from app.repositories.listing import Specialist

    stmt = select(Specialist).where(Specialist.user_id.is_(None))
    specialists = list((await session.execute(stmt)).scalars().all())
    count = 0
    for specialist in specialists:
        if getattr(specialist, "slug", "").startswith(DELETED_SPECIALIST_PREFIX):
            await session.delete(specialist)
            count += 1
    return count


async def _purge_supplier_shells(session: AsyncSession) -> int:
    from sqlalchemy import select

    from app.repositories.product import Product, Supplier

    stmt = select(Supplier).where(Supplier.owner_user_id.is_(None))
    suppliers = list((await session.execute(stmt)).scalars().all())
    count = 0
    for supplier in suppliers:
        stmt_product = select(Product).where(Product.supplier_id == supplier.id)
        products = list((await session.execute(stmt_product)).scalars().all())
        if not products:
            await session.delete(supplier)
            count += 1
    return count


async def _purge_training_provider_shells(session: AsyncSession) -> int:
    from sqlalchemy import select

    from app.repositories.training import TrainingCourse, TrainingProvider, TrainingWebinar

    stmt = select(TrainingProvider).where(TrainingProvider.owner_user_id.is_(None))
    providers = list((await session.execute(stmt)).scalars().all())
    count = 0
    for provider in providers:
        course_row = await session.execute(
            select(TrainingCourse.id).where(TrainingCourse.provider_id == provider.id)
        )
        course_count = int(course_row.first() is not None)
        webinar_row = await session.execute(
            select(TrainingWebinar.id).where(TrainingWebinar.provider_id == provider.id)
        )
        webinar_count = int(webinar_row.first() is not None)
        if not course_count and not webinar_count:
            await session.delete(provider)
            count += 1
    return count
