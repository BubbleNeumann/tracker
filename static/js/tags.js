import { api } from "./api.js";
import { state } from "./state.js";
import { loadEntries } from "./entries.js";
import { appendAddTagPill, renderSelectableTagPills } from "./tagPicker.js";

const tagListEl = document.getElementById("tag-list");

export async function loadTags() {
  if (!state.currentProject) {
    state.allTags = [];
    return;
  }
  const projectId = state.currentProject.id;
  const tags = await api(`/api/tags?project_id=${projectId}`);
  // Ignore a late response for a project the user has already switched away from.
  if (state.currentProject?.id !== projectId) return;
  state.allTags = tags;
}

export function renderTags() {
  tagListEl.innerHTML = "";
  renderSelectableTagPills(tagListEl, state.allTags, state.selectedTags, renderTags, async () => {
    await loadTags();
    renderTags();
    await loadEntries();
  });
  appendAddTagPill(tagListEl, state.currentProject.id, state.selectedTags, async () => {
    await loadTags();
    renderTags();
  });
}
