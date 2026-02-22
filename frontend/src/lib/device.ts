function getOrCreate(key: string, gen: () => string) {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const v = gen();
  localStorage.setItem(key, v);
  return v;
}

export function getDeviceId() {
  return getOrCreate("tiny_remote_device_id", () => crypto.randomUUID());
}

export function getDeviceName() {
  return getOrCreate("tiny_remote_device_name", () => {
    const ua = navigator.userAgent;
    const short = ua.includes("Android")
      ? "Android"
      : ua.includes("iPhone") || ua.includes("iPad")
        ? "iOS"
        : ua.includes("Windows")
          ? "Windows"
          : ua.includes("Mac")
            ? "Mac"
            : "Device";
    return `${short}-${Math.random().toString(16).slice(2, 6)}`;
  });
}

