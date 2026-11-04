// How far the server clock is ahead of this device's clock. Timestamps come
// from the server, so a running timer must be measured against server time;
// otherwise a device whose clock is behind shows 00:00:00 until it catches up.
let serverClockOffsetMs = 0;

export function setServerClock(serverMs, sentAtMs, receivedAtMs) {
  // Keep the estimate from the fastest round trip seen; it has the least error.
  const rtt = receivedAtMs - sentAtMs;
  if (setServerClock.bestRtt !== undefined && rtt > setServerClock.bestRtt + 50) return;
  setServerClock.bestRtt = Math.min(rtt, setServerClock.bestRtt ?? rtt);
  serverClockOffsetMs = serverMs - (sentAtMs + rtt / 2);
}

export function serverNow() {
  return Date.now() + serverClockOffsetMs;
}

// Tracked time of an entry: start-to-end span minus time spent paused. A
// running entry is measured up to now, or up to the moment it was paused.
export function entryDurationSeconds(entry) {
  const end = entry.end_time || entry.paused_at;
  const endMs = end ? new Date(end).getTime() : serverNow();
  const span = (endMs - new Date(entry.start_time).getTime()) / 1000;
  return Math.max(0, span - (entry.paused_seconds || 0));
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatDurationLong(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m} min ${s} sec`;
  return `${s} sec`;
}

export function formatDurationNoSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} h ${m} min`;
}

export function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dayKey(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function isoDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function toDatetimeLocalValue(iso) {
  // "2026-09-19T01:32:00-04:00" -> "2026-09-19T01:32" (what <input type="datetime-local"> expects)
  return iso.slice(0, 16);
}

export function fromDatetimeLocalValue(localValue, referenceIso) {
  // Re-attach the original timezone offset so the round trip stays consistent
  // with every other timestamp already stored for this entry.
  const match = referenceIso.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset = match ? match[1] : "";
  return `${localValue}:00${offset}`;
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
