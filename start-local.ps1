# Starts CareerSaathi locally on Windows:
#   1. the project's MongoDB (port 27018, data on D:\CareerSaathiData — C: was too full for MongoDB)
#   2. the API, which also serves the built React app  → http://localhost:5000
#   3. (optional, -Dev) the Vite dev server with hot reload  → http://localhost:5173
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-local.ps1 [-Dev] [-Build]

param([switch]$Dev, [switch]$Build)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mongod = 'C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe'
$dataDir = 'D:\CareerSaathiData\db'

function Test-Port($port) { (Test-NetConnection -ComputerName 127.0.0.1 -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue) }

if (-not (Test-Port 27018)) {
  if (-not (Test-Path $mongod)) { Write-Error "mongod.exe not found at $mongod — update the path in this script."; exit 1 }
  New-Item -ItemType Directory -Force $dataDir | Out-Null
  Write-Host 'Starting MongoDB on port 27018...'
  Start-Process -FilePath $mongod -ArgumentList "--dbpath `"$dataDir`" --port 27018 --bind_ip 127.0.0.1 --logpath `"D:\CareerSaathiData\mongod.log`" --logappend" -WindowStyle Hidden
  Start-Sleep -Seconds 3
} else { Write-Host 'MongoDB already running on 27018.' }

if ($Build -or -not (Test-Path (Join-Path $root 'client\dist\index.html'))) {
  Write-Host 'Building the React client...'
  Push-Location (Join-Path $root 'client'); npm run build; Pop-Location
}

if (-not (Test-Port 5000)) {
  Write-Host 'Starting API on http://localhost:5000 ...'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm start' -WorkingDirectory (Join-Path $root 'server')
} else { Write-Host 'API already running on 5000.' }

if ($Dev -and -not (Test-Port 5173)) {
  Write-Host 'Starting Vite dev server on http://localhost:5173 ...'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm run dev' -WorkingDirectory (Join-Path $root 'client')
}

Write-Host "`nOpen http://localhost:5000  (demo logins: SEED_* values in server\.env)"
