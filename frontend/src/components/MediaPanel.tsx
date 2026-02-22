import { useState } from "react";
import type { ApiClient } from "../lib/api";
import { Button } from "../ui/Button";

export function MediaPanel(props: { api: ApiClient }) {
  const [status, setStatus] = useState<string>("idle");

  const send = async (action: "prev" | "playpause" | "next" | "stop") => {
    const r = await props.api.control("/system/media", { action });
    setStatus(r.ok ? "ok" : `err ${r.status}`);
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => send("prev")}>PREV</Button>
        <Button onClick={() => send("next")}>NEXT</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => send("playpause")}>PLAY/PAUSE</Button>
        <Button variant="ghost" onClick={() => send("stop")}>
          STOP
        </Button>
      </div>
      <div className="text-xs text-term-50/70">[{status}]</div>
    </div>
  );
}

