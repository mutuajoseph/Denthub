"""Outgoing email: one ``Mailer`` interface, a console and a Resend implementation.

The console mailer keeps what it "sent" in an outbox (tests read it) and logs
only the recipient and subject: bodies carry single-use links, and tokens never
reach the logs (#120). The one exception is ``ENVIRONMENT=local``, where the
body is logged so a developer can follow the link; local tokens guard nothing.
Resend is the production provider; switching provider means one new class here.

``send`` never raises. A delivery failure is logged and reported as ``False``,
so a flaky provider can't fail a signup or turn forgot-password into an oracle.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import httpx
from structlog.typing import FilteringBoundLogger

RESEND_API_URL = "https://api.resend.com/emails"


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    text: str


class Mailer(Protocol):
    async def send(self, email: OutgoingEmail) -> bool: ...


@dataclass
class ConsoleMailer:
    """Local development and tests: records each email; logs a body only if asked."""

    logger: FilteringBoundLogger
    #: Only the lifespan sets this, and only for ``ENVIRONMENT=local``.
    log_body: bool = False
    outbox: list[OutgoingEmail] = field(default_factory=list)

    async def send(self, email: OutgoingEmail) -> bool:
        self.outbox.append(email)
        if self.log_body:
            self.logger.info(
                "mail.sent", provider="console", to=email.to, subject=email.subject, text=email.text
            )
        else:
            self.logger.info("mail.sent", provider="console", to=email.to, subject=email.subject)
        return True


@dataclass
class ResendMailer:
    """Production: the Resend HTTP API, through the app's shared HTTP client."""

    api_key: str
    sender: str
    http: httpx.AsyncClient
    logger: FilteringBoundLogger

    async def send(self, email: OutgoingEmail) -> bool:
        try:
            response = await self.http.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "from": self.sender,
                    "to": [email.to],
                    "subject": email.subject,
                    "text": email.text,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            self.logger.error("mail.failed", provider="resend", subject=email.subject, error=str(e))
            return False

        self.logger.info("mail.sent", provider="resend", subject=email.subject)
        return True
