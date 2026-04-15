import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "./lib/api";
import { getDeviceId, getDeviceName } from "./lib/device";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { MousePad } from "./components/MousePad";
import { VolumePanel } from "./components/VolumePanel";
import { MediaPanel } from "./components/MediaPanel";
import { PowerPanel } from "./components/PowerPanel";
import { DeviceList } from "./components/DeviceList";
import { SessionStatus } from "./components/SessionStatus";
import { ScreenCast } from "./components/ScreenCast";

type PairingState =
  | null
  | { requestId: string; pin: string; expiresAt: string };

export default function App() {
  const api = useMemo(() => new ApiClient(""), []);
  const deviceId = useMemo(() => getDeviceId(), []);
  const deviceName = useMemo(() => getDeviceName(), []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionIp, setSessionIp] = useState<string | null>(sessionStorage.getItem("tiny_remote_session_ip"));
  const [status, setStatus] = useState<string>("idle");
  const [pairing, setPairing] = useState<PairingState>(null);

  const loggedIn = !!sessionIp;

  useEffect(() => {
    api.ensureCsrf().catch(() => {});
  }, [api]);

  const login = async () => {
    setStatus("logging_in");
    setPairing(null);
    const r = await api.login({ username, password, deviceId, deviceName });
    if (r.ok) {
      setSessionIp(r.data.session.ip);
      sessionStorage.setItem("tiny_remote_session_ip", r.data.session.ip);
      setStatus("ok");
      return;
    }
    if ("pairing" in r && r.pairing) {
      setPairing({ requestId: r.pairing.requestId, pin: r.pairing.pin, expiresAt: r.pairing.expiresAt });
      setStatus("pairing_required");
      return;
    }
    setStatus("error");
  };

  const logout = async () => {
    await api.logout();
    setSessionIp(null);
    sessionStorage.removeItem("tiny_remote_session_ip");
    setPairing(null);
    setStatus("logged_out");
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-term-50/60">LAN ONLY · HTTPS · CSRF · NONCE</div>
          <div className="text-2xl font-extrabold tracking-tight text-term-200">tiny-remote</div>
        </div>
        <div className="text-xs text-term-50/60 text-right">
          <div>device: {deviceName}</div>
          <div className="text-term-200">{deviceId}</div>
        </div>
      </div>

      <Card title="STATUS" right={status}>
        <SessionStatus sessionIp={sessionIp} deviceId={deviceId} deviceName={deviceName} onLogout={logout} />
      </Card>

      {!loggedIn ? (
        <div className="mt-6 grid gap-4">
          <Card title="LOGIN">
            <div className="grid gap-3">
              <label className="grid gap-1">
                <div className="text-xs text-term-50/70">USERNAME</div>
                <input
                  className="min-h-11 bg-ink-950/40 border border-grid px-3 text-term-50 outline-none focus:border-term-700"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </label>
              <label className="grid gap-1">
                <div className="text-xs text-term-50/70">PASSWORD</div>
                <input
                  className="min-h-11 bg-ink-950/40 border border-grid px-3 text-term-50 outline-none focus:border-term-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                />
              </label>
              <Button onClick={login}>CONNECT</Button>
              {pairing ? (
                <div className="border border-grid bg-ink-950/20 p-3">
                  <div className="text-xs text-term-50/70">PAIRING REQUIRED</div>
                  <div className="mt-2 text-sm text-term-200">
                    PIN: <span className="font-extrabold tracking-widest">{pairing.pin}</span>
                  </div>
                  <div className="mt-1 text-xs text-term-50/70">Approve this device on the PC: `http://127.0.0.1:8444`</div>
                  <div className="mt-1 text-xs text-term-50/70">Expires: {pairing.expiresAt}</div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Card title="SCREEN">
              <ScreenCast />
            </Card>
          </div>
          <Card title="MOUSE">
            <MousePad api={api} />
          </Card>
          <Card title="VOLUME">
            <VolumePanel api={api} />
          </Card>
          <Card title="MEDIA">
            <MediaPanel api={api} />
          </Card>
          <Card title="POWER">
            <PowerPanel api={api} />
          </Card>
          <div className="md:col-span-2">
            <Card title="DEVICES">
              <DeviceList api={api} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

