import { api } from "./api.js";
import { state } from "./state.js";

const tagListEl = document.getElementById("tag-list");

export async function loadTags() {
  state.allTags = await api("/api/tags");
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

    const remove = document.createElement("span");
    remove.className = "tag-remove";
    remove.textContent = "×";
    remove.title = "Delete tag";
    remove.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete tag "${tag.name}"? It will be removed from all entries.`)) return;
      await api(`/api/tags/${tag.id}`, { method: "DELETE" });
      state.selectedTags.delete(tag.name);
      await loadTags();
      renderTags();
    };
    pill.appendChild(remove);

    tagListEl.appendChild(pill);
  }

  const addPill = document.createElement("div");
  addPill.className = "tag-pill add-tag";
  addPill.textContent = "+ New tag";
  addPill.onclick = async () => {
    const name = prompt("New tag name:");
    if (!name || !name.trim()) return;
    const tag = await api("/api/tags", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    await loadTags();
    state.selectedTags.add(tag.name);
    renderTags();
  };
  tagListEl.appendChild(addPill);
}
