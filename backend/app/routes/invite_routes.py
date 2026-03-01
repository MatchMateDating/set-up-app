from flask import Blueprint, request, jsonify
import resend
import os
from urllib.parse import quote

invite_bp = Blueprint('invite', __name__)

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY")
SENDER_EMAIL = "donotreply@matchmatedating.com"


def get_matchmate_logo_data_uri():
    """Return inline base64 data URI for the MatchMate logo."""
    try:
        # backend/app/routes/invite_routes.py -> repo root is parents[3]
        repo_root = Path(__file__).resolve().parents[3]
        logo_path = repo_root / "matchmaker-mobile" / "assets" / "matchmate_logo.png"
        if not logo_path.exists():
            return None
        encoded = base64.b64encode(logo_path.read_bytes()).decode("ascii")
        return f"data:image/png;base64,{encoded}"
    except Exception:
        return None


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
    logo_data_uri = get_matchmate_logo_data_uri()
    referral_code_display = str(referral_code or "").strip() or "N/A"

    try:
        response = resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "You've Been Invited to MatchMate",
            "html": f"""
              <div style="background:#f8f8fc;padding:28px 14px;font-family:Arial,sans-serif;color:#1a1a2e;">
                <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e7ef;border-radius:14px;padding:28px;">
                  <h2 style="margin:0 0 8px;text-align:center;font-size:24px;line-height:1.2;">Become a Matchmaker on MatchMate</h2>
                  <p style="margin:0 0 18px;text-align:center;color:#61617a;font-size:15px;line-height:1.5;">
                    Someone invited you to help them find better matches.
                  </p>

                  <p style="margin:0 0 8px;font-size:14px;color:#4a4a68;">Your referral code:</p>
                  <div style="margin:0 0 20px;padding:12px 14px;border:1px dashed #6c5ce7;border-radius:10px;background:#fafaff;text-align:center;">
                    <span style="font-size:18px;font-weight:700;letter-spacing:1px;color:#6c5ce7;">{referral_code_display}</span>
                  </div>

                  <div style="text-align:center;margin:0 0 18px;">
                    <a
                      href="{signup_url}"
                      style="display:inline-block;background:#6c5ce7;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;"
                    >
                      Create Matchmaker Account
                    </a>
                  </div>

                  <p style="margin:0 0 8px;font-size:12px;color:#7a7a92;">If the button doesn't work, use this link:</p>
                  <p style="margin:0;word-break:break-all;font-size:12px;color:#6c5ce7;">{signup_url}</p>
                </div>
              </div>
            """,
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
