Go to backend
cd backend

For macOS: follow the instructions here https://realpython.com/python-virtual-environments-a-primer/ to create a venv virtual environment

Activate:
macOs: source {name of virtual environemnt}/bin/activate
Windows: .\{name of virtual environemnt}\Scripts\activate

Download requirements:
pip install -r requirements.txt

in the backend folder run:
macOs:
export FLASK_APP=app:create_app
export FLASK_ENV=development

Windows:
set FLASK_APP=app:create_app
set FLASK_ENV=development


Create database: (add python -m in front of each command in macOS)
delete the instance and migrations folders
flask db init
flask db migrate
flask db upgrade

run:
flask run
macOS: python -m flask run 

To run the ai_embeddings model before we integrate it within the app:
run:
make sure you're in the backend folder
flask analyze-conversation <user_id_1> <user_id_2>

## Test Mode for Email Verification

For development and testing, you can enable test mode to skip email verification for test email addresses.

### Setup

1. Create a `.env` file in the `backend` directory (if it doesn't exist)
2. Add the following environment variables:

```bash
# Enable test mode
TEST_MODE_ENABLED=true

# Optional: Specify custom test email domains (comma-separated)
# If not specified, defaults to: @test.com, @example.com
TEST_EMAIL_DOMAINS=@test.com,@example.com
```

### How It Works

- When `TEST_MODE_ENABLED=true` and a user signs up with a test email (e.g., `user@test.com`):
  - The account is created immediately
  - Email is auto-verified (no verification code needed)
  - A login token is returned immediately
  - No verification email is sent

- Regular emails (non-test domains) still require normal email verification

### Default Test Domains

If `TEST_EMAIL_DOMAINS` is not set, the following domains are used by default:
- `@test.com`
- `@example.com`
- `@test.local`

### Example Usage

```bash
# In backend/.env:
TEST_MODE_ENABLED=true
TEST_EMAIL_DOMAINS=@test.com,@mytest.com

# Then sign up with:
# - test@test.com ✅ (auto-verified, no email sent)
# - user@mytest.com ✅ (auto-verified, no email sent)
# - real@email.com ❌ (normal verification required)
```

**Note:** Test mode should only be enabled in development/testing environments, not in production.
