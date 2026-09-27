import { api } from "./api.js";
import { state } from "./state.js";
import { PENCIL_ICON } from "./icons.js";

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
  for (const tag of state.allTags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill" + (state.selectedTags.has(tag.name) ? " selected" : "");

    const label = document.createElement("span");
    label.textContent = tag.name;
    label.onclick = () => {
      if (state.selectedTags.has(tag.name)) state.selectedTags.delete(tag.name);
      else state.selectedTags.add(tag.name);
      renderTags();
    };
    pill.appendChild(label);

    const edit = document.createElement("span");
    edit.className = "tag-remove";
    edit.innerHTML = PENCIL_ICON;
    edit.title = "Rename or delete tag";
    edit.onclick = async (e) => {
      e.stopPropagation();
      const newName = prompt("Rename tag (leave blank to delete):", tag.name);
      if (newName === null) return;
      if (!newName.trim()) {
        if (!confirm(`Delete tag "${tag.name}"? It will be removed from all entries.`)) return;
        await api(`/api/tags/${tag.id}`, { method: "DELETE" });
        state.selectedTags.delete(tag.name);
      } else if (newName.trim() !== tag.name) {
        await api(`/api/tags/${tag.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (state.selectedTags.has(tag.name)) {
          state.selectedTags.delete(tag.name);
          state.selectedTags.add(newName.trim());
        }
      }
      await loadTags();
      renderTags();
    };
    pill.appendChild(edit);

    tagListEl.appendChild(pill);
  }

  const addPill = document.createElement("div");
  addPill.className = "tag-pill add-tag";
  addPill.textContent = "+ New tag";
  addPill.onclick = async () => {
    const name = prompt("New tag name:");
    if (!name || !name.trim()) return;
    const tag = await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), project_id: state.currentProject.id }),
    });
    await loadTags();
    state.selectedTags.add(tag.name);
    renderTags();
  };
  tagListEl.appendChild(addPill);
}
