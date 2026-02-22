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
  const [typeText, setTypeText] = useState('')
  const typeTextPrevRef = useRef('')
  const typeSendQueueRef = useRef(Promise.resolve())

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

  const scheduleTrackpadSend = useCallback(() => {
    if (trackpadRaf.current != null) return
    trackpadRaf.current = requestAnimationFrame(sendTrackpadMove)
  }, [sendTrackpadMove])

  const onTrackpadPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    trackpadLast.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onTrackpadPointerMove = useCallback((e) => {
    if (!trackpadLast.current) return
    e.preventDefault()
    const dx = e.clientX - trackpadLast.current.x
    const dy = e.clientY - trackpadLast.current.y
    trackpadLast.current = { x: e.clientX, y: e.clientY }
    trackpadAccum.current.dx += dx
    trackpadAccum.current.dy += dy
    scheduleTrackpadSend()
  }, [scheduleTrackpadSend])

  const onTrackpadPointerUp = useCallback(() => {
    trackpadLast.current = null
    refreshPosition()
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
              <div
                className="touch-none select-none h-40 rounded border border-matrix-border bg-matrix-bg/80 flex items-center justify-center text-matrix-green-dim text-sm font-mono"
                style={{ touchAction: 'none' }}
                onPointerDown={onTrackpadPointerDown}
                onPointerMove={onTrackpadPointerMove}
                onPointerUp={onTrackpadPointerUp}
                onPointerCancel={onTrackpadPointerUp}
              >
                Drag here to move cursor
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Btn variant="ghost" onClick={refreshPosition}>pos</Btn>
                <Btn onClick={() => run(() => api.mouseClick('left'), 'Left click')}>L click</Btn>
                <Btn onClick={() => run(() => api.mouseClick('right'), 'Right click')}>R click</Btn>
                <Btn onClick={() => run(() => api.mouseScroll(3), 'Scroll up')}>scroll ↑</Btn>
                <Btn onClick={() => run(() => api.mouseScroll(-3), 'Scroll down')}>scroll ↓</Btn>
              </div>
            </div>
          </Panel>

          {/* Keyboard */}
          <Panel title="Keyboard">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'c']), 'Ctrl+C')}>Ctrl+C</Btn>
                <Btn onClick={() => run(() => api.keyboardHotkey(['ctrl', 'v']), 'Ctrl+V')}>Ctrl+V</Btn>
                <Btn onClick={() => run(() => api.keyboardHotkey(['alt', 'tab']), 'Alt+Tab')}>Alt+Tab</Btn>
                <Btn onClick={() => run(() => api.keyboardPress('enter'), 'Enter')}>Enter</Btn>
                <Btn onClick={() => run(() => api.keyboardPress('escape'), 'Escape')}>Esc</Btn>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ctrl, shift, c"
                  value={hotkeyKeys}
                  onChange={(e) => setHotkeyKeys(e.target.value)}
                  className="flex-1 min-w-0 bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-matrix-green text-sm font-mono focus:border-matrix-green focus:outline-none"
                />
                <Btn onClick={handleHotkey}>send</Btn>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type here — streams to PC as you type"
                  value={typeText}
                  onChange={handleTypeChange}
                  className="flex-1 min-w-0 bg-matrix-bg border border-matrix-border rounded px-2 py-1.5 text-matrix-green text-sm font-mono focus:border-matrix-green focus:outline-none"
                />
              </div>
            </div>
          </Panel>

          {/* Media */}
          <Panel title="Media">
            <div className="space-y-4">
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
                <Btn onClick={() => run(() => api.mediaPlayPause(), 'Play/Pause')}>Play</Btn>
                <Btn onClick={() => run(() => api.mediaPlayPause(), 'Play/Pause')}>Pause</Btn>
                <Btn onClick={() => run(() => api.volumeMute(!volume?.muted), volume?.muted ? 'Unmuted' : 'Muted')}>
                  {volume?.muted ? 'Unmute' : 'Mute'}
                </Btn>
                <Btn variant="ghost" onClick={refreshVolume}>refresh</Btn>
              </div>
            </div>
          </Panel>

          {/* Power */}
          <Panel title="Power">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => run(() => api.powerLock(), 'Locked')}>Lock</Btn>
              <Btn onClick={() => run(() => api.powerSleep(), 'Sleep')}>Sleep</Btn>
              <Btn variant="danger" onClick={() => run(() => api.powerShutdown(0), 'Shutdown')}>Shutdown</Btn>
              <Btn variant="danger" onClick={() => run(() => api.powerRestart(0), 'Restart')}>Restart</Btn>
              <Btn variant="ghost" onClick={() => run(() => api.powerCancel(), 'Cancel')}>Cancel</Btn>
            </div>
          </Panel>
        </div>
      </div>

      <StatusBar message={message} error={error} position={position} />
    </div>
  )
}
