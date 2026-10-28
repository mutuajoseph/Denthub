"""HTTP-level tests for email verification and the password lifecycle (#120).

Every email goes through the console mailer, so a test reads what was "sent"
from its outbox and follows the link the way a user would. Tokens are
single-use and expire; forgot-password answers the same whether or not the
email has an account.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import update

from app.repositories.user_token import UserToken
from app.utils.mailer import ConsoleMailer, OutgoingEmail
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
NEW_PASSWORD = "a different long passphrase"


def _outbox(state: AppState) -> list[OutgoingEmail]:
    assert isinstance(state.mailer, ConsoleMailer)
    return state.mailer.outbox


def _token_in(email: OutgoingEmail) -> str:
    match = re.search(r"token=([A-Za-z0-9_-]+)", email.text)
    assert match, email.text
    return match.group(1)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _sign_up(client: AsyncClient, email: str = "amina@example.com") -> dict[str, Any]:
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Amina Wanjiku", "email": email, "password": PASSWORD},
    )
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


async def _forgot(client: AsyncClient, email: str) -> Any:
    return await client.post("/api/v1/auth/password/forgot", json={"email": email})


async def _expire_all_tokens(state: AppState) -> None:
    async with state.db_session_maker() as session:
        past = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
        await session.execute(update(UserToken).values(expires_at=past))
        await session.commit()


# --- Email verification ------------------------------------------------------


async def test_signup_emails_a_verification_link_and_me_reports_unverified(
    client: AsyncClient, state: AppState
) -> None:
    auth = await _sign_up(client)

    [email] = _outbox(state)
    assert email.to == "amina@example.com"
    assert "/verify-email?token=" in email.text
    assert auth["user"]["email_verified"] is False


async def test_the_verification_link_verifies_the_email(
    client: AsyncClient, state: AppState
) -> None:
    auth = await _sign_up(client)
    token = _token_in(_outbox(state)[0])

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})

    assert response.status_code == 204
    me = await client.get("/api/v1/auth/me", headers=_bearer(auth["access_token"]))
    assert me.json()["email_verified"] is True


async def test_a_verification_token_works_once(client: AsyncClient, state: AppState) -> None:
    await _sign_up(client)
    token = _token_in(_outbox(state)[0])
    await client.post("/api/v1/auth/verify-email", json={"token": token})

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})

    assert response.status_code == 400


async def test_an_expired_verification_token_is_refused(
    client: AsyncClient, state: AppState
) -> None:
    await _sign_up(client)
    token = _token_in(_outbox(state)[0])
    await _expire_all_tokens(state)

    response = await client.post("/api/v1/auth/verify-email", json={"token": token})

    assert response.status_code == 400


async def test_resend_emails_a_fresh_link_and_retires_the_old_one(
    client: AsyncClient, state: AppState
) -> None:
    auth = await _sign_up(client)
    first = _token_in(_outbox(state)[0])

    response = await client.post(
        "/api/v1/auth/verify-email/resend", headers=_bearer(auth["access_token"])
    )

    assert response.status_code == 204
    second = _token_in(_outbox(state)[1])
    assert second != first
    stale = await client.post("/api/v1/auth/verify-email", json={"token": first})
    assert stale.status_code == 400
    fresh = await client.post("/api/v1/auth/verify-email", json={"token": second})
    assert fresh.status_code == 204


async def test_resend_is_refused_once_the_email_is_verified(
    client: AsyncClient, state: AppState
) -> None:
    auth = await _sign_up(client)
    await client.post(
        "/api/v1/auth/verify-email", json={"token": _token_in(_outbox(state)[0])}
    )

    response = await client.post(
        "/api/v1/auth/verify-email/resend", headers=_bearer(auth["access_token"])
    )

    assert response.status_code == 409


async def test_resend_needs_a_signed_in_user(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/verify-email/resend")

    assert response.status_code == 401


# --- Forgot and reset --------------------------------------------------------


async def test_forgot_answers_identically_for_known_and_unknown_emails(
    client: AsyncClient, state: AppState
) -> None:
    await _sign_up(client)
    sent_before = len(_outbox(state))

    known = await _forgot(client, "amina@example.com")
    unknown = await _forgot(client, "nobody@example.com")

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    # Only the real account is emailed.
    assert [e.to for e in _outbox(state)[sent_before:]] == ["amina@example.com"]


async def test_a_reset_link_sets_the_new_password(client: AsyncClient, state: AppState) -> None:
    await _sign_up(client)
    await _forgot(client, "amina@example.com")
    token = _token_in(_outbox(state)[-1])
    assert "/reset-password?token=" in _outbox(state)[-1].text

    response = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD}
    )

    assert response.status_code == 204
    old = await client.post(
        "/api/v1/auth/login", json={"email": "amina@example.com", "password": PASSWORD}
    )
    new = await client.post(
        "/api/v1/auth/login", json={"email": "amina@example.com", "password": NEW_PASSWORD}
    )
    assert old.status_code == 401
    assert new.status_code == 200


async def test_a_reset_token_works_once(client: AsyncClient, state: AppState) -> None:
    await _sign_up(client)
    await _forgot(client, "amina@example.com")
    token = _token_in(_outbox(state)[-1])
    body = {"token": token, "new_password": NEW_PASSWORD}
    await client.post("/api/v1/auth/password/reset", json=body)

    response = await client.post("/api/v1/auth/password/reset", json=body)

    assert response.status_code == 400


async def test_an_expired_reset_token_is_refused(client: AsyncClient, state: AppState) -> None:
    await _sign_up(client)
    await _forgot(client, "amina@example.com")
    token = _token_in(_outbox(state)[-1])
    await _expire_all_tokens(state)

    response = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD}
    )

    assert response.status_code == 400


async def test_a_verification_token_cannot_reset_a_password(
    client: AsyncClient, state: AppState
) -> None:
    await _sign_up(client)
    verify_token = _token_in(_outbox(state)[0])

    response = await client.post(
        "/api/v1/auth/password/reset",
        json={"token": verify_token, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400


async def test_a_reset_signs_out_existing_sessions(client: AsyncClient, state: AppState) -> None:
    auth = await _sign_up(client)
    await _forgot(client, "amina@example.com")
    token = _token_in(_outbox(state)[-1])

    await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": NEW_PASSWORD}
    )

    me = await client.get("/api/v1/auth/me", headers=_bearer(auth["access_token"]))
    assert me.status_code == 401


async def test_a_new_password_over_72_bytes_is_a_422(client: AsyncClient, state: AppState) -> None:
    await _sign_up(client)
    await _forgot(client, "amina@example.com")
    token = _token_in(_outbox(state)[-1])

    response = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": "é" * 40}
    )

    assert response.status_code == 422


# --- Change ------------------------------------------------------------------


async def test_change_needs_the_current_password(client: AsyncClient) -> None:
    auth = await _sign_up(client)

    response = await client.post(
        "/api/v1/auth/password/change",
        headers=_bearer(auth["access_token"]),
        json={"current_password": "wrong password", "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 400


async def test_change_returns_a_fresh_session_and_ends_the_old_one(client: AsyncClient) -> None:
    auth = await _sign_up(client)

    response = await client.post(
        "/api/v1/auth/password/change",
        headers=_bearer(auth["access_token"]),
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )

    assert response.status_code == 200
    fresh = response.json()["access_token"]
    assert (await client.get("/api/v1/auth/me", headers=_bearer(fresh))).status_code == 200
    stale = await client.get("/api/v1/auth/me", headers=_bearer(auth["access_token"]))
    assert stale.status_code == 401


# --- Logs --------------------------------------------------------------------


class _RecordingLogger:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def info(self, event: str, **kw: Any) -> None:
        self.calls.append((event, kw))


async def test_the_console_mailer_never_logs_the_message_body() -> None:
    logger = _RecordingLogger()
    mailer = ConsoleMailer(logger=logger)  # type: ignore[arg-type]
    secret = "s3cr3t-token-value"

    await mailer.send(
        OutgoingEmail(to="amina@example.com", subject="Reset", text=f"?token={secret}")
    )

    assert logger.calls
    assert secret not in repr(logger.calls)
