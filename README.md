# Matchmaker Dating App

A dating app with mobile (React Native/Expo) and web frontends, and a Flask backend.

## Quick Start for Developers

### Prerequisites
- Node.js and npm
- For mobile app: Expo CLI (`npm install -g expo-cli`)
- For backend: Python 3.11+

### Mobile App Setup

1. **Navigate to mobile app directory:**
   ```bash
   cd matchmaker-mobile
   npm install
   ```

2. **Create `.env` file in `matchmaker-mobile/` directory:**
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://set-up-app-production.up.railway.app
   ```
   **Note:** The `.env` file must be in the `matchmaker-mobile/` directory (not root) for Expo to read it.

3. **Start the app:**
   ```bash
   npx expo start --clear
   ```

4. **Run on device:**
   - Scan QR code with Expo Go app on your phone
   - Or press `i` for iOS simulator / `a` for Android emulator

#### Mobile App Useful Commands

**Update Outdated Packages:**
```bash
npm install @expo/vector-icons@^15.0.3
npm install @react-native-picker/picker@2.11.1
npm install expo@~54.0.27
npm install expo-clipboard@~8.0.8
npm install expo-status-bar@~3.0.9
npm install react-native@0.81.5
```
**Preview Build(Android):**
```bash
rmdir /s /q android
npx eas build -p android --profile preview
```
**Production Build(Android):**
```bash
rmdir /s /q android
npx eas build -p android --profile production
```

**Clean Build:**
```bash
npx expo prebuild --clean
```

**Uninstall Android App:**
```bash
adb uninstall com.matchmate.matchmatedating
```

### iOS Build and TestFlight Deployment

**Prerequisites:**
- EAS CLI installed: `npm install -g eas-cli`
- Logged into Expo account: `eas login`
- Apple Developer account configured in `eas.json`

**Build for Production:**
```bash
cd matchmaker-mobile
eas build --platform ios --profile production
```

**Build for Development (with dev client):**
```bash
cd matchmaker-mobile
eas build --platform ios --profile development
```

**Submit to TestFlight (after build completes):**
```bash
cd matchmaker-mobile
eas submit --platform ios --profile production
```

**Build and Submit in One Command:**
```bash
cd matchmaker-mobile
eas build --platform ios --profile production --auto-submit
```

**Check Build Status:**
```bash
eas build:list
```

**View Build Logs:**
- Visit: https://expo.dev/accounts/matchmatedating/projects/matchmaker-mobile/builds
- Or use: `eas build:view [BUILD_ID]`

**Notes:**
- Production builds automatically increment the build number (`autoIncrement: true` in `eas.json`)
- Environment variables (like `EXPO_PUBLIC_API_BASE_URL`) are set in `eas.json` per build profile
- The app icon is configured in `app.json` and will be included automatically
- After submission, builds appear in App Store Connect → TestFlight within a few minutes

### Web Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend-app
   npm install
   ```

2. **Create `.env.local` file in `frontend-app/` directory:**
   ```bash
   REACT_APP_API_BASE_URL=http://localhost:5000
   # or for production:
   # REACT_APP_API_BASE_URL=https://matchmatedating-app-production.up.railway.app
   ```

3. **Start the app:**
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Backend Setup (Local Development)

See `backend/RunningInstructions.md` for detailed backend setup instructions.

**Quick summary:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file from template
cp env.template .env
# Edit .env with your actual values (see Environment Variables section below)

