import { useRef, useEffect, useCallback } from 'react'

const HEARTBEAT_INTERVAL_MS = 12_000
const HEARTBEAT_REPLY_TIMEOUT_MS = 8_000
const BACKOFF_MIN_MS = 1_000
const BACKOFF_MAX_MS = 30_000
const BACKOFF_MULT = 1.5

/**
 * Robust WebSocket hook: lifecycle-safe, heartbeat, exponential backoff, idempotent reconnect.
 * Returns a ref to the current WebSocket instance (readyState checked by callers).
 */
export function useMouseWebSocket(url, { onOpen, onClose, onMessage } = {}) {
  const wsRef = useRef(null)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatIntervalRef = useRef(null)
  const heartbeatReplyTimeoutRef = useRef(null)
  const backoffMsRef = useRef(BACKOFF_MIN_MS)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  const onMessageRef = useRef(onMessage)
  onOpenRef.current = onOpen
  onCloseRef.current = onClose
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!mountedRef.current || wsRef.current != null) return
    const ws = new WebSocket(url)
    wsRef.current = ws

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current != null) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (heartbeatReplyTimeoutRef.current != null) {
        clearTimeout(heartbeatReplyTimeoutRef.current)
        heartbeatReplyTimeoutRef.current = null
      }
    }

    const scheduleHeartbeat = () => {
      clearHeartbeat()
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return
        heartbeatReplyTimeoutRef.current = setTimeout(() => {
          heartbeatReplyTimeoutRef.current = null
          try {
            ws.close(4000, 'heartbeat timeout')
          } catch (_) {}
        }, HEARTBEAT_REPLY_TIMEOUT_MS)
        try {
          ws.send(JSON.stringify({ ping: true }))
        } catch (_) {
          if (heartbeatReplyTimeoutRef.current) {
            clearTimeout(heartbeatReplyTimeoutRef.current)
            heartbeatReplyTimeoutRef.current = null
          }
        }
      }, HEARTBEAT_INTERVAL_MS)
    }

    ws.addEventListener('open', () => {
      backoffMsRef.current = BACKOFF_MIN_MS
      scheduleHeartbeat()
      onOpenRef.current?.()
    })

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data && data.pong === true && heartbeatReplyTimeoutRef.current != null) {
          clearTimeout(heartbeatReplyTimeoutRef.current)
          heartbeatReplyTimeoutRef.current = null
        }
      } catch (_) {}
      onMessageRef.current?.(event)
    })

    ws.addEventListener('close', () => {
      clearHeartbeat()
      wsRef.current = null
      if (!mountedRef.current) return
      const delay = backoffMsRef.current
      backoffMsRef.current = Math.min(BACKOFF_MAX_MS, Math.floor(backoffMsRef.current * BACKOFF_MULT))
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        if (mountedRef.current && wsRef.current === null) connect()
      }, delay)
      onCloseRef.current?.()
    })

    ws.addEventListener('error', () => {
      // Close will fire and trigger reconnect
    })
  }, [url])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (heartbeatIntervalRef.current != null) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (heartbeatReplyTimeoutRef.current != null) {
        clearTimeout(heartbeatReplyTimeoutRef.current)
        heartbeatReplyTimeoutRef.current = null
      }
      if (wsRef.current != null) {
        try {
          wsRef.current.close()
        } catch (_) {}
        wsRef.current = null
      }
    }
  }, [connect])

  return wsRef
}
