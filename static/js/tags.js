import { api } from "./api.js";
import { state } from "./state.js";
import { appendAddTagPill, renderSelectableTagPills } from "./tagPicker.js";

const tagListEl = document.getElementById("tag-list");

export async function loadTags() {
  if (!state.currentProject) {
    state.allTags = [];
    return;
  }
  state.allTags = await api(`/api/tags?project_id=${state.currentProject.id}`);
}

export function renderTags() {
  tagListEl.innerHTML = "";
  renderSelectableTagPills(tagListEl, state.allTags, state.selectedTags, renderTags, async () => {
    await loadTags();
    renderTags();
  });
  appendAddTagPill(tagListEl, state.currentProject.id, state.selectedTags, async () => {
    await loadTags();
    renderTags();
  });
}
