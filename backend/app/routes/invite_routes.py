from flask import Blueprint, request, jsonify
import boto3
import os
# from twilio.rest import Client
invite_bp = Blueprint('invite', __name__)

# AWS clients
ses = boto3.client(
    "ses", 
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("SES_SNS_KEY"),
    aws_secret_access_key=os.getenv("SES_SNS_SECRET")
)
# sns = boto3.client(
#     "sns", 
#     region_name="us-west-2",
#     aws_access_key_id=os.getenv("SES_SNS_KEY"),
#     aws_secret_access_key=os.getenv("SES_SNS_SECRET")
# )

# Twilio client
# client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))    


@invite_bp.route("/email", methods=["POST"])
def invite_email():
    data = request.json
    email = data.get("email")
    referral_code = data.get("referralCode")
    signup_url = f"{os.getenv('SIGNUP_URL')}?ref={referral_code}"
    print("Signup URL:", signup_url)
    print("SES Sender Email:", os.getenv("SES_SENDER_EMAIL"))

    try:
        response = ses.send_email(
            Source=os.getenv("SES_SENDER_EMAIL"),
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "Join this app with my referral code!"},
                "Body": {
                    "Text": {
                        "Data": f"Hey! Sign up here: {signup_url}"
                    }
                },
            },
        )
        print("SES Response:", response)
        return jsonify({"success": True, "message": "Email sent"})
    except Exception as e:
        print("SES Error:", str(e))   # 👈 log full error
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
