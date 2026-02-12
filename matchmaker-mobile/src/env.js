// Get API base URL from environment variable
// For local development: http://localhost:5000 or http://192.168.x.x:5000
// For production: https://your-app.railway.app
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Log a warning if API_BASE_URL is not set (helpful for debugging)
if (!API_BASE_URL) {
  console.warn(
    '⚠️ EXPO_PUBLIC_API_BASE_URL is not set. ' +
    'Please create a .env file in the root directory with: ' +
    'EXPO_PUBLIC_API_BASE_URL=https://your-app.railway.app'
  );
}
