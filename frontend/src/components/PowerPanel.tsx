import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient } from "../lib/api";
import { Button } from "../ui/Button";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function PowerPanel(props: { api: ApiClient }) {
  const [timerSec, setTimerSec] = useState(60);
  const [status, setStatus] = useState<string>("idle");
  const [holding, setHolding] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const reqHoldMs = 2500;

  useEffect(() => {
    if (!holding) return;
    let raf = 0;
    const tick = () => {
      if (startRef.current == null) startRef.current = performance.now();
      setHoldMs(performance.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [holding]);

  const holdPct = clamp(holdMs / reqHoldMs, 0, 1);

  const sleep = async () => {
    if (!confirm("Sleep this PC?")) return;
    const r = await props.api.control("/system/sleep", {});
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  const shutdownTimer = async () => {
    if (!confirm(`Shutdown in ${timerSec} seconds?`)) return;
    const r = await props.api.control("/system/shutdown-timer", { seconds: timerSec });
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  const shutdownNow = async () => {
    if (!confirm("Shutdown now?")) return;
    const r = await props.api.control("/system/shutdown", { seconds: 0 });
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  const onHoldStart = () => {
    setHolding(true);
    setHoldMs(0);
    startRef.current = null;
  };

  const onHoldEnd = () => {
    const done = holdMs >= reqHoldMs;
    setHolding(false);
    setHoldMs(0);
    startRef.current = null;
    if (done) shutdownNow();
  };

  return (
    <div className="grid gap-3">
      <Button variant="ghost" onClick={sleep}>
        SLEEP
      </Button>

      <div className="grid gap-2 border border-grid bg-ink-950/30 p-3">
        <div className="text-xs text-term-50/70">SHUTDOWN TIMER (seconds)</div>
        <div className="flex items-center gap-3">
          <input
            className="w-full accent-term-500"
            type="range"
            min={10}
            max={3600}
            value={timerSec}
            onChange={(e) => setTimerSec(parseInt(e.target.value, 10))}
          />
          <div className="w-20 text-right text-xs text-term-200">{timerSec}s</div>
        </div>
        <Button onClick={shutdownTimer}>SET TIMER</Button>
      </div>

      <div className="grid gap-2 border border-red-900/50 bg-ink-950/30 p-3">
        <div className="text-xs text-red-200/80">DESTRUCTIVE: PRESS AND HOLD</div>
        <button
          className="relative min-h-12 border border-red-700 bg-ink-800 text-red-200 font-bold tracking-wide"
          onPointerDown={onHoldStart}
          onPointerUp={onHoldEnd}
          onPointerCancel={onHoldEnd}
          onPointerLeave={() => holding && onHoldEnd()}
        >
          <div
            className="absolute inset-0 bg-red-500/20"
            style={{ transform: `scaleX(${holdPct})`, transformOrigin: "left" }}
          />
          <div className="relative z-10">SHUTDOWN</div>
        </button>
        <div className="text-xs text-term-50/70">Hold {Math.ceil((reqHoldMs - holdMs) / 100) / 10}s</div>
      </div>

      <div className="text-xs text-term-50/70">[{status}]</div>
    </div>
  );
}

