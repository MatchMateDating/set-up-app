from flask import Blueprint, request, jsonify
import resend
import os
import re
from html import escape
from urllib.parse import quote
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.userDB import User
from app.dater_invite_tokens import encode_matchmaker_dater_invite

invite_bp = Blueprint('invite', __name__)

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY")
SENDER_EMAIL = "donotreply@matchmatedating.com"


@invite_bp.route("/email", methods=["POST"])
def invite_email():
    data = request.json
    email = data.get("email")
    referral_code = data.get("referralCode")
    frontend_url = (os.getenv("FRONTEND_URL") or "https://matchmatedating.com").rstrip("/")
    base_signup_url = f"{frontend_url}/matchmaker-signup.html"
    separator = '&' if '?' in base_signup_url else '?'
    signup_url = f"{base_signup_url}{separator}referral_code={quote(str(referral_code or ''))}"
    print("Signup URL:", signup_url)
    referral_code_display = str(referral_code or "").strip() or "N/A"
    ref_esc = escape(referral_code_display)
    url_esc = escape(signup_url, quote=True)
    subject = "Complete your MatchMate matchmaker signup"
    text_body = (
        f"Hello,\n\n"
        f"Someone invited you to join MatchMate as a matchmaker. When you sign up, use this referral code:\n"
        f"{referral_code_display}\n\n"
        f"Open this link to create your account:\n{signup_url}\n\n"
        f"If you did not expect this email, you can ignore it.\n\n"
        f"Best regards,\nThe MatchMate Team"
    )
    html_body = f"""<html>
            <head></head>
            <body>
              <h2>Hello,</h2>
              <p>Someone invited you to join MatchMate as a matchmaker. When you sign up, use this referral code:</p>
              <p><strong>Referral code: {ref_esc}</strong></p>
              <p>Use the link below to finish signing up:</p>
              <p><a href="{url_esc}" style="background-color: #6B46C1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Create your matchmaker account</a></p>
              <p>Or copy and paste this link into your browser:</p>
              <p>{url_esc}</p>
              <p>If you did not expect this email, you can ignore it.</p>
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""

    try:
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        })
        print("Resend Response:", response)
        return jsonify({"success": True, "message": "Email sent"})
    except Exception as e:
        print("Resend Error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500


@invite_bp.route("/dater-signup-email", methods=["POST"])
@jwt_required()
def invite_dater_signup_email():
    """Matchmaker sends hosted dater signup link to an email address."""
    data = request.get_json() or {}
    to_email = (data.get("email") or "").strip().lower()
    if not to_email or not _EMAIL_RE.match(to_email):
        return jsonify({"error": "A valid email address is required"}), 400

    current_user_id = get_jwt_identity()
    try:
        mm_id = int(current_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Unauthorized"}), 401

    matchmaker = User.query.get(mm_id)
    if not matchmaker or matchmaker.role != "matchmaker":
        return jsonify({"error": "Only matchmakers can send dater invite emails"}), 403

    invite_token = encode_matchmaker_dater_invite(matchmaker.id)
    frontend_url = (os.getenv("FRONTEND_URL") or "https://matchmatedating.com").rstrip("/")
    base_signup_url = f"{frontend_url}/dater-signup.html"
    separator = "&" if "?" in base_signup_url else "?"
    signup_url = f"{base_signup_url}{separator}invite_token={quote(invite_token)}"
    mm_name = (matchmaker.first_name or "").strip() or "Your matchmaker"
    mm_esc = escape(mm_name)
    url_esc = escape(signup_url, quote=True)
    subject = "Complete your MatchMate dater signup"
    text_body = (
        f"Hello,\n\n"
        f"{mm_name} sent you a link to create your MatchMate dater account so they can help you find matches.\n\n"
        f"Open this link to sign up:\n{signup_url}\n\n"
        f"If you did not expect this email, you can ignore it.\n\n"
        f"Best regards,\nThe MatchMate Team"
    )
    html_body = f"""<html>
            <head></head>
            <body>
              <h2>Hello,</h2>
              <p>{mm_esc} sent you a link to create your MatchMate dater account so they can help you find matches.</p>
              <p>Use the link below to finish signing up:</p>
              <p><a href="{url_esc}" style="background-color: #6B46C1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Create your dater account</a></p>
              <p>Or copy and paste this link into your browser:</p>
              <p>{url_esc}</p>
              <p>If you did not expect this email, you can ignore it.</p>
              <p>Best regards,<br>The MatchMate Team</p>
            </body>
            </html>"""

    try:
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        })
        print("Resend dater invite:", response)
        return jsonify({"success": True, "message": "Email sent"})
    except Exception as e:
        print("Resend dater invite error:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500


# @invite_bp.route("/text", methods=["POST"])
# def invite_text():
#     data = request.json
#     phone = data.get("phone")
#     referral_code = data.get("referralCode")
#     signup_url = f"{os.getenv('SIGNUP_URL')}?ref={referral_code}"

#     try:
#         message = client.messages.create(
#             body=f"Hello",
#             from_=os.getenv("TWILIO_PHONE_NUMBER"),
#             to=phone
#         )
#         print("Twilio Message SID:", message.sid)
#         return jsonify({"success": True, "message": "Text sent"})
#     except Exception as e:
#         print("Twilio Error:", str(e))

# AWS SNS version
# def invite_text():
#     data = request.json
#     phone = data.get("phone")
#     referral_code = data.get("referralCode")
#     signup_url = f"{os.getenv('SIGNUP_URL')}?ref={referral_code}"

#     try:
#         sns.publish(
#             PhoneNumber=phone,
#             Message=f"Join this app using my referral code! Sign up here: {signup_url}",
#         )
#         return jsonify({"success": True, "message": "Text sent"})
#     except Exception as e:
#         return jsonify({"success": False, "error": str(e)}), 500
