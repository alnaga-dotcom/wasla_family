# Start Wasla server in production mode on Windows
$ErrorActionPreference = "Stop"

$env:NODE_ENV = "production"
$env:WASLA_DEV_OTP = "false"

# Load .env if present
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

& node $PSScriptRoot\..\src\server.js
