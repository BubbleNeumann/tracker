import { api } from "./api.js";
import { state } from "./state.js";
import {
  dayKey,
  entryDurationSeconds,
  escapeHtml,
  formatDuration,
  formatTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "./format.js";
import { PLAY_ICON, TRASH_ICON } from "./icons.js";
import { continueEntry } from "./timer.js";
import { appendAddTagPill, applyTagColor, renderSelectableTagPills } from "./tagPicker.js";

const entriesContainer = document.getElementById("entries-container");

let lastEntries = [];
let editingEntryId = null;
let editBuffer = null;

export function isEditingEntry() {
  return editingEntryId !== null;
}

export async function loadEntries() {
  if (!state.currentProject) {
    lastEntries = [];
    renderEntries();
    return;
  }
  const projectId = state.currentProject.id;
  const entries = await api(`/api/entries?project_id=${projectId}`);
  // The project may have been switched while this request was in flight;
  // a late response must not overwrite the newer project's list.
  if (state.currentProject?.id !== projectId) return;
  lastEntries = entries;
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
    projectId: entry.project_id,
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
    const totalSeconds = dayEntries.reduce((sum, e) => sum + entryDurationSeconds(e), 0);

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
      if (!confirm("Delete this entry?")) return;
      await api(`/api/entries/${btn.dataset.id}`, { method: "DELETE" });
      await loadEntries();
    };
  });
}

function renderViewRow(entry) {
  const seconds = entryDurationSeconds(entry);
  const el = document.createElement("div");
  el.className = "entry";
  el.innerHTML = `
    <div class="entry-main">
      <div class="entry-title">
        <span>${escapeHtml(entry.title)}</span>
      </div>
      <div class="entry-meta">
        <span class="entry-duration">${formatDuration(seconds)}</span>
        <span class="entry-time">${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}</span>
      </div>
    </div>
    <div class="entry-actions">
      <button class="continue-btn" title="Continue this activity">${PLAY_ICON}</button>
      <button class="delete-btn" data-id="${entry.id}" title="Delete entry">${TRASH_ICON}</button>
    </div>
  `;
  // Tags get their own line under the duration/time, and only when there are any.
  const tagsEl = document.createElement("div");
  tagsEl.className = "entry-tags";
  for (const name of entry.tags) {
    const tagEl = document.createElement("span");
    tagEl.className = "entry-tag";
    tagEl.textContent = name;
    const tag = state.allTags.find((t) => t.name === name);
    if (tag) applyTagColor(tagEl, tag.color);
    tagsEl.appendChild(tagEl);
  }
  if (entry.tags.length > 0) el.querySelector(".entry-main").appendChild(tagsEl);
  el.querySelector(".continue-btn").onclick = async (e) => {
    e.stopPropagation();
    try {
      await continueEntry(entry);
    } catch (err) {
      alert(err.message);
    }
  };
  el.onclick = () => startEditing(entry);
  return el;
}

function renderEditRow(entry) {
  const el = document.createElement("div");
  el.className = "entry entry-edit";
  el.onclick = (e) => e.stopPropagation();

  const projectOptions = state.allProjects
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === editBuffer.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`
    )
    .join("");

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
    <div class="edit-row edit-row-project">
      <span class="edit-date-label">Project</span>
      <select class="edit-project-select">${projectOptions}</select>
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
  el.querySelector(".edit-project-select").onchange = async (e) => {
    editBuffer.projectId = Number(e.target.value);
    editBuffer.tags = new Set();
    await reloadTagsAndRerender();
  };

  const tagsContainer = el.querySelector(".edit-row-tags");
  const reloadTagsAndRerender = async () => {
    state.allTags = await api(`/api/tags?project_id=${editBuffer.projectId}`);
    renderEntries();
  };
  renderSelectableTagPills(tagsContainer, state.allTags, editBuffer.tags, renderEntries, reloadTagsAndRerender);
  appendAddTagPill(tagsContainer, editBuffer.projectId, editBuffer.tags, reloadTagsAndRerender);

  el.querySelector(".edit-cancel-btn").onclick = () => stopEditing();
  el.querySelector(".edit-save-btn").onclick = async () => {
    const title = editBuffer.title.trim() || "Untitled";
    // The inputs only show minutes, so resending an untouched value would
    // drop its seconds (and can make a sub-minute entry end <= start).
    const start_time =
      editBuffer.start === toDatetimeLocalValue(editBuffer.startRef)
        ? editBuffer.startRef
        : fromDatetimeLocalValue(editBuffer.start, editBuffer.startRef);
    const end_time =
      editBuffer.end === toDatetimeLocalValue(editBuffer.endRef)
        ? editBuffer.endRef
        : fromDatetimeLocalValue(editBuffer.end, editBuffer.endRef);
    try {
      await api(`/api/entries/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          start_time,
          end_time,
          project_id: editBuffer.projectId,
          tags: Array.from(editBuffer.tags),
        }),
      });
    } catch (err) {
      alert(err.message);
      return;
    }
    editingEntryId = null;
    editBuffer = null;
    await loadEntries();
  };

  return el;
}
