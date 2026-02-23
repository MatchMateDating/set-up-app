# iOS Beta Testing Deployment Guide

This guide will help you deploy your app to TestFlight for iOS beta testing.

## Prerequisites

1. **Apple Developer Account** (required for TestFlight)
   - You need an active Apple Developer Program membership ($99/year)
   - Account: `allyaoyao32@gmail.com` (as configured in eas.json)

2. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   ```

3. **Expo Account** - Make sure you're logged in:
   ```bash
   eas login
   ```

## Step 1: Configure Environment Variables

Ensure your `.env` file in `matchmaker-mobile/` directory contains:

```bash
EXPO_PUBLIC_API_BASE_URL=https://set-up-app-production.up.railway.app
```

**Note:** The `.env` file should be in the `matchmaker-mobile/` directory (not the root).

## Step 2: Configure Apple Developer Account

### 2.1 Get Your Apple Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Sign in with your Apple ID
3. Go to **Membership** section
4. Copy your **Team ID** (looks like: `ABC123DEF4`)

### 2.2 Register App ID (Bundle ID)

Before creating an app in App Store Connect, you need to register your Bundle ID as an App ID:

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Click **Certificates, Identifiers & Profiles** (or go to https://developer.apple.com/account/resources/identifiers/list)
3. Click the **+** button (top left) to create a new identifier
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Fill in:
   - **Description:** Matchmaker Mobile (or any descriptive name)
   - **Bundle ID:** Select **Explicit**
   - Enter: `com.matchmate.matchmatedating` (must match your app.json)
7. Enable capabilities:
   - ✅ **Push Notifications** (required for expo-notifications)
     - Note: Enabling Push Notifications automatically enables remote notifications background mode
   - ✅ **Background Modes** (if shown as a separate capability)
     - If Background Modes appears, you can enable it, but it's often automatically configured with Push Notifications
   - ✅ **Location Services** (required for location-based matching)
   - Add any other capabilities you need
8. Click **Continue** → **Register**
9. Verify the App ID appears in your list with status "Active"

**Important:** The Bundle ID must exactly match `bundleIdentifier` in your `app.json` file.

### 2.3 Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Matchmaker (or your app name)
   - **Primary Language:** English
   - **Bundle ID:** `com.matchmate.matchmatedating` (must match app.json)
   - **SKU:** Any unique identifier (e.g., `matchmaker-mobile-001`)
4. Click **Create**
5. Copy the **App ID** (numeric ID) from the app page

### 2.4 Update eas.json

Update the `eas.json` file with your actual values:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "allyaoyao32@gmail.com",
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",  // Replace with numeric App ID
      "appleTeamId": "YOUR_APPLE_TEAM_ID"          // Replace with your Team ID
    }
  }
}
```

## Step 3: Build iOS App

### 3.1 Build for iOS (Production)

Navigate to the mobile app directory:
```bash
cd matchmaker-mobile
```

Build the iOS app:
```bash
eas build --platform ios --profile production
```

**What happens:**
- EAS will prompt you to configure credentials (or use existing ones)
- The build will take 15-30 minutes
- You'll get a build URL to track progress

### 3.2 Configure Credentials (First Time Only)

On first build, EAS will ask about credentials:

1. **Distribution Certificate:** Choose "Let EAS handle it" (recommended)
2. **Provisioning Profile:** Choose "Let EAS handle it" (recommended)
3. **Push Notifications Key:** If you need push notifications, EAS can generate this

EAS will automatically manage these for you.

## Step 4: Submit to TestFlight

### 4.1 Automatic Submission

After the build completes, submit to TestFlight:

```bash
eas submit --platform ios --profile production --latest
```

**What happens:**
- EAS uploads the build to App Store Connect
- The build appears in TestFlight (may take 5-10 minutes)
- You'll receive an email when it's ready

### 4.2 Manual Submission (Alternative)

If automatic submission doesn't work:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **TestFlight** tab
4. Wait for the build to appear (may take 10-30 minutes)
5. Once it appears, click **+** to add it to TestFlight

## Step 5: Configure TestFlight

### 5.1 Add Internal Testers

1. In App Store Connect, go to **TestFlight** tab
2. Click **Internal Testing** → **+** to add testers
3. Add testers by email (must be part of your App Store Connect team)

### 5.2 Add External Testers (Beta Testing)

1. Go to **External Testing** → **+**
2. Create a new group (e.g., "Beta Testers")
3. Add the build you just uploaded
4. Fill in required information:
   - **What to Test:** Brief description of what testers should focus on
   - **Beta App Description:** Description of the app
   - **Feedback Email:** Your email for receiving feedback
   - **Marketing URL** (optional): Your website
   - **Privacy Policy URL** (required): Link to your privacy policy
5. Add testers by email (up to 10,000 external testers)
6. Submit for Beta App Review (first time only - takes 24-48 hours)

## Step 6: Testers Install the App

