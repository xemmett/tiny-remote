@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Building FastAPI backend (backend.exe)...
cd pc-control
if not exist .venv (
  python -m venv .venv
)
.venv\Scripts\python -m pip install -U pip
.venv\Scripts\python -m pip install pyinstaller
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m PyInstaller backend.spec
if errorlevel 1 ( echo Backend build failed. & exit /b 1 )
cd ..

echo [2/4] Building frontend (React + Express exe)...
cd frontend
call npm ci 2>nul || npm install
call npm run build
call npx pkg server/index.js --targets node18-win-x64 --output build/frontend.exe
if errorlevel 1 ( echo Frontend build failed. & exit /b 1 )
cd ..

echo [3/4] Building Electron desktop app...
cd desktop
call npm ci 2>nul || npm install
call npx electron-builder --dir --win
if errorlevel 1 ( echo Electron build failed. & exit /b 1 )
cd ..

echo [4/4] Staging for installer...
set STAGE=installer\stage
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"

set UNPACKED=desktop\dist-electron\win-unpacked
xcopy /E /I /Y "%UNPACKED%\*" "%STAGE%\"

echo.
echo Done. Staged files in %STAGE%
echo Next: open installer\tiny-remote.iss in Inno Setup and compile.
exit /b 0
