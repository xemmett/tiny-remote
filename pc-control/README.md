# Tiny Remote (PC Control)

A FastAPI server that controls the PC it runs on: **mouse**, **keyboard**, **volume**, and **power**. Use it from another device on your network (phone, laptop) to control this machine.

## Setup

**Requirements:** Windows (for volume and power). Mouse and keyboard work on other OSes with pyautogui.

1. Create a virtual environment (recommended):
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   python main.py
   ```
   Server listens on `http://0.0.0.0:8765`. Open **http://localhost:8765/docs** for interactive API docs.

## API Overview

| Area | Method | Path | Description |
|------|--------|------|-------------|
| **Mouse** | POST | `/mouse/move` | Move to `x`, `y` (optional `duration`) |
| | POST | `/mouse/click` | Click `button` (left/right/middle), optional `x`, `y`, `clicks` |
| | POST | `/mouse/scroll` | Scroll by `amount` (positive = up) |
| | POST | `/mouse/drag` | Drag to `x`, `y` |
| | GET | `/mouse/position` | Current cursor position |
| **Keyboard** | POST | `/keyboard/press` | Press one key (`key`) |
| | POST | `/keyboard/type` | Type `text` (optional `interval`) |
| | POST | `/keyboard/hotkey` | Hotkey, e.g. `{"keys": ["ctrl", "c"]}` |
| | POST | `/keyboard/down` | Key down |
| | POST | `/keyboard/up` | Key up |
| **Volume** | GET | `/volume` | Get volume 0–100 and mute |
| | POST | `/volume` | Set volume 0–100 |
| | POST | `/volume/mute` | `{"mute": true/false}` |
| **Power** | POST | `/power/lock` | Lock workstation |
| | POST | `/power/sleep` | Sleep |
| | POST | `/power/shutdown` | Shutdown (optional `delay_seconds`) |
| | POST | `/power/restart` | Restart (optional `delay_seconds`) |
| | POST | `/power/cancel` | Cancel pending shutdown/restart |

## Example requests

```bash
# Move mouse
curl -X POST http://localhost:8765/mouse/move -H "Content-Type: application/json" -d "{\"x\": 100, \"y\": 200}"

# Left click at current position
curl -X POST http://localhost:8765/mouse/click -H "Content-Type: application/json" -d "{\"button\": \"left\"}"

# Volume to 50%
curl -X POST http://localhost:8765/volume -H "Content-Type: application/json" -d "{\"level\": 50}"

# Copy (Ctrl+C)
curl -X POST http://localhost:8765/keyboard/hotkey -H "Content-Type: application/json" -d "{\"keys\": [\"ctrl\", \"c\"]}"

# Lock PC
curl -X POST http://localhost:8765/power/lock
```

## Security

This server has **no authentication**. Only run it on a trusted network (e.g. home LAN) or bind to `127.0.0.1` and use only from the same machine. Do not expose it to the internet without adding auth and HTTPS.