1. Testers receive an email invitation
2. They need to install **TestFlight** app from App Store
3. Open the invitation email on their iOS device
4. Tap **View in TestFlight** or **Start Testing**
5. Install the app from TestFlight

## Troubleshooting

### Build Fails

**Common issues:**
- **Missing credentials:** Run `eas credentials` to configure
- **Bundle ID mismatch:** Ensure `app.json` bundleIdentifier matches App Store Connect
- **Version conflict:** EAS auto-increments, but check `app.json` version

**Fix:**
```bash
# Check credentials
eas credentials

# View build logs
eas build:view [BUILD_ID]
```

### Submission Fails

**Common issues:**
- **Not logged in:** Run `eas login`
- **Wrong App ID:** Verify `ascAppId` in `eas.json`
- **Missing app in App Store Connect:** Create the app first (Step 2.2)

**Fix:**
```bash
# Check login status
eas whoami

# Retry submission
eas submit --platform ios --profile production --latest
```

### Build Takes Too Long

- Normal build time: 15-30 minutes
- If stuck, check build status: `eas build:list`
- You can cancel and retry if needed

### TestFlight Build Not Appearing

- Wait 10-30 minutes after submission
- Check App Store Connect → TestFlight tab
- Check email for any issues
- Verify the build passed all checks in App Store Connect

### Getting Detailed Crash Logs

If your app crashes in TestFlight, here are several ways to get more detailed crash information:

#### Method 1: TestFlight Crash Reports (Easiest)

1. **In App Store Connect:**
   - Go to your app → **TestFlight** tab
   - Click on the build that crashed
   - Scroll down to **Crash Reports** section
   - Click on a crash report to see full stack trace

2. **On Your Device:**
   - Open **Settings** → **Privacy & Security** → **Analytics & Improvements** → **Analytics Data**
   - Find entries starting with your app name (e.g., `matchmaker-mobile`)
   - Tap to view detailed crash logs
   - Share or screenshot the crash details

#### Method 2: Xcode Organizer (Most Detailed)

1. Open **Xcode**
2. Go to **Window** → **Organizer** (or press `Cmd+Shift+9`)
3. Click **Crashes** tab
4. Select your app from the list
5. You'll see all crash reports with:
   - Full stack traces
   - Thread information
   - Exception details
   - Memory addresses

#### Method 3: Device Console Logs (Real-time)

1. **Connect your iPhone to your Mac via USB**
2. Open **Xcode**
3. Go to **Window** → **Devices and Simulators** (or press `Cmd+Shift+2`)
4. Select your connected device
5. Click **Open Console** button
6. Filter by your app name: `matchmaker-mobile`
7. Launch the app from TestFlight
8. Watch the console for real-time logs and errors

**Note:** Console logs show `console.log()` statements and native errors, which is very helpful for debugging.

#### Method 4: Add Console Logging to Your App

Add detailed logging to help debug:

```javascript
// In App.js or any component
console.log('🔍 App starting...');
console.log('🔍 API_BASE_URL:', API_BASE_URL);
console.log('🔍 Environment:', process.env.NODE_ENV);
```

These logs will appear in:
- Xcode console (if device connected)
- TestFlight crash reports (sometimes)
- Device console logs

#### Method 5: Set Up Crash Reporting (Recommended for Production)

For better crash tracking, consider adding:

**Sentry (Free tier available):**
```bash
npm install @sentry/react-native
```

Or **Bugsnag** or **Crashlytics**

This will automatically capture and report crashes with full context.

#### Quick Debug Checklist

When you see a crash:
1. ✅ Check TestFlight crash reports in App Store Connect
2. ✅ Connect device to Xcode and view console logs
3. ✅ Check Xcode Organizer for crash reports
4. ✅ Look for patterns (does it crash on launch? After login? etc.)
5. ✅ Share the full stack trace (not just "startup crashed")

## Quick Reference Commands

```bash
# Login to EAS
eas login

# Check current user
eas whoami

# Build iOS app
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --profile production --latest

# View builds
eas build:list

# View credentials
eas credentials

# Check build status
eas build:view [BUILD_ID]
```

## Updating the App

For subsequent updates:

1. Update version in `app.json` (or let EAS auto-increment)
2. Build: `eas build --platform ios --profile production`
3. Submit: `eas submit --platform ios --profile production --latest`
4. The new build will appear in TestFlight automatically

## Important Notes

- **First external test:** Requires Beta App Review (24-48 hours)
- **Subsequent updates:** Usually available within minutes
- **Build limit:** Free EAS accounts have build limits; consider upgrading if needed
- **Backend URL:** Make sure `.env` has the correct production backend URL
- **Version:** EAS auto-increments build numbers, but you can manually set version in `app.json`

## Next Steps After Beta Testing

Once beta testing is complete:

1. Fix any critical issues found during testing
2. Build a new production version
3. Submit for App Store Review (change from TestFlight to App Store)
4. Release to production

For App Store submission, you'll need:
- App Store listing (screenshots, description, etc.)
- Privacy policy URL
- App Store Review submission
