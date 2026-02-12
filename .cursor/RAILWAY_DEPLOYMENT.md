# Railway + Cloudflare R2 Deployment Guide

This guide covers deploying your Flask backend to Railway with Cloudflare R2 for image storage.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Cloudflare account (sign up at https://cloudflare.com)
3. GitHub repository with your backend code

## Step 1: Set Up Cloudflare R2

### 1.1 Create R2 Bucket

1. Log in to Cloudflare Dashboard
2. Go to **R2** → **Manage R2 API Tokens**
3. Click **Create bucket**
4. Name your bucket (e.g., `matchmaker-images`)
5. Choose a location (closest to your users)
6. Click **Create bucket**

### 1.2 Create API Token

1. In R2 dashboard, go to **Manage R2 API Tokens**
2. Click **Create API token**
3. You'll see template options - **choose "Create Custom Token"** (don't use the templates)
4. Configure your custom token:
   - **Token name**: `matchmaker-backend` (or any name you prefer)
   - **Permissions**: 
     - Click **Add permission**
     - **Permission Type**: Select **Account** (not Zone, not User)
     - **Permission**: Scroll down and find **Workers R2 Storage** → Select **Edit** (gives read & write access)
       - Note: R2 is listed as "Workers R2 Storage" in the permissions list
       - If "Edit" isn't available, select **Read** and **Write** separately
   - **Account Resources**: 
     - Select **Include**
     - Choose **All accounts** OR select your specific account from the list
   - **Zone Resources**: Leave as default (not needed for R2)
   - **Client IP Address Filtering**: 
     - **Leave empty/default** (Railway uses dynamic IPs, so filtering won't work)
   - **TTL (Time to Live)**: 
     - **Leave blank** for no expiration (recommended)
     - Or set expiration date if you want automatic token rotation
   - **Access level**: Should show "Edit" or "Read & Write" for R2
5. Click **Continue to summary**
6. Review and click **Create API Token**
7. **IMPORTANT: Save these credentials immediately** (you won't see the secret again):
   - **Access Key ID** (starts with something like `abc123...`)
   - **Secret Access Key** (long string - copy this!)
   - **Account ID** (shown in R2 dashboard URL or account settings)

**Note:** If you don't see R2-specific permissions, make sure you're creating the token from the R2 section, not the general API tokens section. The token needs R2 permissions specifically.

### 1.3 Configure Public Access (Optional)

If you want direct public URLs:

1. Go to your bucket → **Settings**
2. Enable **Public Access**
3. Note: You can also use Cloudflare CDN with a custom domain

### 1.4 Get Endpoint URL

Your R2 endpoint URL format is:
```
https://<account_id>.r2.cloudflarestorage.com
```

You can find your account ID in the R2 dashboard URL or settings.

## Step 2: Set Up Railway

### 2.1 Create Railway Project

**If your repository is under a different GitHub user/organization:**

**Option A: Connect Different GitHub Account (Recommended)**
1. Log in to Railway
2. Go to **Settings** → **Connections**
3. Click **Connect GitHub** (or **Add GitHub Account**)
4. Authorize Railway to access the GitHub account/organization that owns the repository
5. Click **New Project**
6. Select **Deploy from GitHub repo**
7. You should now see repositories from both accounts
8. Choose your backend repository

**Option B: Use Railway CLI (Alternative)**
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link to project: `railway link` (in your backend directory)
4. Deploy: `railway up`

**Option C: Transfer Repository Access**
1. Ask the repository owner to add you as a collaborator
2. Or fork the repository to your own GitHub account
3. Then connect your GitHub account to Railway

**Standard Setup (if repo is under your account):**
1. Log in to Railway
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your backend repository
5. Railway will detect the `Dockerfile` or `Procfile`

### 2.2 Add PostgreSQL Database

1. In your Railway project, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Railway will automatically create a PostgreSQL database
4. Click on the database service
5. Go to **Variables** tab
6. **You'll see these variables automatically set by Railway:**
   - `PGHOST` - Database host
   - `PGPORT` - Database port (usually 5432)
   - `PGDATABASE` - Database name (usually "railway")
   - `PGUSER` - Database username
   - `PGPASSWORD` - Database password
   - `DATABASE_URL` - Full connection string (alternative)

7. **Copy these values** - you'll need them for your backend service

### 2.3 Configure Environment Variables

1. Click on your backend service
2. Go to **Variables** tab
3. Add the following environment variables:

#### Database Variables

**Get these from your PostgreSQL service in Railway:**

1. Go to your Railway project
2. Click on the **PostgreSQL** service
3. Go to **Variables** tab
4. Copy these values:

```
DB_USERNAME=<value from PGUSER variable>
DB_PASSWORD=<value from PGPASSWORD variable>
DB_HOST=<value from PGHOST variable>
DB_NAME=<value from PGDATABASE variable, usually "railway">
DB_PORT=<value from PGPORT variable, usually "5432">
```

**Example:**
- `DB_USERNAME=postgres`
- `DB_PASSWORD=zTDQQFFxOaQhLRbYwJfxwjNPOeMEDoBX`
- `DB_HOST=postgres.railway.internal`
- `DB_NAME=railway`
- `DB_PORT=5432`

**Alternative:** Railway also provides a `DATABASE_URL` variable, but your config uses individual variables, so use the format above.

#### Application Variables
```
FLASK_ENV=production
SECRET_KEY=<generate a strong random key>
JWT_SECRET_KEY=<generate a different strong random key>
PORT=5000
```

**Generate secrets:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### Cloudflare R2 Variables
```
R2_ACCOUNT_ID=619afe209e5a6e4e2c8c289d62c9ac3c
R2_ACCESS_KEY_ID=PXNWVRXl86uRI7Gqa7J1vNLYIbpHq1BfCkpC0QiW
R2_SECRET_ACCESS_KEY=PXNWVRXl86uRI7Gqa7J1vNLYIbpHq1BfCkpC0QiW
R2_BUCKET_NAME=matchmaker-images
R2_ENDPOINT_URL=https://619afe209e5a6e4e2c8c289d62c9ac3c.r2.cloudflarestorage.com
```

#### AWS SES Variables (Keep Existing)
```
AWS_PROFILE=
AWS_REGION=us-east-1
SES_SENDER_EMAIL=allyaoyao32@gmail.com
SES_SNS_KEY=AKIAT2BTZDHU3F3IUV6G
SES_SNS_SECRET=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
```

#### Other Variables
```
OPENAI_API_KEY=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
SIGNUP_URL=test_url
CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

### 2.4 Configure Service Settings

1. In your backend service, go to **Settings** tab
2. **Start Command** - Railway should auto-detect from `Procfile` or `Dockerfile`, but if not, set it to:
   ```
   gunicorn -w 4 -b 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - run:app
   ```
   - `-w 4` = 4 worker processes
   - `-b 0.0.0.0:$PORT` = bind to all interfaces on Railway's PORT
   - `--timeout 120` = 120 second timeout
   - `--access-logfile -` = log to stdout
   - `--error-logfile -` = errors to stdout
   - `run:app` = your Flask app (from run.py)

3. **Health Check Path** (optional):
   - Set to `/` (root endpoint)
   - Or create a dedicated `/health` endpoint in your app
   - Railway uses this to check if your app is running

**Note:** If you have a `Procfile` or `Dockerfile`, Railway will usually auto-detect the start command. You may not need to set this manually.

## Step 3: Database Migration

### 3.1 Run Migrations

Railway will automatically run migrations on deploy (configured in Dockerfile).

To run manually:

1. Open Railway service → **Deployments**
2. Click on a deployment → **View Logs**
3. Or use Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run flask db upgrade
```

### 3.2 Migrate Data from SQLite (If Needed)

If you have existing SQLite data:

1. Set PostgreSQL environment variables locally
2. Run migration script:
```bash
python scripts/migrate_sqlite_to_postgres.py
```

## Step 4: Deploy

### 4.1 Automatic Deployment

Railway automatically deploys on git push to your main branch.

1. Push your code to GitHub
2. Railway will detect the push
3. Build and deploy automatically
4. Check **Deployments** tab for status

### 4.2 Manual Deployment

1. In Railway dashboard, click **Deploy**
2. Or use Railway CLI:
```bash
railway up
```

## Step 5: Verify Deployment

### 5.1 Check Logs

1. Go to your service → **Deployments**
2. Click on latest deployment → **View Logs**
3. Look for:
   - Successful database connection
   - Migrations completed
   - Application started

### 5.2 Test Endpoints

1. Get your Railway URL (e.g., `https://your-app.railway.app`)
2. Test health endpoint: `GET https://your-app.railway.app/`
3. Test API endpoints

### 5.3 Test Image Upload

1. Upload an image via your API
2. Check Cloudflare R2 bucket - image should appear
3. Verify image URL is accessible

## Step 6: Custom Domain (Optional)

1. In Railway service → **Settings** → **Domains**
2. Click **Generate Domain** or **Add Custom Domain**
3. For custom domain:
   - Add CNAME record pointing to Railway
   - Railway will provision SSL automatically

## Troubleshooting

### Database Connection Issues

- Verify all DB_* environment variables are set
- Check Railway PostgreSQL service is running
- Verify network connectivity (Railway services can communicate internally)

### Image Upload Fails

- Verify all R2_* environment variables are set correctly
- Check R2 bucket exists and is accessible
- Verify R2 API token has correct permissions
- Check Railway logs for specific error messages

### Application Won't Start

- Check logs for errors
- Verify all required environment variables are set
- Check PORT is set (Railway sets this automatically)
- Verify Gunicorn is installed (in requirements.txt)

### CORS Errors

- Update CORS_ORIGINS with your frontend domain
- Ensure frontend is using correct API URL
- Check CORS configuration in app/__init__.py

## Cost Estimation

### Railway - FREE to Start! 🎉

**Free Tier:**
- **$5 credit/month** (enough for small apps)
- PostgreSQL database included
- Automatic deployments
- HTTPS/SSL included
- Perfect for MVP/early stage

**Paid Plans (when you outgrow free tier):**
- **Hobby Plan**: $5/month (includes $5 credit) = effectively free for small usage
- **Pro Plan**: $20/month + usage
- **PostgreSQL**: Included in plan or ~$5-10/month separately
- **Estimated after free tier**: $10-30/month for small-medium scale

**What counts toward usage:**
- Compute time (when app is running)
- Database storage
- Bandwidth

### Cloudflare R2 - FREE to Start! 🎉

**Free Tier** ([Source](https://developers.cloudflare.com/r2/pricing/)):
- **10 GB-month storage** free per month
- **1 million Class A operations** (writes/uploads) per month free
- **10 million Class B operations** (reads/downloads) per month free
- **No egress fees** (unlike S3!) - completely free data transfer
- Perfect for MVP/early stage

**Paid (after free tier):**
- **Storage**: $0.015/GB-month (after 10GB free)
- **Class A operations** (writes): $4.50 per million (after 1M free)
- **Class B operations** (reads): $0.36 per million (after 10M free)
- **No egress fees!** (This is huge - S3 charges for downloads)
- **Estimated after free tier**: $1-10/month (depends on usage)

**What counts as operations:**
- **Class A** (writes/mutations): 
  - `PutObject` (uploading images) - **This is what you use for image uploads!**
  - `CopyObject`, `ListObjects`, `PutBucket`, `CreateMultipartUpload`, etc.
  - **Free tier: 1 million per month**
  - **After free tier: $4.50 per million**
  
- **Class B** (reads):
  - `GetObject` (downloading/viewing images)
  - `HeadObject`, `HeadBucket`, etc.
  - **Free tier: 10 million per month**
  - **After free tier: $0.36 per million**
  
- **Free operations** (no charge):
  - `DeleteObject` (deleting images)
  - `DeleteBucket`
  - `AbortMultipartUpload`

**For your image uploads:**
- Each image upload = 1 `PutObject` = 1 Class A operation
- 1,000 image uploads = 1,000 Class A operations ✅ (well within 1M free tier)
- 10,000 image uploads = 10,000 Class A operations ✅ (still within 1M free tier)
- 1,000,000 image uploads = 1M Class A operations ✅ (exactly at free tier limit)

### Total Cost

**Starting Out (Free Tier):**
- **Railway**: $0/month (within $5 credit)
- **Cloudflare R2**: $0/month (within free tier limits)
- **Total: FREE!** 🎉

**After Scaling:**
- **Railway**: $10-30/month
- **Cloudflare R2**: $1-10/month
- **Total: ~$11-40/month**

**When you'll hit free tier limits:**
- Railway: When you exceed $5/month in usage (compute + database)
- R2: When you exceed 10GB storage OR 1M writes/month OR 10M reads/month

**Real-world example for a dating app:**
- 1,000 users uploading 5 photos each (avg 2MB) = ~10GB storage ✅ (within free tier)
- 5,000 image uploads (PUT requests) = 5,000 Class A operations ✅ (within 1M free)
- 100,000 image views (GET requests) = 100,000 Class B operations ✅ (within 10M free)
- **Total cost: $0/month!** 🎉

**Scaling example:**
- 10,000 users uploading 5 photos = 50,000 PUT requests = 50,000 Class A ops ✅ (still free!)
- 1,000,000 image views = 1M Class B operations ✅ (still within 10M free)
- **Still $0/month!** 🎉

**When you'd start paying:**
- If you exceed 1 million uploads (PUT requests) per month → $4.50 per additional million
- If you exceed 10 million image views (GET requests) per month → $0.36 per additional million

## Monitoring

### Railway Logs

- View real-time logs in Railway dashboard
- Logs are retained for a period based on your plan

### External Monitoring

1. **Sentry** (Error Tracking):
   - Add to requirements.txt: `sentry-sdk[flask]`
   - Configure in app initialization

2. **Uptime Monitoring**:
   - UptimeRobot (free tier)
   - Monitor your Railway URL

## Scaling

### When to Scale

- High response times
- Database connection pool exhaustion
- Memory/CPU limits

### How to Scale

1. **Upgrade Railway Plan**: More resources
2. **Add More Workers**: Update Gunicorn `-w` flag
3. **Database Scaling**: Upgrade PostgreSQL plan
4. **Add Caching**: Consider Redis (Railway supports it)

## Next Steps

1. Set up monitoring and alerts
2. Configure backups for PostgreSQL
3. Set up CI/CD pipeline (optional)
4. Configure staging environment (optional)
5. Set up error tracking (Sentry)

## Support

- Railway Docs: https://docs.railway.app
- Cloudflare R2 Docs: https://developers.cloudflare.com/r2
- Railway Discord: https://discord.gg/railway
