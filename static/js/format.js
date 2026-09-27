export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
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
