/**
 * API client — all requests go through the Express proxy (/api) to FastAPI.
 */
const BASE = '/api';

async function request(method, path, body = null) {
  const opts = { method, headers: {} };
  if (body != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.detail || data?.error || res.statusText);
  return data;
}

export const api = {
  // Mouse
  mouseMove: (x, y, duration = 0) => request('POST', '/mouse/move', { x, y, duration }),
  mouseMoveRelative: (dx, dy, duration = 0) => request('POST', '/mouse/move/relative', { dx, dy, duration }),
  mouseClick: (button = 'left', x = null, y = null, clicks = 1) =>
    request('POST', '/mouse/click', { button, x, y, clicks }),
  mouseScroll: (amount, x = null, y = null) => request('POST', '/mouse/scroll', { amount, x, y }),
  mousePosition: () => request('GET', '/mouse/position'),
  mouseDrag: (x, y, button = 'left', duration = 0) =>
    request('POST', '/mouse/drag', { x, y, button, duration }),

  // Keyboard
  keyboardPress: (key) => request('POST', '/keyboard/press', { key }),
  keyboardType: (text, interval = 0) => request('POST', '/keyboard/type', { text, interval }),
  keyboardHotkey: (keys) => request('POST', '/keyboard/hotkey', { keys }),
  keyboardDown: (key) => request('POST', '/keyboard/down', { key }),
  keyboardUp: (key) => request('POST', '/keyboard/up', { key }),

  // Volume
  volumeGet: () => request('GET', '/volume'),
  volumeSet: (level) => request('POST', '/volume', { level }),
  volumeMute: (mute) => request('POST', '/volume/mute', { mute }),

  // Media
  mediaPlayPause: () => request('POST', '/media/playpause'),

  // Power
  powerLock: () => request('POST', '/power/lock'),
  powerSleep: () => request('POST', '/power/sleep'),
  powerShutdown: (delay_seconds = 0) => request('POST', '/power/shutdown', { delay_seconds }),
  powerRestart: (delay_seconds = 0) => request('POST', '/power/restart', { delay_seconds }),
  powerCancel: () => request('POST', '/power/cancel'),
};
