import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";

const WS_FPS = 8;
const WS_WIDTH = 1280;

export function ScreenCast() {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setFrameUrl(null);
    setStatus("idle");
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) {
      disconnect();
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/ws/screen?fps=${WS_FPS}&width=${WS_WIDTH}`;
    setStatus("connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = "blob";
    ws.onopen = () => setStatus("live");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      wsRef.current = null;
      if (active) setStatus("error");
    };
    ws.onmessage = (ev) => {
      if (ev.data instanceof Blob && ev.data.type.startsWith("image/")) {
        const url = URL.createObjectURL(ev.data);
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;
        setFrameUrl(url);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      setFrameUrl(null);
    };
  }, [active, disconnect]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setActive(!active)}>
          {active ? "STOP SCREEN" : "VIEW SCREEN"}
        </Button>
        <span className="text-xs text-term-50/70">[{status}]</span>
      </div>
      {active && (
        <div className="relative overflow-hidden rounded border border-grid bg-ink-950">
          {frameUrl ? (
            <img
              src={frameUrl}
              alt="Desktop screen"
              className="block w-full max-h-[60vh] object-contain"
            />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center text-term-50/60 text-sm">
              {status === "connecting" && "Connecting…"}
              {status === "live" && "Waiting for first frame…"}
              {status === "error" && "Connection failed. Is the PC on and proxy running?"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
