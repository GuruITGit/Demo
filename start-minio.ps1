# SmartGov MinIO Startup Script
# Run this after reboot to restart MinIO object storage

$minioExe = "C:\Users\OEM\AppData\Local\Microsoft\WinGet\Packages\MinIO.Server_Microsoft.Winget.Source_8wekyb3d8bbwe\minio.exe"
$dataDir   = "C:\minio-data"

if (-not (Test-Path $minioExe)) {
    Write-Host "ERROR: minio.exe not found at $minioExe" -ForegroundColor Red
    Write-Host "Run: winget install MinIO.Server" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "Created data directory: $dataDir"
}

# Check if already running
$running = Get-Process -Name "minio" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "MinIO is already running (PID $($running.Id))" -ForegroundColor Green
    Write-Host "Console: http://localhost:9001  (minioadmin/minioadmin)"
    exit 0
}

$env:MINIO_ROOT_USER     = "minioadmin"
$env:MINIO_ROOT_PASSWORD = "minioadmin"

Write-Host "Starting MinIO..." -ForegroundColor Cyan
Start-Process -FilePath $minioExe `
    -ArgumentList "server $dataDir --console-address :9001" `
    -WindowStyle Hidden

Start-Sleep -Seconds 3

$running = Get-Process -Name "minio" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "MinIO started successfully (PID $($running.Id))" -ForegroundColor Green
    Write-Host "API:     http://localhost:9000"
    Write-Host "Console: http://localhost:9001  (minioadmin/minioadmin)"
} else {
    Write-Host "ERROR: MinIO failed to start" -ForegroundColor Red
}
