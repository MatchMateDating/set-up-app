Go to backend
cd backend

## Create Virtual Environment

**macOS/Linux:**
Follow the instructions here https://realpython.com/python-virtual-environments-a-primer/ to create a venv virtual environment

**Windows:**
```bash
python -m venv venv
```

## Activate Virtual Environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Set Environment Variables

**macOS/Linux:**
```bash
export FLASK_APP=app:create_app
export FLASK_ENV=development
```

**Windows (Command Prompt):**
```bash
set FLASK_APP=app:create_app
set FLASK_ENV=development
```

**Windows (PowerShell):**
```powershell
$env:FLASK_APP="app:create_app"
$env:FLASK_ENV="development"
```

## Setup Environment File

**All platforms:**
```bash
cp env.template .env
# Then edit .env with your actual values
```

## Create Database

**macOS/Linux:**
```bash
# Delete the instance and migrations folders if they exist
rm -rf instance migrations

# Initialize and migrate database
python -m flask db init
python -m flask db migrate
python -m flask db upgrade
```

**Windows:**
```bash
# Delete the instance and migrations folders if they exist
rmdir /s /q instance
rmdir /s /q migrations

# Initialize and migrate database
flask db init
flask db migrate
flask db upgrade
```

## Run the Application

**macOS/Linux:**
```bash
python -m flask run
```

**Windows:**
```bash
flask run
``` 

## Run AI Embeddings Analysis

**All platforms:**
```bash
# Make sure you're in the backend folder and virtual environment is activated
flask analyze-conversation <user_id_1> <user_id_2>
```

## Environment Variables Setup

### Creating .env File

1. Copy the template file to create your `.env` file:

   **macOS/Linux:**
   ```bash
   cp env.template .env
   ```

   **Windows (Command Prompt):**
   ```bash
   copy env.template .env
   ```

   **Windows (PowerShell):**
   ```powershell
   Copy-Item env.template .env
   ```

2. Edit the `.env` file with your actual values. The template includes all available environment variables with descriptions.

**Important:** The `.env` file is gitignored and won't be committed to the repository.

### Required for Production

For production deployment (e.g., Railway), you'll need to set these in your deployment platform's environment variables:
- `RESEND_API_KEY` - Resend API key for email sending
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2 storage credentials
- `CDN_BASE_URL` - Your CDN domain for serving images
- `SECRET_KEY`, `JWT_SECRET_KEY` - Strong random keys (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- Database credentials (if using PostgreSQL)

See `backend/env.template` for the complete list of all available environment variables.

## Test Mode for Email Verification

For development and testing, you can enable test mode to skip email verification for test email addresses.

### Setup

1. Create a `.env` file in the `backend` directory (if it doesn't exist) or use the template
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
