import { useCallback, useEffect, useRef, useState } from 'react'
import Panel from './Panel'
import Btn from './Btn'

const WS_FPS = 8
const WS_WIDTH = 1280

export default function ScreenCast() {
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle') // idle | connecting | live | error
  const [frameUrl, setFrameUrl] = useState(null)
  const [monitorIndex, setMonitorIndex] = useState(0)
  const [monitorCount, setMonitorCount] = useState(1)
  const wsRef = useRef(null)
  const lastUrlRef = useRef(null)
  const streamContainerRef = useRef(null)

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch (_) {}
      wsRef.current = null
    }
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current)
      lastUrlRef.current = null
    }
    setFrameUrl(null)
    setStatus('idle')
    setActive(false)
  }, [])

  useEffect(() => {
    if (!active) {
      disconnect()
      return
    }
    let cancelled = false
    fetch('/api/screen/monitors')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setMonitorCount(d.count ?? 1) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [active, disconnect])

  useEffect(() => {
    if (!active) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${proto}//${host}/ws/screen?fps=${WS_FPS}&width=${WS_WIDTH}&monitor=${monitorIndex}`
    setStatus('connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.binaryType = 'blob'
    ws.onopen = () => setStatus('live')
    ws.onerror = () => setStatus('error')
    ws.onclose = () => {
      wsRef.current = null
      if (active) setStatus('error')
    }
    ws.onmessage = (ev) => {
      if (ev.data instanceof Blob) {
        const url = URL.createObjectURL(ev.data)
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = url
        setFrameUrl(url)
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = null
      }
      setFrameUrl(null)
    }
  }, [active, monitorIndex])

  const prevMonitor = () => {
    setMonitorIndex((i) => Math.max(0, i - 1))
  }
  const nextMonitor = () => {
    setMonitorIndex((i) => Math.min(monitorCount - 1, i + 1))
  }

  const openFullscreen = () => {
    const base = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '')
    const streamUrl = `${base}/api/screen/stream?monitor=${monitorIndex}`
    const win = window.open(streamUrl, 'tiny-remote-screen', 'noopener,noreferrer,width=1280,height=720')
    if (win) {
      win.addEventListener('load', () => {
        try {
          win.document.documentElement.requestFullscreen?.()
        } catch (_) {}
      })
    }
  }

  const fullscreenInline = () => {
    const el = streamContainerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        el.requestFullscreen?.()
      } else {
        document.exitFullscreen?.()
      }
    } catch (_) {}
  }

  return (
    <Panel title="Screen">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Btn onClick={() => setActive(!active)}>
            {active ? 'Stop screen' : 'View screen'}
          </Btn>
          {active && (
            <>
              <div className="flex items-center gap-1">
                <Btn variant="ghost" className="!px-2 !py-1" onClick={prevMonitor} title="Previous monitor">
                  ←
                </Btn>
                <span className="text-matrix-green-dim text-sm font-mono min-w-[4rem] text-center">
                  {monitorIndex === 0 ? 'All' : `#${monitorIndex}`} / {monitorCount}
                </span>
                <Btn variant="ghost" className="!px-2 !py-1" onClick={nextMonitor} title="Next monitor">
                  →
                </Btn>
              </div>
              <Btn variant="ghost" onClick={fullscreenInline} title="Fullscreen this view">
                ⛶ Fullscreen
              </Btn>
              <Btn variant="ghost" onClick={openFullscreen} title="Open in new window (browser video-style)">
                ↗ New window
              </Btn>
            </>
          )}
          <span className="text-matrix-green-dim text-sm font-mono">[{status}]</span>
        </div>
        {active && (
          <div
            ref={streamContainerRef}
            className="rounded border border-matrix-border bg-matrix-bg overflow-hidden"
          >
            {frameUrl ? (
              <img
                src={frameUrl}
                alt="Desktop screen"
                className="block w-full max-h-[60vh] object-contain"
              />
            ) : (
              <div className="flex min-h-[200px] items-center justify-center text-matrix-green-dim text-sm font-mono">
                {status === 'connecting' && 'Connecting…'}
                {status === 'live' && 'Waiting for first frame…'}
                {status === 'error' && 'Connection failed. Is the PC on and proxy running?'}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
