import { api } from "./api.js";
import { state } from "./state.js";
import { appendAddTagPill, renderSelectableTagPills } from "./tagPicker.js";

const modal = document.getElementById("edit-entry-modal");
const titleInput = document.getElementById("edit-entry-title");
const tagsContainer = document.getElementById("edit-entry-tags");
const cancelBtn = document.getElementById("edit-entry-cancel");
const saveBtn = document.getElementById("edit-entry-save");

let editingEntry = null;
let editTags = new Set();
let onSaved = null;

async function reloadTagsAndRerender() {
  state.allTags = await api(`/api/tags?project_id=${editingEntry.project_id}`);
  renderEditTags();
}

function renderEditTags() {
  tagsContainer.innerHTML = "";
  renderSelectableTagPills(tagsContainer, state.allTags, editTags, renderEditTags, reloadTagsAndRerender);
  appendAddTagPill(tagsContainer, editingEntry.project_id, editTags, reloadTagsAndRerender);
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
