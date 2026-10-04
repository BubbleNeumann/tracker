import { api } from "./api.js";
import { state } from "./state.js";
import { appendAddTagPill, renderSelectableTagPills } from "./tagPicker.js";

const modal = document.getElementById("edit-entry-modal");
const titleInput = document.getElementById("edit-entry-title");
const projectSelect = document.getElementById("edit-entry-project");
const tagsContainer = document.getElementById("edit-entry-tags");
const cancelBtn = document.getElementById("edit-entry-cancel");
const saveBtn = document.getElementById("edit-entry-save");

let editingEntry = null;
let editProjectId = null;
let editTags = new Set();
let onSaved = null;

async function reloadTagsAndRerender() {
  state.allTags = await api(`/api/tags?project_id=${editProjectId}`);
  renderEditTags();
}

function renderEditTags() {
  tagsContainer.innerHTML = "";
  renderSelectableTagPills(tagsContainer, state.allTags, editTags, renderEditTags, reloadTagsAndRerender);
  appendAddTagPill(tagsContainer, editProjectId, editTags, reloadTagsAndRerender);
}

projectSelect.onchange = async () => {
  editProjectId = Number(projectSelect.value);
  editTags = new Set();
  await reloadTagsAndRerender();
};

export function openEditEntry(entry, onSavedCallback) {
  editingEntry = entry;
  editTags = new Set(entry.tags);
  editProjectId = entry.project_id;
  // A project can only have one running timer, so hide projects that already have another.
  const busy = new Set(
    (state.runningEntries || []).filter((e) => e.id !== entry.id).map((e) => e.project_id)
  );
  projectSelect.innerHTML = "";
  for (const p of state.allProjects) {
    if (busy.has(p.id)) continue;
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    opt.selected = p.id === entry.project_id;
    projectSelect.appendChild(opt);
  }
  onSaved = onSavedCallback;
  titleInput.value = entry.title;
  renderEditTags();
  modal.classList.remove("hidden");
}

cancelBtn.onclick = () => modal.classList.add("hidden");

saveBtn.onclick = async () => {
  if (!editingEntry) return;
  const title = titleInput.value.trim() || "Untitled";
  await api(`/api/entries/${editingEntry.id}`, {
    method: "PUT",
    body: JSON.stringify({ title, project_id: editProjectId, tags: Array.from(editTags) }),
  });
  modal.classList.add("hidden");
  if (onSaved) await onSaved();
};
