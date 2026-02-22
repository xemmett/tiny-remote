import { Button } from "../ui/Button";

export function SessionStatus(props: {
  sessionIp: string | null;
  deviceId: string;
  deviceName: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-term-50/70">SESSION</div>
        <div className="text-sm text-term-200 truncate">
          {props.sessionIp ? `CONNECTED (ip=${props.sessionIp})` : "DISCONNECTED"}
        </div>
        <div className="text-xs text-term-50/70 truncate">
          device={props.deviceName} · {props.deviceId}
        </div>
      </div>
      <Button variant="ghost" onClick={props.onLogout}>
        LOGOUT
      </Button>
    </div>
  );
}

