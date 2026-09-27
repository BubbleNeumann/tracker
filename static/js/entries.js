import { api } from "./api.js";
import { state } from "./state.js";
import { dayKey, escapeHtml, formatDuration, formatTime } from "./format.js";

const entriesContainer = document.getElementById("entries-container");

export async function loadEntries() {
  if (!state.currentProject) {
    renderEntries([]);
    return;
  }
  const entries = await api(`/api/entries?project_id=${state.currentProject.id}`);
  renderEntries(entries);
}

function renderEntries(entries) {
  entriesContainer.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No entries yet. Start a timer above.";
    entriesContainer.appendChild(empty);
    return;
  }

  const groups = new Map();
  for (const entry of entries) {
    const key = dayKey(entry.start_time);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const [day, dayEntries] of groups) {
    const totalSeconds = dayEntries.reduce((sum, e) => {
      return sum + (new Date(e.end_time) - new Date(e.start_time)) / 1000;
    }, 0);

    const group = document.createElement("div");
    group.className = "day-group";

    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `<span>${day}</span><span class="total">${formatDuration(totalSeconds)}</span>`;
    group.appendChild(header);

    for (const entry of dayEntries) {
      const seconds = (new Date(entry.end_time) - new Date(entry.start_time)) / 1000;
      const el = document.createElement("div");
      el.className = "entry";
      el.innerHTML = `
        <div class="entry-title">
          <span>${escapeHtml(entry.title)}</span>
          <button class="delete-btn" data-id="${entry.id}">delete</button>
        </div>
        <div class="entry-meta">
          <span class="entry-duration">${formatDuration(seconds)}</span>
          <span class="entry-time">${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}</span>
          ${entry.tags.map((t) => `<span class="entry-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      `;
      group.appendChild(el);
    }

    entriesContainer.appendChild(group);
  }

  entriesContainer.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/entries/${btn.dataset.id}`, { method: "DELETE" });
      await loadEntries();
    };
  });
}
