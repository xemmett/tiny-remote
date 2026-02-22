import { useEffect, useState } from "react";
import type { ApiClient } from "../lib/api";
import { Button } from "../ui/Button";

type Device = {
  id: string;
  deviceName: string;
  ip: string;
  deviceId: string;
  approvedAt: string | null;
  revokedAt: string | null;
};

export function DeviceList(props: { api: ApiClient }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<string>("idle");

  const load = async () => {
    setStatus("loading");
    const r = await props.api.listDevices();
    if (!r.ok) {
      setStatus(`err ${r.status}`);
      return;
    }
    setDevices((r.data as any).devices || []);
    setStatus("ok");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revoke = async (id: string) => {
    if (!confirm("Revoke this device?")) return;
    const r = await props.api.revokeDevice(id);
    if (r.ok) await load();
    else setStatus(`err ${r.status}`);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-term-50/70">TRUSTED DEVICES</div>
        <Button variant="ghost" onClick={load}>
          REFRESH
        </Button>
      </div>
      <div className="grid gap-2">
        {devices.length === 0 ? (
          <div className="text-xs text-term-50/70">No devices.</div>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 border border-grid bg-ink-950/20 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-term-200 truncate">{d.deviceName}</div>
                <div className="text-xs text-term-50/70 truncate">
                  {d.ip} · {d.deviceId}
                </div>
              </div>
              <Button variant="danger" onClick={() => revoke(d.id)}>
                REVOKE
              </Button>
            </div>
          ))
        )}
      </div>
      <div className="text-xs text-term-50/70">[{status}]</div>
    </div>
  );
}