export FLASK_APP=app:create_app
export FLASK_ENV=development
flask db init
flask db migrate
flask db upgrade
flask run
```

## Project Structure

```
matchmatedating-app/
├── backend/              # Flask backend API
│   ├── app/             # Application code
│   ├── env.template     # Environment variables template
│   ├── requirements.txt # Python dependencies
│   └── run.py           # Entry point
├── matchmaker-mobile/    # React Native mobile app (Expo)
│   ├── src/             # Source code
│   └── package.json     # Node dependencies
├── frontend-app/         # React web frontend
│   └── package.json     # Node dependencies
└── entrypoint.sh         # Production deployment script
```

## Environment Variables

### Backend (`.env` in `backend/` directory)

**Setup:**
1. Copy the template: `cp backend/env.template backend/.env`
2. Edit `.env` with your actual values
3. The `.env` file is gitignored and won't be committed

**Required for Production:**
- `RESEND_API_KEY` - Resend API key for email sending
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2 storage
- `CDN_BASE_URL` - Your CDN domain for serving images (e.g., `https://cdn.yourdomain.com/images`)
- `SECRET_KEY`, `JWT_SECRET_KEY` - Strong random keys (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- Database credentials (if using PostgreSQL)

**Optional for Local Development:**
- `SECRET_KEY`, `JWT_SECRET_KEY` - Defaults will be used if not set (not secure for production!)
- Database variables - Leave empty to use SQLite
- `TEST_MODE_ENABLED=true` - Skip email verification for test emails

**See `backend/env.template` for all available variables with descriptions.**

### Mobile App (`.env` in `matchmaker-mobile/` directory)
- `EXPO_PUBLIC_API_BASE_URL` - Backend API URL
  - Production: `https://matchmatedating-app-production.up.railway.app`
  - Local: `http://127.0.0.1:5000` (iOS Simulator) or `http://10.0.2.2:5000` (Android Emulator) or `http://YOUR_LOCAL_IP:5000` (Physical device)

### Web Frontend (`.env.local` in `frontend-app/` directory)
- `REACT_APP_API_BASE_URL` - Backend API URL
  - Production: `https://matchmatedating-app-production.up.railway.app`
  - Local: `http://localhost:5000`

### Backend (Railway Production)
All backend environment variables are configured in Railway dashboard. See `backend/env.template` for the complete list of variables needed.

See `.cursor/RAILWAY_DEPLOYMENT.md` for full deployment details.

## API Endpoints

The backend API is deployed at: `https://matchmatedating-app-production.up.railway.app`

Main endpoints:
- `/auth/register` - User registration
- `/auth/login` - User login
- `/profile/` - User profile management
- `/match/` - Matching functionality
- `/conversation/` - Messaging
- `/quiz/` - Quiz/puzzle results

## Troubleshooting

### Mobile App Can't Connect to API
1. Check that `.env` file exists in `matchmaker-mobile/` directory (not root)
2. Verify `EXPO_PUBLIC_API_BASE_URL` is set correctly
3. Restart Expo with `--clear` flag: `npx expo start --clear`
4. Check console for the warning message from `env.js`

### Web Frontend Can't Connect to API
1. Check that `.env.local` file exists in `frontend-app/` directory
2. Verify `REACT_APP_API_BASE_URL` is set correctly
3. Restart the dev server

### Backend Issues
- Check Railway logs: Railway dashboard → Service → Deployments → View Logs
- Verify environment variables are set in Railway
- Database migrations run automatically on deploy (see `entrypoint.sh`)
- For AWS SES errors, verify email is verified in the correct region (`AWS_REGION`)

### Email Verification Issues
- Verify sender email in AWS SES Console in the region specified by `AWS_REGION`
- Enable test mode for development: `TEST_MODE_ENABLED=true` in Railway
- Test emails (like `@test.com`) will auto-verify when test mode is enabled

## Development Notes

- **Environment files** (`.env`, `.env.local`) are gitignored - each developer creates their own
- **Backend setup**: Copy `backend/env.template` to `backend/.env` and fill in your values
- **Backend migrations** are handled automatically in production via `entrypoint.sh`
- **Test mode** can be enabled: `TEST_MODE_ENABLED=true` (skips email verification for test emails)
- **Mobile app `.env`** file must be in `matchmaker-mobile/` directory for Expo to read it
- **Email service**: Currently using Resend (not AWS SES)
- **Image storage**: Images are stored in Cloudflare R2 and served via CDN

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

For backend changes, Railway will automatically deploy on push to main branch.
