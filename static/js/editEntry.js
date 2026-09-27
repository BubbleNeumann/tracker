import { api } from "./api.js";
import { state } from "./state.js";

const modal = document.getElementById("edit-entry-modal");
const titleInput = document.getElementById("edit-entry-title");
const tagsContainer = document.getElementById("edit-entry-tags");
const cancelBtn = document.getElementById("edit-entry-cancel");
const saveBtn = document.getElementById("edit-entry-save");

let editingEntry = null;
let editTags = new Set();
let onSaved = null;

function renderEditTags() {
  tagsContainer.innerHTML = "";
  for (const tag of state.allTags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill" + (editTags.has(tag.name) ? " selected" : "");
    pill.textContent = tag.name;
    pill.onclick = () => {
      if (editTags.has(tag.name)) editTags.delete(tag.name);
      else editTags.add(tag.name);
      renderEditTags();
    };
    tagsContainer.appendChild(pill);
  }

  const addPill = document.createElement("div");
  addPill.className = "tag-pill add-tag";
  addPill.textContent = "+ New tag";
  addPill.onclick = async () => {
    const name = prompt("New tag name:");
    if (!name || !name.trim()) return;
    const projectId = editingEntry.project_id;
    const tag = await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), project_id: projectId }),
    });
    state.allTags = await api(`/api/tags?project_id=${projectId}`);
    editTags.add(tag.name);
    renderEditTags();
  };
  tagsContainer.appendChild(addPill);
}

export function openEditEntry(entry, onSavedCallback) {
  editingEntry = entry;
  editTags = new Set(entry.tags);
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
    body: JSON.stringify({ title, tags: Array.from(editTags) }),
  });
  modal.classList.add("hidden");
  if (onSaved) await onSaved();
};
