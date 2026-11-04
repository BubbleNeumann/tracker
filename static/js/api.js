import { setServerClock } from "./format.js";

export async function api(path, options) {
  const sentAt = Date.now();
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const serverTime = Number(res.headers.get("X-Server-Time"));
  if (serverTime) setServerClock(serverTime, sentAt, Date.now());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Request failed");
  }
  return res.status === 204 ? null : res.json();
}
