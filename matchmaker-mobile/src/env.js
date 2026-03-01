// Get API base URL from environment variable
// For local development: http://localhost:5000 or http://192.168.x.x:5000
// For production: https://your-app.railway.app
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://set-up-app-production.up.railway.app';
export const SIGNUP_URL =
  process.env.EXPO_PUBLIC_SIGNUP_URL || 'https://matchmatedating.com/matchmaker-signup.html';

// Log for debugging in development only
if (__DEV__) {
  console.log('🔧 API_BASE_URL:', API_BASE_URL);
  console.log('🔧 EXPO_PUBLIC_API_BASE_URL env var:', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('🔧 SIGNUP_URL:', SIGNUP_URL);
  console.log('🔧 EXPO_PUBLIC_SIGNUP_URL env var:', process.env.EXPO_PUBLIC_SIGNUP_URL);
}

// Log a warning if API_BASE_URL is not set (helpful for debugging)
if (!process.env.EXPO_PUBLIC_API_BASE_URL) {
  console.warn(
    '⚠️ EXPO_PUBLIC_API_BASE_URL is not set. Using default production URL. ' +
    'Please create a .env file in the root directory with: ' +
    'EXPO_PUBLIC_API_BASE_URL=https://your-app.railway.app'
  );
}
