@echo off
cd /d "%~dp0"

start "Tiny Remote - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
start "Tiny Remote - pc-control" cmd /k "cd /d %~dp0pc-control && call run.bat"