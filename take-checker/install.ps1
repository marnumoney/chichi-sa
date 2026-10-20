# Take Checker installer for Windows (run in PowerShell):
#   powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
$Src  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dest = Join-Path $HOME "TakeChecker"
Write-Host "==> Detected OS: Windows"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
}
# Pick up PATH changes from winget without reopening the terminal.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "==> Setting up $Dest"
foreach ($d in "inbox", "trimmed", "reports", "scripts") { New-Item -ItemType Directory -Force -Path (Join-Path $Dest $d) | Out-Null }
Copy-Item (Join-Path $Src "take_check.py") $Dest -Force
if (-not (Test-Path (Join-Path $Dest "script.txt"))) { Copy-Item (Join-Path $Src "script.txt") $Dest }
if (-not (Test-Path (Join-Path $Dest "scripts\gym_ad.txt"))) { Copy-Item (Join-Path $Src "script.txt") (Join-Path $Dest "scripts\gym_ad.txt") }

Write-Host "==> Creating virtualenv + installing faster-whisper"
python -m venv (Join-Path $Dest ".venv")
$Py = Join-Path $Dest ".venv\Scripts\python.exe"
& $Py -m pip install --upgrade pip | Out-Null
& $Py -m pip install faster-whisper numpy

Write-Host "==> Downloading Whisper model small.en (one time, ~500 MB)"
& $Py -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')"

Write-Host ""
Write-Host "Done. Take Checker lives in: $Dest"
Write-Host "  1. Copy your takes into:  $Dest\inbox"
Write-Host "  2. Run:                   cd $Dest; python take_check.py"
Write-Host "  3. Read the report:       $Dest\reports\report.md"
