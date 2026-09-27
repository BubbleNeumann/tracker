import { api } from "./api.js";
import { state } from "./state.js";
import {
  dayKey,
  escapeHtml,
  formatDuration,
  formatTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "./format.js";
import { PENCIL_ICON, TRASH_ICON } from "./icons.js";
import { appendAddTagPill, renderSelectableTagPills } from "./tagPicker.js";

const entriesContainer = document.getElementById("entries-container");

let lastEntries = [];
let editingEntryId = null;
let editBuffer = null;

export async function loadEntries() {
  if (!state.currentProject) {
    lastEntries = [];
    renderEntries();
    return;
  }
  lastEntries = await api(`/api/entries?project_id=${state.currentProject.id}`);
  renderEntries();
}

function startEditing(entry) {
  editingEntryId = entry.id;
  editBuffer = {
    title: entry.title,
    start: toDatetimeLocalValue(entry.start_time),
    end: toDatetimeLocalValue(entry.end_time),
    startRef: entry.start_time,
    endRef: entry.end_time,
    tags: new Set(entry.tags),
  };
  renderEntries();
}

function stopEditing() {
  editingEntryId = null;
  editBuffer = null;
  renderEntries();
}

function renderEntries() {
  entriesContainer.innerHTML = "";
  if (lastEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No entries yet. Start a timer above.";
    entriesContainer.appendChild(empty);
    return;
  }

  const groups = new Map();
  for (const entry of lastEntries) {
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
      const el =
        entry.id === editingEntryId ? renderEditRow(entry) : renderViewRow(entry);
      group.appendChild(el);
    }

    entriesContainer.appendChild(group);
  }

  entriesContainer.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await api(`/api/entries/${btn.dataset.id}`, { method: "DELETE" });
      await loadEntries();
    };
  });
}

function renderViewRow(entry) {
  const seconds = (new Date(entry.end_time) - new Date(entry.start_time)) / 1000;
  const el = document.createElement("div");
  el.className = "entry";
  el.innerHTML = `
    <div class="entry-title">
      <span>${escapeHtml(entry.title)}</span>
      <span class="entry-title-actions">
        <button class="edit-entry-btn" title="Edit entry">${PENCIL_ICON}</button>
        <button class="delete-btn" data-id="${entry.id}" title="Delete entry">${TRASH_ICON}</button>
      </span>
    </div>
    <div class="entry-meta">
      <span class="entry-duration">${formatDuration(seconds)}</span>
      <span class="entry-time">${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}</span>
      ${entry.tags.map((t) => `<span class="entry-tag">${escapeHtml(t)}</span>`).join("")}
    </div>
  `;
  el.onclick = () => startEditing(entry);
  el.querySelector(".edit-entry-btn").onclick = (e) => {
    e.stopPropagation();
    startEditing(entry);
  };
  return el;
}

function renderEditRow(entry) {
  const el = document.createElement("div");
  el.className = "entry entry-edit";
  el.onclick = (e) => e.stopPropagation();

  el.innerHTML = `
    <input type="text" class="edit-title-input" value="${escapeHtml(editBuffer.title)}" />
    <button class="btn-start edit-save-btn">Save</button>
    <button class="btn-link edit-cancel-btn">Cancel</button>
    <div class="edit-row edit-row-dates">
      <div class="edit-date-group">
        <span class="edit-date-label">Start</span>
        <input type="datetime-local" class="edit-start-input" value="${editBuffer.start}" />
      </div>
      <span class="edit-date-sep">–</span>
      <div class="edit-date-group">
        <span class="edit-date-label">End</span>
        <input type="datetime-local" class="edit-end-input" value="${editBuffer.end}" />
      </div>
    </div>
    <div class="tag-list edit-row-tags"></div>
  `;

  el.querySelector(".edit-title-input").oninput = (e) => {
    editBuffer.title = e.target.value;
  };
  el.querySelector(".edit-start-input").oninput = (e) => {
    editBuffer.start = e.target.value;
  };
  el.querySelector(".edit-end-input").oninput = (e) => {
    editBuffer.end = e.target.value;
  };

  const tagsContainer = el.querySelector(".edit-row-tags");
  const reloadTagsAndRerender = async () => {
    state.allTags = await api(`/api/tags?project_id=${entry.project_id}`);
    renderEntries();
  };
  renderSelectableTagPills(tagsContainer, state.allTags, editBuffer.tags, renderEntries, reloadTagsAndRerender);
  appendAddTagPill(tagsContainer, entry.project_id, editBuffer.tags, reloadTagsAndRerender);

  el.querySelector(".edit-cancel-btn").onclick = () => stopEditing();
  el.querySelector(".edit-save-btn").onclick = async () => {
    const title = editBuffer.title.trim() || "Untitled";
    const start_time = fromDatetimeLocalValue(editBuffer.start, editBuffer.startRef);
    const end_time = fromDatetimeLocalValue(editBuffer.end, editBuffer.endRef);
    await api(`/api/entries/${entry.id}`, {
      method: "PUT",
      body: JSON.stringify({ title, start_time, end_time, tags: Array.from(editBuffer.tags) }),
    });
    editingEntryId = null;
    editBuffer = null;
    await loadEntries();
  };

  return el;
}
