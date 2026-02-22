"""
FastAPI server for remote PC control: mouse, keyboard, volume, power.
Designed to run on the same machine you want to control (e.g. your desktop).
"""
import asyncio
import os
import platform
import subprocess
from contextlib import asynccontextmanager

import pyautogui
from fastapi import FastAPI, HTTPException, WebSocket
from pydantic import BaseModel, Field

# Disable pyautogui fail-safe (moving mouse to corner) for remote control
pyautogui.FAILSAFE = False

# Optional Windows-only: volume (pycaw) and power (ctypes)
WINDOWS = platform.system() == "Windows"
if WINDOWS:
    try:
        from pycaw.pycaw import AudioUtilities
        _HAS_PYCAW = True
    except Exception:
        _HAS_PYCAW = False
    # Windows mouse wheel and media keys: use native API
    import ctypes
    MOUSEEVENTF_WHEEL = 0x0800
    WHEEL_DELTA = 120  # one notch
    KEYEVENTF_KEYUP = 0x0002
    VK_MEDIA_PLAY_PAUSE = 0xB3
else:
    _HAS_PYCAW = False


# --- Pydantic models ---

class MouseMove(BaseModel):
    x: int = Field(..., description="Target X coordinate")
    y: int = Field(..., description="Target Y coordinate")
    duration: float = Field(0.0, ge=0, description="Movement duration in seconds")

class MouseMoveRelative(BaseModel):
    dx: int = Field(..., description="Pixels to move horizontally (positive = right)")
    dy: int = Field(..., description="Pixels to move vertically (positive = down)")
    duration: float = Field(0.0, ge=0, description="Movement duration in seconds")

class MouseClick(BaseModel):
    button: str = Field("left", description="left, right, or middle")
    x: int | None = Field(None, description="Optional X (default: current)")
    y: int | None = Field(None, description="Optional Y (default: current)")
    clicks: int = Field(1, ge=1, le=10)
    interval: float = Field(0.0, ge=0)

class MouseScroll(BaseModel):
    amount: int = Field(..., description="Positive = scroll up, negative = scroll down")
    x: int | None = None
    y: int | None = None

class MouseDrag(BaseModel):
    x: int = Field(...)
    y: int = Field(...)
    button: str = Field("left", description="left or right")
    duration: float = Field(0.0, ge=0)

class KeyboardPress(BaseModel):
    key: str = Field(..., description="Key name, e.g. enter, tab, space, a, ctrl")

class KeyboardType(BaseModel):
    text: str = Field(...)
    interval: float = Field(0.0, ge=0, description="Delay between keystrokes in seconds")

class KeyboardHotkey(BaseModel):
    keys: list[str] = Field(..., description="e.g. ['ctrl', 'c']")

class VolumeSet(BaseModel):
    level: int = Field(..., ge=0, le=100, description="Volume 0-100")

class VolumeMute(BaseModel):
    mute: bool = Field(..., description="True = mute, False = unmute")

class PowerShutdown(BaseModel):
    delay_seconds: int = Field(0, ge=0, le=3600)

class PowerRestart(BaseModel):
    delay_seconds: int = Field(0, ge=0, le=3600)


def _get_volume_interface():
    """Sync; run in thread pool - pycaw/COM blocks the event loop."""
    if not WINDOWS or not _HAS_PYCAW:
        raise HTTPException(status_code=501, detail="Volume control is only available on Windows with pycaw.")
    try:
        import ctypes
        # COM must be initialized in each thread that uses it (e.g. thread pool workers).
        ctypes.windll.ole32.CoInitialize(None)
        device = AudioUtilities.GetSpeakers()
        return device.EndpointVolume
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Volume control unavailable: {e}")


def _volume_get_sync():
    vol = _get_volume_interface()
    scalar = vol.GetMasterVolumeLevelScalar()
    muted = vol.GetMute()
    return {"volume": round(scalar * 100), "muted": bool(muted)}


def _volume_set_sync(level: int):
    vol = _get_volume_interface()
    vol.SetMasterVolumeLevelScalar(level / 100.0, None)
    return {"ok": True, "volume": level}


def _volume_mute_sync(mute: bool):
    vol = _get_volume_interface()
    vol.SetMute(1 if mute else 0, None)
    return {"ok": True, "muted": mute}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # cleanup if needed


