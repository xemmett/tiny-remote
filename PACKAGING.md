# Packaging Tiny Remote for distribution

One-time setup and build steps to produce a single installer (Inno Setup) that runs like a normal desktop app.

## Prerequisites

- **Node.js** 18+ (for frontend and desktop)
- **Python** 3.10+ with venv (for FastAPI backend)
- **PyInstaller**: `pip install pyinstaller`
- **pkg** (Node): installed via `npm install` in `frontend/`
- **Electron**: installed via `npm install` in `desktop/`
- **Inno Setup** 6: [https://jrsoftware.org/isinfo.php](https://jrsoftware.org/isinfo.php) (for building the installer)

## Build order

### 1. Build FastAPI binary (backend.exe)

```bash
cd pc-control
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install pyinstaller
pyinstaller backend.spec
```

Output: `pc-control/dist/backend.exe`

### 2. Build Node/Express binary (frontend.exe) and static files

```bash
cd frontend
npm install
npm run build:exe
```

This runs `vite build` then `pkg`, producing `frontend/build/frontend.exe`. The React build is in `frontend/dist/`. Copy that `dist` folder next to `frontend.exe` when staging (see below).

### 3. Build Electron desktop app

First, configure Electron to ship the two backends and the web app. We need `backend.exe`, `frontend.exe`, and the frontend `dist/` folder as extraResources so they sit next to the exe when packaged.

Edit `desktop/package.json` and set paths in `build.extraResources` (or use the build script below which stages everything).

Build the Electron app (portable or unpacked):

```bash
cd desktop
npm install
npm run pack
```

This creates `desktop/dist-electron/` (or `win-unpacked`) with the Electron app. The app expects to find `backend.exe`, `frontend.exe`, and `dist/` in the same folder as the executable (or in `resources/` when packaged — see `main.js` `getAppDir()`).

### 4. Stage files for Inno Setup

Create `installer/stage/` and put there:

- The Electron app output: the main `.exe` (e.g. `Tiny Remote.exe`) and any runtime files it needs (e.g. from `win-unpacked` or electron-builder output).
- `backend.exe` (from `pc-control/dist/backend.exe`)
- `frontend.exe` (from `frontend/build/frontend.exe`)
- `dist/` folder (from `frontend/dist/` — the Vite build output)

So after staging, `installer/stage/` should look like:

```
installer/stage/
  Tiny Remote.exe    (or whatever the Electron exe is named)
  backend.exe
  frontend.exe
  dist/
    index.html
    assets/
    ...
```

The exact name of the Electron exe depends on your `electron-builder` config (`productName` in package.json). Update `installer/tiny-remote.iss` if the exe name is different (e.g. `MyAppExeName`).

### 5. Build the installer

Open the Inno Setup script in Inno Setup Compiler:

```
installer/tiny-remote.iss
```

Click *Build → Compile*. The installer will be created under `installer/output/`.

The installer will:

- Copy all staged files to e.g. `C:\Program Files\Tiny Remote\`
- Add a Windows Firewall rule: allow inbound TCP 8765 (so phones on the same WiFi can connect)
- Optionally create a Desktop shortcut and a “Start when I log in” shortcut in the user’s Startup folder

## Running in development (no packaging)

1. Start the FastAPI backend:

   ```bash
   cd pc-control
   .venv\Scripts\activate
   python main.py --port 8764
   ```

2. Start the desktop app (it will run Node + Electron from source and use the ports above):

   ```bash
   cd desktop
   npm start
   ```

The Electron app will spawn `python main.py --port 8764` and `node server/index.js` with `PORT=8765` and `FASTAPI_URL=http://127.0.0.1:8764` so you can use the same UI as in the built app.

## Firewall

- **Install:** The Inno Setup script runs a PowerShell one-liner to add a rule “Tiny Remote” for TCP 8765 (Private/Domain profiles).
- **Uninstall:** The script runs a command to remove the “Tiny Remote” firewall rule.
- To add the rule manually (e.g. if port changed): run `scripts/add-firewall-rule.ps1` with optional port argument, as admin.

## Startup on boot

We use the **Startup folder** (log in), not a Windows Service:

- Path: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- The installer can add a shortcut there if the user checks “Start when I log in”.
- The app also has an in-app toggle “Start when I log in” that creates/removes the same shortcut.

No admin, no services, no NSSM.

## What users see

- Install: Next → Next → Finish.
- Desktop or Start Menu: “Tiny Remote”.
- Open app → status “Running”, URL like `http://192.168.0.42:8765`, QR code, Copy link, Open on PC, Restart backend, Start when I log in.
- On phone: scan QR or type the URL → control panel loads; no Python/Node/ports for the user.
