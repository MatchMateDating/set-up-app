from flask import Blueprint, request, jsonify
import resend
import os
from urllib.parse import quote

invite_bp = Blueprint('invite', __name__)

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

    try:
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "Join MatchMate with my referral code!",
            "html": f"<p>Hey! Sign up here: <a href='{signup_url}'>{signup_url}</a></p>",
        })
        print("Resend Response:", response)
        return jsonify({"success": True, "message": "Email sent"})
    except Exception as e:
        print("Resend Error:", str(e))
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
