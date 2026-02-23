import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api/client'
import Panel from './components/Panel'
import Btn from './components/Btn'
import StatusBar from './components/StatusBar'

function useStatus() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const show = useCallback((msg, isError = false) => {
    setError(!!isError)
    setMessage(msg || '')
    if (msg) setTimeout(() => setMessage(''), 3000)
  }, [])
  return { message, error, show }
}

export default function App() {
  const { message, error, show } = useStatus()
  const [position, setPosition] = useState(null)
  const [volume, setVolume] = useState(null)
  const [hotkeyKeys, setHotkeyKeys] = useState('ctrl,c')
  const trackpadLast = useRef(null)
  const trackpadAccum = useRef({ dx: 0, dy: 0 })
  const trackpadRaf = useRef(null)
  const mouseWs = useRef(null)
  // Multi-touch: pointers by id, first pointer = anchor (hold), second = drag or scroll
  const trackpadPointers = useRef(new Map())
  const trackpadGestureMode = useRef(null) // null | 'two_scroll' | 'two_select'
  const trackpadAnchorId = useRef(null)
  const trackpadScrollAccum = useRef(0)
  const trackpadScrollRaf = useRef(null)
  const [typeText, setTypeText] = useState('')
  const typeTextPrevRef = useRef('')
  const typeSendQueueRef = useRef(Promise.resolve())
  const [shutdownTimerMins, setShutdownTimerMins] = useState('')
  const [shutdownTimerPopupOpen, setShutdownTimerPopupOpen] = useState(false)

  const wsUrl = typeof window !== 'undefined'
    ? window.location.origin.replace(/^http/, 'ws') + '/ws/mouse'
    : 'ws://localhost:8765/ws/mouse'
  useEffect(() => {
    const ws = new WebSocket(wsUrl)
    mouseWs.current = ws

    const onOpen = () => {
      show('WebSocket connected successfully!', false)
      console.log('WebSocket connected successfully!', wsUrl)
    }

    const onClose = () => {
      mouseWs.current = null
      setTimeout(() => {
        if (mouseWs.current === null) {
          const retry = new WebSocket(wsUrl)
          mouseWs.current = retry
          retry.addEventListener('open', onOpen)
          retry.addEventListener('close', onClose)
        }
      }, 2000)
    }

    ws.addEventListener('open', onOpen)
    ws.addEventListener('close', onClose)
    return () => {
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('close', onClose)
      ws.close()
      mouseWs.current = null
    }
  }, [wsUrl])


  const refreshPosition = useCallback(async () => {
    try {
      const p = await api.mousePosition()
      setPosition(p)
    } catch (e) {
      show(e.message, true)
    }
  }, [show])

  const refreshVolume = useCallback(async () => {
    try {
      const v = await api.volumeGet()
      setVolume(v)
    } catch (e) {
      show(e.message, true)
    }
  }, [show])

  useEffect(() => {
    refreshPosition()
    refreshVolume()
  }, [refreshPosition, refreshVolume])

  const run = async (fn, successText = 'OK') => {
    try {
      await fn()
      show(successText)
      refreshPosition()
      refreshVolume()
    } catch (e) {
      show(e.message, true)
    }
  }

  const sendTrackpadMove = useCallback(() => {
    trackpadRaf.current = null
    const { dx, dy } = trackpadAccum.current
    trackpadAccum.current = { dx: 0, dy: 0 }
    const rdx = Math.round(dx)
    const rdy = Math.round(dy)
    if (rdx === 0 && rdy === 0) return
    const ws = mouseWs.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ dx: rdx, dy: rdy }))
    }
  }, [])

  const sendTrackpadScroll = useCallback(() => {
    trackpadScrollRaf.current = null
    const amount = Math.round(trackpadScrollAccum.current)
    trackpadScrollAccum.current = 0
    if (amount === 0) return
    const ws = mouseWs.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ scroll: amount }))
    }
  }, [])

  const scheduleTrackpadSend = useCallback(() => {
    if (trackpadRaf.current != null) return
    trackpadRaf.current = requestAnimationFrame(sendTrackpadMove)
  }, [sendTrackpadMove])

  const scheduleTrackpadScrollSend = useCallback(() => {
    if (trackpadScrollRaf.current != null) return
    trackpadScrollRaf.current = requestAnimationFrame(sendTrackpadScroll)
  }, [sendTrackpadScroll])

  const onTrackpadPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const id = e.pointerId
    const x = e.clientX
    const y = e.clientY
    const pointers = trackpadPointers.current
    if (pointers.size === 0) trackpadAnchorId.current = id
    pointers.set(id, { x, y, startX: x, startY: y })
    if (pointers.size === 1) {
      trackpadLast.current = { x, y }
      trackpadGestureMode.current = null
    } else {
      trackpadLast.current = null
      trackpadGestureMode.current = null
    }
  }, [])

  const onTrackpadPointerMove = useCallback((e) => {
    e.preventDefault()
    const id = e.pointerId
    const x = e.clientX
    const y = e.clientY
    const pointers = trackpadPointers.current
    const ptr = pointers.get(id)
    if (!ptr) return
    ptr.x = x
    ptr.y = y

    if (pointers.size === 1) {
      const dx = x - trackpadLast.current.x
      const dy = y - trackpadLast.current.y
      trackpadLast.current = { x, y }
      trackpadAccum.current.dx += dx
      trackpadAccum.current.dy += dy
      scheduleTrackpadSend()
      return
    }

    if (pointers.size === 2 && trackpadGestureMode.current === null) {
      const anchorId = trackpadAnchorId.current
      const anchor = pointers.get(anchorId)
      const otherId = [...pointers.keys()].find((k) => k !== anchorId)
      const other = pointers.get(otherId)
      if (!anchor || !other) return
      const distAnchor = Math.hypot(anchor.x - anchor.startX, anchor.y - anchor.startY)
      const distOther = Math.hypot(other.x - other.startX, other.y - other.startY)
      if (distAnchor < 8 && distOther > 8) {
        trackpadGestureMode.current = 'two_select'
        other.prev = { x: other.x, y: other.y }
        api.mouseDown('left').catch(() => {})
        trackpadAccum.current.dx += other.x - other.startX
        trackpadAccum.current.dy += other.y - other.startY
        scheduleTrackpadSend()
      } else {
        trackpadGestureMode.current = 'two_scroll'
      }
    }

    if (pointers.size === 2 && trackpadGestureMode.current === 'two_select') {
      const anchorId = trackpadAnchorId.current
      const otherId = [...pointers.keys()].find((k) => k !== anchorId)
      if (id !== otherId) return
      const other = pointers.get(otherId)
      const prev = other.prev ?? { x: other.startX, y: other.startY }
      const dx = other.x - prev.x
      const dy = other.y - prev.y
      other.prev = { x: other.x, y: other.y }
      trackpadAccum.current.dx += dx
      trackpadAccum.current.dy += dy
      scheduleTrackpadSend()
      return
    }

    if (pointers.size === 2 && trackpadGestureMode.current === 'two_scroll') {
      const ptr = pointers.get(id)
      const prevY = ptr.prevY ?? ptr.startY
      const dy = ptr.y - prevY
      ptr.prevY = ptr.y
      trackpadScrollAccum.current += -dy * 0.8
      scheduleTrackpadScrollSend()
    }
  }, [scheduleTrackpadSend, scheduleTrackpadScrollSend])

  const onTrackpadPointerUp = useCallback((e) => {
    const id = e.pointerId
    const wasSelect = trackpadGestureMode.current === 'two_select'
    const anchorId = trackpadAnchorId.current
    const pointers = trackpadPointers.current
    pointers.delete(id)
    if (wasSelect) {
      api.mouseUp('left').catch(() => {})
    }
    if (pointers.size === 1) {
      const [, single] = [...pointers.entries()][0]
      trackpadLast.current = { x: single.x, y: single.y }
      trackpadAnchorId.current = pointers.keys().next().value
    } else if (pointers.size === 0) {
      trackpadLast.current = null
      trackpadAnchorId.current = null
    }
    trackpadGestureMode.current = pointers.size === 2 ? trackpadGestureMode.current : null
    if (pointers.size <= 1) refreshPosition()
  }, [refreshPosition])

  const handleHotkey = () => {
    const keys = hotkeyKeys.split(/[\s,]+/).map((k) => k.trim().toLowerCase()).filter(Boolean)
    if (!keys.length) {
      show('Enter keys (e.g. ctrl,c)', true)
      return
    }
    run(() => api.keyboardHotkey(keys), `Hotkey [${keys.join('+')}]`)
  }

  const handleTypeChange = useCallback((e) => {
    const newVal = e.target.value
    setTypeText(newVal)
    const oldVal = typeTextPrevRef.current
    let prefixLen = 0
    while (prefixLen < oldVal.length && prefixLen < newVal.length && oldVal[prefixLen] === newVal[prefixLen]) {
      prefixLen++
    }
    const backspaceCount = oldVal.length - prefixLen
    const toType = newVal.slice(prefixLen)
    typeTextPrevRef.current = newVal
    const promise = typeSendQueueRef.current.then(async () => {
      try {
        for (let i = 0; i < backspaceCount; i++) await api.keyboardPress('backspace')
        if (toType) await api.keyboardType(toType)
      } catch (err) {
        show(err.message, true)
      }
    })
    typeSendQueueRef.current = promise
  }, [show])

  return (
    <div className="relative min-h-screen pb-12">
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-bold text-matrix-green tracking-tight">
              tiny_remote
            </h1>
            <span className="text-matrix-dim text-sm font-mono">v0.1</span>
          </div>
          <p className="text-matrix-green-dim text-sm">
            &gt; remote control panel — mouse · keyboard · media · power
          </p>
          <p className="text-matrix-green-dim text-sm">
            &gt; wsUrl: {wsUrl}
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Mouse */}
          <Panel title="Mouse">
            <div className="space-y-4">
              {/* Laptop-style mouse pad: drag area + L/R click buttons inside one outline */}
              <div className="rounded border border-matrix-border bg-matrix-bg/80 overflow-hidden shadow-glow">
                <div
                  className="touch-none select-none h-48 flex items-center justify-center text-matrix-green-dim text-sm font-mono px-2"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onTrackpadPointerDown}
                  onPointerMove={onTrackpadPointerMove}
                  onPointerUp={onTrackpadPointerUp}
                  onPointerCancel={onTrackpadPointerUp}
                >
                  One finger: move · Two: scroll · Hold one, drag other: select
                </div>
                <div className="flex border-t border-matrix-border">
                  <Btn
                    className="flex-1 rounded-none border-0 border-r border-matrix-border"
                    onClick={() => run(() => api.mouseClick('left'), 'Left click')}
                  >
                    L
                  </Btn>
                  <Btn
                    className="flex-1 rounded-none border-0"
                    onClick={() => run(() => api.mouseClick('right'), 'Right click')}
                  >
                    R
                  </Btn>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Btn variant="ghost" onClick={refreshPosition}>refresh</Btn>
                <Btn onClick={() => run(() => api.mouseScroll(3), 'Scroll up')}>scroll ↑</Btn>
                <Btn onClick={() => run(() => api.mouseScroll(-3), 'Scroll down')}>scroll ↓</Btn>
              </div>
            </div>
          </Panel>

          {/* Keyboard */}
          <Panel title="Keyboard">
            <div className="space-y-4">
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Shortcuts</div>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'a']), 'Ctrl+A')}>Ctrl+A</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'c']), 'Ctrl+C')}>Ctrl+C</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'v']), 'Ctrl+V')}>Ctrl+V</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'x']), 'Ctrl+X')}>Ctrl+X</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'z']), 'Ctrl+Z')}>Ctrl+Z</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['alt', 'tab']), 'Alt+Tab')}>Alt+Tab</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['win', 'left']), 'Win+Left')}>Win+←</Btn>
                  <Btn onClick={() => run(() => api.keyboardHotkey(['win', 'right']), 'Win+Right')}>Win+→</Btn>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="e.g. ctrl, shift, c"
                    value={hotkeyKeys}
                    onChange={(e) => setHotkeyKeys(e.target.value)}
                    className="flex-1 min-w-0 bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-matrix-green text-sm font-mono focus:border-matrix-green focus:outline-none"
                  />
                  <Btn onClick={handleHotkey}>send</Btn>
                </div>
              </div>
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Buttons</div>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => run(() => api.keyboardPress('enter'), 'Enter')}>Enter</Btn>
                  <Btn onClick={() => run(() => api.keyboardPress('escape'), 'Escape')}>Esc</Btn>
                  <Btn onClick={() => run(() => api.keyboardPress('tab'), 'Tab')}>Tab</Btn>
                </div>
              </div>
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Directional</div>
                <div className="flex flex-col items-center gap-1 w-fit">
                  <Btn onClick={() => run(() => api.keyboardPress('up'), 'Up')}>↑</Btn>
                  <div className="flex gap-2">
                    <Btn onClick={() => run(() => api.keyboardPress('left'), 'Left')}>←</Btn>
                    <Btn onClick={() => run(() => api.keyboardPress('down'), 'Down')}>↓</Btn>
                    <Btn onClick={() => run(() => api.keyboardPress('right'), 'Right')}>→</Btn>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Type</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Type here — streams to PC as you type"
                    value={typeText}
                    onChange={handleTypeChange}
                    className="flex-1 min-w-0 bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-matrix-green text-sm font-mono focus:border-matrix-green focus:outline-none"
                  />
                  {typeText != null && typeText !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        typeTextPrevRef.current = ''
                        setTypeText('')
                      }}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded text-matrix-green-dim hover:text-matrix-green hover:bg-matrix-bg border border-matrix-border text-sm font-mono"
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          {/* Media */}
          <Panel title="Media">
            <div className="space-y-4">
              {/* Transport icons: rewind | play | pause | fast forward — centered above volume */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => run(() => api.mediaPrev(), 'Rewind')}
                  className="p-2 rounded border border-matrix-green bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 hover:shadow-glow transition-all active:scale-[0.98]"
                  title="Rewind"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block">
                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => run(() => api.mediaPlayPause(), 'Play')}
                  className="p-2 rounded border border-matrix-green bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 hover:shadow-glow transition-all active:scale-[0.98]"
                  title="Play"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => run(() => api.mediaPlayPause(), 'Pause')}
                  className="p-2 rounded border border-matrix-green bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 hover:shadow-glow transition-all active:scale-[0.98]"
                  title="Pause"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => run(() => api.mediaNext(), 'Fast forward')}
                  className="p-2 rounded border border-matrix-green bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 hover:shadow-glow transition-all active:scale-[0.98]"
                  title="Fast forward"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="block">
                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                  </svg>
                </button>
              </div>
              {volume != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-matrix-green-dim">Level</span>
                  <span className="text-matrix-cyan font-semibold">{volume.volume}%</span>
                </div>
              )}
              <input
                type="range"
                min="0"
                max="100"
                value={volume?.volume ?? 50}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setVolume((prev) => (prev ? { ...prev, volume: v } : { volume: v, muted: false }))
                  api.volumeSet(v).then(() => show(`${v}%`)).catch((err) => show(err.message, true))
                }}
                className="w-full h-2 bg-matrix-dim rounded-full appearance-none cursor-pointer accent-matrix-green"
              />
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => run(() => api.volumeMute(!volume?.muted), volume?.muted ? 'Unmuted' : 'Muted')}>
                  {volume?.muted ? 'Unmute' : 'Mute'}
                </Btn>
                <Btn variant="ghost" onClick={refreshVolume}>refresh</Btn>
              </div>
            </div>
          </Panel>

          {/* Programs */}
          <Panel title="Programs">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => run(() => api.appsLaunch('browser'), 'Browser')}>Browser</Btn>
              <Btn onClick={() => run(() => api.appsLaunch('spotify'), 'Spotify')}>Spotify</Btn>
              <Btn onClick={() => run(() => api.appsLaunch('jellyfin'), 'Jellyfin')}>Jellyfin</Btn>
              <Btn onClick={() => run(() => api.appsLaunch('youtube'), 'YouTube')}>YouTube</Btn>
            </div>
          </Panel>

          {/* Power */}
          <Panel title="Power">
            <div className="space-y-4">
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Basic</div>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => run(() => api.powerLock(), 'Locked')}>Lock</Btn>
                  <Btn onClick={() => run(() => api.powerSleep(), 'Sleep')}>Sleep</Btn>
                </div>
              </div>
              <div>
                <div className="text-matrix-green-dim text-xs font-mono mb-1.5">Shutdown</div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="danger" onClick={() => run(() => api.powerShutdown(0), 'Shutdown now')}>Shutdown now</Btn>
                  <Btn variant="danger" onClick={() => run(() => api.powerRestart(0), 'Restart')}>Restart</Btn>
                  <Btn variant="danger" onClick={() => setShutdownTimerPopupOpen(true)}>Timer...</Btn>
                  <Btn variant="ghost" onClick={() => run(() => api.powerCancel(), 'Cancel')}>Cancel</Btn>
                </div>
              </div>
            </div>
          </Panel>

          {/* Shutdown timer popup */}
          {shutdownTimerPopupOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShutdownTimerPopupOpen(false)}
            >
              <div
                className="rounded-lg border border-matrix-border bg-matrix-surface shadow-glow p-4 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-matrix-cyan font-mono font-semibold text-sm uppercase tracking-widest">Shutdown timer</h3>
                  <button
                    type="button"
                    onClick={() => setShutdownTimerPopupOpen(false)}
                    className="text-matrix-green-dim hover:text-matrix-green text-sm font-mono"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Btn variant="danger" onClick={() => { run(() => api.powerShutdown(10 * 60), 'Shutdown in 10 min'); setShutdownTimerPopupOpen(false) }}>10 min</Btn>
                  <Btn variant="danger" onClick={() => { run(() => api.powerShutdown(30 * 60), 'Shutdown in 30 min'); setShutdownTimerPopupOpen(false) }}>30 min</Btn>
                  <Btn variant="danger" onClick={() => { run(() => api.powerShutdown(60 * 60), 'Shutdown in 60 min'); setShutdownTimerPopupOpen(false) }}>60 min</Btn>
                </div>
                <div className="flex gap-2 items-center mt-3">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="Mins"
                    value={shutdownTimerMins}
                    onChange={(e) => setShutdownTimerMins(e.target.value.replace(/\D/g, ''))}
                    className="w-20 bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-matrix-green text-sm font-mono focus:border-matrix-green focus:outline-none"
                  />
                  <Btn
                    variant="danger"
                    onClick={() => {
                      const mins = parseInt(shutdownTimerMins, 10)
                      if (!Number.isFinite(mins) || mins < 1) {
                        show('Enter minutes (1–1440)', true)
                        return
                      }
                      run(() => api.powerShutdown(mins * 60), `Shutdown in ${mins} min`)
                      setShutdownTimerPopupOpen(false)
                    }}
                  >
                    Custom
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <StatusBar message={message} error={error} position={position} />
    </div>
  )
}
