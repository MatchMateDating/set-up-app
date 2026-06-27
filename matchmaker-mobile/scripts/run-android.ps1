# Local Android dev build helper for Windows.
# Usage: npm run android:win   (from matchmaker-mobile)
#
# Tip: keep the project at a short path like C:\mm to avoid Windows MAX_PATH
# errors during native builds (New Architecture requires long codegen paths).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$projectRoot = (Get-Location).Path
if ($projectRoot.Length -gt 40) {
  Write-Host "Warning: project path is long ($projectRoot)."
  Write-Host "If the build fails with 'Filename longer than 260 characters', move or subst the project to C:\mm"
}

function Import-ProjectEnv {
  $envFile = Join-Path $projectRoot ".env"
  if (-not (Test-Path $envFile)) { return }
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith(';') -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($key) { Set-Item -Path "Env:$key" -Value $value }
  }
}

Import-ProjectEnv

function Invoke-Adb {
  param([Parameter(Mandatory = $true)][string[]]$Command)
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & adb @Command 2>&1
    foreach ($line in $output) {
      if ($line -is [System.Management.Automation.ErrorRecord]) {
        Write-Host $line.ToString()
      } else {
        Write-Host $line
      }
    }
    return ($output | Out-String)
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
}

function Test-EnvFlagTrue($name) {
  $envFile = Join-Path $projectRoot ".env"
  if (-not (Test-Path $envFile)) { return $false }
  $text = Get-Content $envFile -Raw
  return $text -match "${name}\s*=\s*true"
}

$admobEnabled = Test-EnvFlagTrue "EXPO_PUBLIC_ADMOB_ENABLED"
$admobPkgJson = Join-Path $projectRoot "node_modules\react-native-google-mobile-ads\package.json"
if ($admobEnabled) {
  $needsAdmobInstall = -not (Test-Path $admobPkgJson)
  if (-not $needsAdmobInstall) {
    $admobVer = (Get-Content $admobPkgJson | ConvertFrom-Json).version
    if ($admobVer -match '^1[6-9]\.') {
      $needsAdmobInstall = $true
    }
  }
  if ($needsAdmobInstall) {
    Write-Host "Installing react-native-google-mobile-ads@15.8.0 (Expo SDK 54 compatible)..."
    npm install react-native-google-mobile-ads@15.8.0
  }
}

Write-Host "Restarting adb..."
Invoke-Adb @("kill-server") | Out-Null
Start-Sleep -Seconds 2
for ($attempt = 1; $attempt -le 3; $attempt++) {
  $null = Invoke-Adb @("start-server")
  Start-Sleep -Seconds 1
  $devicesOut = Invoke-Adb @("devices")
  if ($devicesOut -notmatch "protocol fault") {
    break
  }
  Write-Host "adb protocol fault (attempt $attempt/3), retrying..."
  Invoke-Adb @("kill-server") | Out-Null
  Start-Sleep -Seconds 2
}

$gradleProps = Join-Path $projectRoot "android\gradle.properties"
$buildGradle = Join-Path $projectRoot "android\build.gradle"
$needsPrebuild = -not (Test-Path $gradleProps)
if (-not $needsPrebuild) {
  $propsText = Get-Content $gradleProps -Raw
  if ($propsText -notmatch "newArchEnabled\s*=\s*true") {
    Write-Host "Regenerating android/ (New Architecture must stay enabled for react-native-worklets)..."
    npx expo prebuild --platform android --clean
    $needsPrebuild = $false
  } elseif ($propsText -match "android.kotlinVersion=2\.3\.0") {
    Write-Host "Regenerating android/ (Kotlin 2.3.0 is unsupported by Expo KSP)..."
    npx expo prebuild --platform android --clean
    $needsPrebuild = $false
  }
}

if (-not $needsPrebuild) {
  $needsRegen = $false
  if ($admobEnabled) {
    $manifestPath = Join-Path $projectRoot "android\app\src\main\AndroidManifest.xml"
    if ((Test-Path $manifestPath) -and ((Get-Content $manifestPath -Raw) -notmatch "com.google.android.gms.ads.APPLICATION_ID")) {
      $needsRegen = $true
    }
  }
  if ((Test-Path $buildGradle) -and ((Get-Content $buildGradle -Raw) -match "force 'com.google.android.gms:play-services-ads")) {
    $needsRegen = $true
  }
  if ($needsRegen) {
    Write-Host "Regenerating android/ for AdMob config..."
    npx expo prebuild --platform android --clean
  }
}

if ($needsPrebuild) {
  Write-Host "Generating native android/ folder..."
  npx expo prebuild --platform android
}

Write-Host "Building and installing dev client..."
npx expo run:android @args
