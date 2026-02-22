import { useState } from "react";
import type { ApiClient } from "../lib/api";
import { Button } from "../ui/Button";

export function VolumePanel(props: { api: ApiClient }) {
  const [value, setValue] = useState(50);
  const [status, setStatus] = useState<string>("idle");

  const send = async (action: "up" | "down" | "mute" | "set") => {
    const body = action === "set" ? { action, value } : { action };
    const r = await props.api.control("/system/volume", body);
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <div className="text-xs text-term-50/70 w-24">VOLUME</div>
        <input
          className="w-full accent-term-500"
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value, 10))}
          onMouseUp={() => send("set")}
          onTouchEnd={() => send("set")}
        />
        <div className="w-14 text-right text-xs text-term-200">{value}%</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Button onClick={() => send("down")}>DOWN</Button>
        <Button onClick={() => send("mute")}>MUTE</Button>
        <Button onClick={() => send("up")}>UP</Button>
      </div>
      <div className="text-xs text-term-50/70">[{status}]</div>
    </div>
  );
}

