"""Email/SMS alerts when a matchmaker links to a dater via referral code."""

import os

import resend
from sqlalchemy import or_
from twilio.rest import Client

from app.models.userDB import ReferredUsers

SENDER_EMAIL = "donotreply@matchmatedating.com"
resend.api_key = os.getenv("RESEND_API_KEY")


def _get_twilio_client():
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if account_sid and auth_token:
        return Client(account_sid, auth_token)
    return None


def count_linked_matchmakers_for_dater(dater_id):
    if not dater_id:
        return 0
    slot_filters = [
        getattr(ReferredUsers, f"linked_dater_{i}_id") == dater_id
        for i in range(1, 11)
    ]
    return ReferredUsers.query.filter(or_(*slot_filters)).count()


def _matchmaker_display_name(matchmaker):
    name = (matchmaker.first_name or "").strip()
    return name or "A matchmaker"


def _dater_contact_channel(dater):
    email = (dater.email or "").strip()
    phone = (dater.phone_number or "").strip()
    if email:
        return "email", email
    if phone:
        return "phone", phone
    return None, None


def _message_bodies(dater, matchmaker, is_first_matchmaker):
    mm_name = _matchmaker_display_name(matchmaker)
    dater_name = (dater.first_name or "").strip() or "there"

    if is_first_matchmaker:
        subject = "Congratulations! You can now match"
        email_html = f"""<html>
            <head></head>
            <body>
              <h2>Hello {dater_name},</h2>
              <p>Congratulations! {mm_name} has signed up using your referral code. You can now start matching in MatchMate.</p>
              <p>Open the app to view potential matches.</p>
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""
        sms_body = (
            f"Congratulations! {mm_name} has signed up using your referral code. "
            f"You can now start matching in MatchMate."
        )
    else:
        subject = "A matchmaker linked to your account"
        email_html = f"""<html>
            <head></head>
            <body>
              <h2>Hello {dater_name},</h2>
              <p>{mm_name} has signed up using your referral code and is now linked to your account as a matchmaker.</p>
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""
        sms_body = (
            f"{mm_name} has signed up using your referral code and is now linked "
            f"to your account as a matchmaker."
        )

    return subject, email_html, sms_body


def _send_matchmaker_linked_email(to_email, subject, html_body):
    try:
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        print(f"Matchmaker linked email sent to {to_email}: {response.get('id')}")
        return True
    except Exception as exc:
        print(f"Error sending matchmaker linked email to {to_email}: {exc}")
        return False


def _send_matchmaker_linked_sms(phone_number, body):
    try:
        client = _get_twilio_client()
        if not client:
            print("Twilio credentials not configured")
            return False

        twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
        if not twilio_phone:
            print("TWILIO_PHONE_NUMBER not configured")
            return False

        message = client.messages.create(
            body=body,
            from_=twilio_phone,
            to=phone_number,
        )
        print(f"Matchmaker linked SMS sent to {phone_number}: {message.sid}")
        return True
    except Exception as exc:
        print(f"Error sending matchmaker linked SMS to {phone_number}: {exc}")
        return False


def notify_dater_matchmaker_referral_link(matchmaker, dater, *, already_linked=False):
    """Notify a dater that a matchmaker linked using their referral code."""
    if already_linked or not matchmaker or not dater:
        return False
    if matchmaker.role != "matchmaker" or dater.role != "user":
        return False

    channel, destination = _dater_contact_channel(dater)
    if not channel:
        print(f"No email or phone on file for dater {dater.id}; skipping link notification")
        return False

    is_first_matchmaker = count_linked_matchmakers_for_dater(dater.id) == 1
    subject, email_html, sms_body = _message_bodies(dater, matchmaker, is_first_matchmaker)

    if channel == "email":
        return _send_matchmaker_linked_email(destination, subject, email_html)
    return _send_matchmaker_linked_sms(destination, sms_body)