app = FastAPI(
    title="Tiny Remote",
    description="Remote control server for mouse, keyboard, volume, and power on this PC.",
    version="0.1.0",
    lifespan=lifespan,
)


# --- Mouse ---

@app.post("/mouse/move")
async def mouse_move(body: MouseMove):
    """Move mouse to (x, y). Optional duration for smooth movement."""
    pyautogui.moveTo(body.x, body.y, duration=body.duration)
    return {"ok": True, "x": body.x, "y": body.y}

@app.post("/mouse/move/relative")
async def mouse_move_relative(body: MouseMoveRelative):
    """Move mouse by (dx, dy) relative to current position. Trackpad-style."""
    pyautogui.moveRel(body.dx, body.dy, duration=body.duration)
    return {"ok": True, "dx": body.dx, "dy": body.dy}

@app.post("/mouse/click")
async def mouse_click(body: MouseClick):
    """Click at current position or at (x, y)."""
    if body.x is not None and body.y is not None:
        pyautogui.click(body.x, body.y, button=body.button, clicks=body.clicks, interval=body.interval)
    else:
        pyautogui.click(button=body.button, clicks=body.clicks, interval=body.interval)
    return {"ok": True}

def _scroll_windows(amount: int, x: int | None = None, y: int | None = None) -> None:
    """Scroll on Windows using mouse_event (pyautogui.scroll is unreliable on Windows)."""
    if x is None or y is None:
        x, y = pyautogui.position()
    # dwData: positive = scroll up, negative = scroll down; units of WHEEL_DELTA (120 per notch)
    delta = amount * WHEEL_DELTA
    ctypes.windll.user32.mouse_event(MOUSEEVENTF_WHEEL, x, y, delta, 0)


@app.post("/mouse/scroll")
async def mouse_scroll(body: MouseScroll):
    """Scroll up (positive amount) or down (negative amount)."""
    if WINDOWS:
        _scroll_windows(body.amount, body.x, body.y)
    else:
        if body.x is not None and body.y is not None:
            pyautogui.scroll(body.amount, x=body.x, y=body.y)
        else:
            pyautogui.scroll(body.amount)
    return {"ok": True}

@app.post("/mouse/drag")
async def mouse_drag(body: MouseDrag):
    """Drag from current position to (x, y)."""
    pyautogui.drag(body.x, body.y, button=body.button, duration=body.duration)
    return {"ok": True}

@app.get("/mouse/position")
async def mouse_position():
    """Get current mouse position."""
    x, y = pyautogui.position()
    return {"x": x, "y": y}


# WebSocket mouse: sensitivity (swipe distance -> cursor distance) and smoothing (0=full smooth, 1=no smooth)
MOUSE_WS_SENSITIVITY = float(os.environ.get("MOUSE_WS_SENSITIVITY", "2.2"))
MOUSE_WS_SMOOTHING = float(os.environ.get("MOUSE_WS_SMOOTHING", "0.35"))  # exponential smoothing alpha


@app.websocket("/ws/mouse")
async def mouse_ws(ws: WebSocket):
    """Low-latency relative mouse move over WebSocket. Send JSON: { dx, dy }. Uses sensitivity + smoothing."""
    await ws.accept()
    smooth_x, smooth_y = 0.0, 0.0
    alpha = max(0.01, min(1.0, MOUSE_WS_SMOOTHING))
    try:
        while True:
            data = await ws.receive_json()
            dx = float(data.get("dx", 0))
            dy = float(data.get("dy", 0))
            smooth_x = alpha * dx + (1.0 - alpha) * smooth_x
            smooth_y = alpha * dy + (1.0 - alpha) * smooth_y
            move_x = int(round(MOUSE_WS_SENSITIVITY * smooth_x))
            move_y = int(round(MOUSE_WS_SENSITIVITY * smooth_y))
            if move_x or move_y:
                pyautogui.moveRel(move_x, move_y, duration=0)
    except Exception:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# --- Keyboard ---

@app.post("/keyboard/press")
async def keyboard_press(body: KeyboardPress):
    """Press and release a single key (e.g. enter, tab, space, a)."""
    pyautogui.press(body.key)
    return {"ok": True}

@app.post("/keyboard/type")
async def keyboard_type(body: KeyboardType):
    """Type a string with optional delay between keys."""
    pyautogui.write(body.text, interval=body.interval)
    return {"ok": True}

