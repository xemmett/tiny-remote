import { getCookie } from "./cookies";

type LoginOk = {
  accessToken: string;
  expiresAt: string;
  session: { id: string; ip: string };
  trustedDevice: { id: string; ip: string; deviceId: string; deviceName: string };
};

type PairingRequired = {
  error: "pairing_required";
  requestId: string;
  pin: string;
  expiresAt: string;
};

export class ApiClient {
  private accessToken: string | null;
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
    this.accessToken = sessionStorage.getItem("tiny_remote_access_token");
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) sessionStorage.setItem("tiny_remote_access_token", token);
    else sessionStorage.removeItem("tiny_remote_access_token");
  }

  private headers(extra?: Record<string, string>) {
    const csrf = getCookie("csrf_token") || "";
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      ...(extra || {}),
    };
    if (this.accessToken) h.Authorization = `Bearer ${this.accessToken}`;
    return h;
  }

  async ensureCsrf() {
    await fetch(this.baseUrl + "/api/csrf", { method: "GET", credentials: "include" });
  }

  async login(params: { username: string; password: string; deviceId: string; deviceName: string }) {
    await this.ensureCsrf();
    const r = await fetch(this.baseUrl + "/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    const data = (await r.json().catch(() => ({}))) as LoginOk | PairingRequired | { error: string };
    if (r.ok) {
      const ok = data as LoginOk;
      this.setAccessToken(ok.accessToken);
      return { ok: true as const, data: ok };
    }
    if ((data as PairingRequired).error === "pairing_required") {
      return { ok: false as const, pairing: data as PairingRequired };
    }
    return { ok: false as const, error: (data as any).error || "login_failed" };
  }

  async refresh(): Promise<boolean> {
    await this.ensureCsrf();
    const r = await fetch(this.baseUrl + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    if (!r.ok) return false;
    const data = (await r.json()) as { accessToken: string };
    this.setAccessToken(data.accessToken);
    return true;
  }

  async logout() {
    await this.ensureCsrf();
    await fetch(this.baseUrl + "/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    this.setAccessToken(null);
  }

  private async authedFetch(path: string, init: RequestInit & { json?: any; nonce?: string } = {}) {
    const nonce = init.nonce || crypto.randomUUID();
    const attempt = async () => {
      const headers = this.headers({ "X-Request-Nonce": nonce, ...(init.headers as any) });
      const body = init.json !== undefined ? JSON.stringify(init.json) : init.body;
      return fetch(this.baseUrl + path, { ...init, headers, body, credentials: "include" });
    };

    let r = await attempt();
    if (r.status === 401) {
      const refreshed = await this.refresh();
      if (refreshed) r = await attempt();
    }
    return r;
  }

  async control(path: string, body: any) {
    const r = await this.authedFetch("/api/control" + path, { method: "POST", json: body });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async listDevices() {
    const r = await this.authedFetch("/api/devices", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async revokeDevice(id: string) {
    const r = await this.authedFetch(`/api/devices/${encodeURIComponent(id)}/revoke`, { method: "POST", json: {} });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }
}

