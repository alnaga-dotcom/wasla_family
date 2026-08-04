# Backup Wasla SQLite database on Windows
$ErrorActionPreference = "Stop"

$dataDir = Join-Path $PSScriptRoot "..\data"
$backupDir = Join-Path $dataDir "backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dbFile = Join-Path $dataDir "wasla.db"
$backupFile = Join-Path $backupDir "wasla_${timestamp}.db"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Copy-Item -Path $dbFile -Destination $backupFile -Force

# Keep only the last 30 backups
Get-ChildItem -Path $backupDir -Filter "wasla_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force

Write-Host "Backup created: $backupFile"