@app.post("/keyboard/hotkey")
async def keyboard_hotkey(body: KeyboardHotkey):
    """Press a key combination (e.g. ['ctrl', 'c'])."""
    pyautogui.hotkey(*body.keys)
    return {"ok": True}

@app.post("/keyboard/down")
async def keyboard_down(body: KeyboardPress):
    """Hold a key down."""
    pyautogui.keyDown(body.key)
    return {"ok": True}

@app.post("/keyboard/up")
async def keyboard_up(body: KeyboardPress):
    """Release a key."""
    pyautogui.keyUp(body.key)
    return {"ok": True}


# --- Volume (Windows + pycaw) ---

@app.get("/volume")
async def volume_get():
    """Get current volume (0-100) and mute state."""
    return await asyncio.to_thread(_volume_get_sync)

@app.post("/volume")
async def volume_set(body: VolumeSet):
    """Set master volume (0-100)."""
    return await asyncio.to_thread(_volume_set_sync, body.level)

@app.post("/volume/mute")
async def volume_mute(body: VolumeMute):
    """Mute or unmute."""
    return await asyncio.to_thread(_volume_mute_sync, body.mute)


# --- Media (play/pause — Windows keybd_event) ---

@app.post("/media/playpause")
async def media_playpause():
    """Send media Play/Pause key (toggle). Windows only."""
    if not WINDOWS:
        raise HTTPException(status_code=501, detail="Media keys are only available on Windows.")
    # keybd_event(bVk, bScan, dwFlags, dwExtraInfo): press then release
    ctypes.windll.user32.keybd_event(VK_MEDIA_PLAY_PAUSE, 0, 0, 0)
    ctypes.windll.user32.keybd_event(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_KEYUP, 0)
    return {"ok": True}


# --- Power (Windows) ---

def _run_power(cmd: list[str]):
    if not WINDOWS:
        raise HTTPException(status_code=501, detail="Power control is only available on Windows.")
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if WINDOWS else 0
        subprocess.run(cmd, check=True, creationflags=flags)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/power/lock")
async def power_lock():
    """Lock the workstation."""
    if not WINDOWS:
        raise HTTPException(status_code=501, detail="Power control is only available on Windows.")
    try:
        import ctypes
        ctypes.windll.user32.LockWorkStation()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/power/sleep")
async def power_sleep():
    """Put the system to sleep."""
    if not WINDOWS:
        raise HTTPException(status_code=501, detail="Power control is only available on Windows.")
    try:
        import ctypes
        # 0 = sleep, 1 = hibernate; 1 = force, 0 = allow wake events
        ctypes.windll.PowrProf.SetSuspendState(0, 1, 0)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/power/shutdown")
async def power_shutdown(body: PowerShutdown):
    """Shut down the PC (optional delay in seconds). Requires admin for delay=0 on some systems."""
    _run_power(["shutdown", "/s", "/t", str(body.delay_seconds)])
    return {"ok": True, "delay_seconds": body.delay_seconds}

@app.post("/power/restart")
async def power_restart(body: PowerRestart):
    """Restart the PC (optional delay in seconds)."""
    _run_power(["shutdown", "/r", "/t", str(body.delay_seconds)])
    return {"ok": True, "delay_seconds": body.delay_seconds}

@app.post("/power/cancel")
async def power_cancel():
    """Cancel a pending shutdown/restart."""
    _run_power(["shutdown", "/a"])
    return {"ok": True}


# --- Info ---

@app.get("/")
async def root():
    return {
        "name": "Tiny Remote",
        "docs": "/docs",
        "endpoints": {
            "mouse": ["/mouse/move", "/mouse/click", "/mouse/scroll", "/mouse/drag", "/mouse/position"],
            "keyboard": ["/keyboard/press", "/keyboard/type", "/keyboard/hotkey", "/keyboard/down", "/keyboard/up"],
            "volume": ["/volume", "/volume (POST)", "/volume/mute"],
            "media": ["/media/playpause"],
            "power": ["/power/lock", "/power/sleep", "/power/shutdown", "/power/restart", "/power/cancel"],
        },
        "platform": platform.system(),
        "volume_available": WINDOWS and _HAS_PYCAW,
    }


if __name__ == "__main__":
    import uvicorn
    # Use app as string so the reloader can re-import the module (hot reload).
    # From terminal: uvicorn main:app --reload --host 0.0.0.0 --port 8765
    uvicorn.run("main:app", host="0.0.0.0", port=8765, reload=True)
