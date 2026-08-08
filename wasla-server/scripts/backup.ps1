# Backup Wasla MySQL database on Windows (mysqldump)
$ErrorActionPreference = "Stop"

# Read DB connection values from .env if present, else use defaults
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith("#")) {
            $parts = $line.Split('=', 2)
            if ($parts.Length -eq 2) {
                [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
            }
        }
    }
}

$dbHost = $env:WASLA_DB_HOST
if (-not $dbHost) { $dbHost = "127.0.0.1" }
$dbPort = $env:WASLA_DB_PORT
if (-not $dbPort) { $dbPort = "3306" }
$dbUser = $env:WASLA_DB_USER
if (-not $dbUser) { $dbUser = "root" }
$dbPass = $env:WASLA_DB_PASSWORD
if (-not $dbPass) { $dbPass = "" }
$dbName = $env:WASLA_DB_NAME
if (-not $dbName) { $dbName = "wasla" }

$backupDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "${dbName}_${timestamp}.sql"

$env:MYSQL_PWD = $dbPass
& mysqldump -h $dbHost -P $dbPort -u $dbUser --single-transaction --routines --triggers $dbName | Out-File -FilePath $backupFile -Encoding utf8
Remove-Item Env:\MYSQL_PWD

# Keep only the last 30 backups
Get-ChildItem -Path $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force

Write-Host "Backup created: $backupFile"
