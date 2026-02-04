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
   EXPO_PUBLIC_API_BASE_URL=https://matchmatedating-app-production.up.railway.app
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

**Clean Build:**
```bash
npx expo prebuild --clean
```

**Uninstall Android App:**
```bash
adb uninstall com.allyaoyao.matchmakermobile
```

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
│   ├── requirements.txt # Python dependencies
│   └── run.py           # Entry point
├── matchmaker-mobile/    # React Native mobile app (Expo)
│   ├── src/             # Source code
│   └── package.json     # Node dependencies
├── frontend-app/         # React web frontend
│   └── package.json     # Node dependencies
├── .env                  # Environment variables (gitignored)
└── entrypoint.sh         # Production deployment script
```

## Environment Variables

### Mobile App (`.env` in `matchmaker-mobile/` directory)
- `EXPO_PUBLIC_API_BASE_URL` - Backend API URL
  - Production: `https://matchmatedating-app-production.up.railway.app`
  - Local: `http://localhost:5000` or `http://YOUR_LOCAL_IP:5000`

### Web Frontend (`.env.local` in `frontend-app/` directory)
- `REACT_APP_API_BASE_URL` - Backend API URL
  - Production: `https://matchmatedating-app-production.up.railway.app`
  - Local: `http://localhost:5000`

### Backend (Railway Production)
All backend environment variables are configured in Railway dashboard:
- `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_PORT` - PostgreSQL connection
- `AWS_REGION` - AWS region (e.g., `us-east-2`)
- `SES_SENDER_EMAIL` - Verified sender email
- `SES_SNS_KEY`, `SES_SNS_SECRET` - AWS SES credentials
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2
- `SECRET_KEY`, `JWT_SECRET_KEY` - Application secrets
- `TEST_MODE_ENABLED` - Enable test mode (skips email verification for test emails)
- `FLASK_APP` - Set to `app:create_app`
- `PORT` - Server port (Railway sets this automatically)

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

- Environment files (`.env`, `.env.local`) are gitignored - each developer creates their own
- Backend migrations are handled automatically in production via `entrypoint.sh`
- Test mode can be enabled in Railway: `TEST_MODE_ENABLED=true` (skips email verification for test emails)
- The mobile app `.env` file must be in `matchmaker-mobile/` directory for Expo to read it

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

For backend changes, Railway will automatically deploy on push to main branch.
