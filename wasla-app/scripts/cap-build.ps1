# Build signed Wasla Android APK (debug or release)
param(
  [ValidateSet("debug", "release")]
  [string]$Flavor = "release",
  [string]$ApiBase = "http://127.0.0.1:4000"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root "android"

$env:JAVA_HOME = "A:\Wasla\wasla-app\android-tools\jdk21"
$env:ANDROID_HOME = "A:\Wasla\wasla-app\android-tools\sdk"
$env:WASLA_API_BASE = $ApiBase

if ($Flavor -eq "release") {
  $env:WASLA_KEYSTORE_PASSWORD = "wasla123"
  $env:WASLA_KEY_PASSWORD = "wasla123"
}

Set-Location $root
npm run build:www
npx cap sync android

Set-Location $android
$task = if ($Flavor -eq "release") { "assembleRelease" } else { "assembleDebug" }
.\gradlew.bat $task --quiet

$apkFolder = if ($Flavor -eq "release") { "release" } else { "debug" }
$apk = Join-Path $android "app\build\outputs\apk\$apkFolder\app-$Flavor.apk"
Write-Output "Built: $apk"
