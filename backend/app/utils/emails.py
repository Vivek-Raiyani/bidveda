import aiosmtplib
from email.message import EmailMessage
from abc import ABC, abstractmethod
import httpx
import logging

logger = logging.getLogger(__name__)

from app.core.config import settings

class EmailProvider(ABC):
    """Abstract base class for all email providers."""
    
    @abstractmethod
    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Sends an email and returns True if successful."""
        pass


class SMTPEmailProvider(EmailProvider):
    """Implementation for standard SMTP email sending."""
    
    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.EMAILS_FROM_EMAIL

    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        if not self.host:
            logger.warning("SMTP Host is not configured.")
            return False

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = self.from_email
        msg['To'] = to_email
        msg.set_content(html_content, subtype='html')

        try:
            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self.password,
                use_tls=(self.port == 465),
                start_tls=(self.port == 587),
            )

            return True
        except Exception as e:
            logger.error(f"Failed to send SMTP email: {e}")
            return False


class ResendEmailProvider(EmailProvider):
    """Implementation for sending emails via Resend API."""
    
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.EMAILS_FROM_EMAIL
        self.api_url = "https://api.resend.com/emails"

    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        if not self.api_key:
            logger.warning("Resend API Key is not configured.")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.api_url, json=data, headers=headers)
                response.raise_for_status()
                return True
            except Exception as e:
                logger.error(f"Failed to send Resend email: {e}")
                return False


def get_email_provider() -> EmailProvider:
    """Factory to return the configured email provider."""
    provider = getattr(settings, "EMAIL_PROVIDER", "smtp").lower()
    
    if provider == "resend":
        return ResendEmailProvider()
    else:
        # Defaults to SMTP (which can be used for custom domains or providers like SendGrid via SMTP)
        return SMTPEmailProvider()


# Singleton
email_provider = get_email_provider()
