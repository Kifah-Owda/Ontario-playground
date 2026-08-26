# Dev quickstart for Windows / PowerShell — mirror of run_dev.sh.
# Usage:  .\run_dev.ps1
$ErrorActionPreference = 'Stop'

# Run from the project root regardless of where the shell was when invoked.
Set-Location -Path $PSScriptRoot

# Prefer the launcher (`py`), fall back to whatever `python` is on PATH.
$bootstrap = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }

if (-not (Test-Path '.venv')) {
    Write-Host 'Creating virtual environment (.venv)...' -ForegroundColor Cyan
    & $bootstrap -m venv .venv
}

# Windows venvs put executables in Scripts\, not bin\ — this is the line that
# makes run_dev.sh fail here even under Git Bash.
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw "No interpreter at $python. Delete .venv and re-run to rebuild it."
}

Write-Host 'Installing dependencies...' -ForegroundColor Cyan
& $python -m pip install -r requirements.txt --quiet

Write-Host 'Seeding database...' -ForegroundColor Cyan
& $python -m backend.app.seed

Write-Host 'Starting server on http://127.0.0.1:8000 (Ctrl+C to stop)' -ForegroundColor Green
& $python -m uvicorn backend.app.main:app --reload --port 8000
