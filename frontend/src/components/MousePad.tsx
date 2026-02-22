import { useRef, useState, type PointerEvent } from "react";
import { Button } from "../ui/Button";
import type { ApiClient } from "../lib/api";

export function MousePad(props: { api: ApiClient }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const accum = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const raf = useRef<number | null>(null);
  const [status, setStatus] = useState<string>("idle");

  const send = async () => {
    raf.current = null;
    const { dx, dy } = accum.current;
    accum.current = { dx: 0, dy: 0 };
    if (dx === 0 && dy === 0) return;

    const r = await props.api.control("/mouse/move", { dx: Math.round(dx), dy: Math.round(dy) });
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  const scheduleSend = () => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(send);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    last.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!last.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    accum.current.dx += dx;
    accum.current.dy += dy;
    scheduleSend();
  };

  const onPointerUp = () => {
    last.current = null;
  };

  const click = async (button: "left" | "right") => {
    const r = await props.api.control("/mouse/click", { button });
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  return (
    <div className="grid gap-3">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="touch-none select-none h-64 rounded-sm border border-grid bg-ink-950/40 shadow-glow"
      >
        <div className="p-3 text-xs text-term-50/70">
          Drag to move. Tap buttons for click. <span className="ml-2 text-term-200/80">[{status}]</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => click("left")}>LEFT CLICK</Button>
        <Button variant="ghost" onClick={() => click("right")}>
          RIGHT CLICK
        </Button>
      </div>
    </div>
  );
}

