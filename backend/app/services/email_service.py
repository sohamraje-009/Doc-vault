from email.message import EmailMessage
from pathlib import Path
import smtplib

from app.core.config import get_settings

settings = get_settings()


def send_password_reset_email(to_email: str, code: str) -> bool:
    subject = "Devgiri Forgings Password Reset"
    body = f"""Hello,

You requested a password reset for your Devgiri Forgings account.

Your reset code is:

{code}

This code will expire in 15 minutes.

If you did not request this password reset, please ignore this email.

Devgiri Forgings Team
"""

    if (
        not settings.SMTP_HOST
        or not settings.SMTP_USERNAME
        or not settings.SMTP_PASSWORD
        or not settings.SMTP_FROM_EMAIL
    ):
        _write_dev_outbox(to_email, subject, body)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        _write_dev_outbox(to_email, subject, body)
        return False
    return True


def _write_dev_outbox(to_email: str, subject: str, body: str) -> None:
    outbox = Path("password_reset_outbox.log")
    with outbox.open("a", encoding="utf-8") as handle:
        handle.write(f"To: {to_email}\nSubject: {subject}\n\n{body}\n{'-' * 72}\n")
