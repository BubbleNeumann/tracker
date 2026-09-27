import { api } from "./api.js";
import { PENCIL_ICON } from "./icons.js";

// Renders a toggleable "+ New tag" pill into `container`. Clicking it prompts
// for a name, creates the tag under `projectId`, adds it to `selectedTags`,
// and calls `rerender` so the caller can redraw with the new tag included.
export function appendAddTagPill(container, projectId, selectedTags, rerender) {
  const addPill = document.createElement("div");
  addPill.className = "tag-pill add-tag";
  addPill.textContent = "+ New tag";
  addPill.onclick = async () => {
    const name = prompt("New tag name:");
    if (!name || !name.trim()) return;
    const tag = await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), project_id: projectId }),
    });
    selectedTags.add(tag.name);
    await rerender();
  };
  container.appendChild(addPill);
}

// Renders one toggleable pill per tag in `allTags`, reflecting membership in
// `selectedTags`, calling `rerender` after each toggle.
//
// If `onTagsChanged` is provided, each pill also gets a pencil icon that lets
// the tag be renamed or deleted outright (blank name = delete). After such a
// change, `selectedTags` is updated to match and `onTagsChanged` is called
// so the caller can reload its tag list and redraw.
export function renderSelectableTagPills(container, allTags, selectedTags, rerender, onTagsChanged) {
  for (const tag of allTags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill" + (selectedTags.has(tag.name) ? " selected" : "");

    const label = document.createElement("span");
    label.textContent = tag.name;
    label.onclick = () => {
      if (selectedTags.has(tag.name)) selectedTags.delete(tag.name);
      else selectedTags.add(tag.name);
      rerender();
    };
    pill.appendChild(label);

    if (onTagsChanged) {
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
          selectedTags.delete(tag.name);
        } else if (newName.trim() !== tag.name) {
          await api(`/api/tags/${tag.id}`, {
            method: "PUT",
            body: JSON.stringify({ name: newName.trim() }),
          });
          if (selectedTags.has(tag.name)) {
            selectedTags.delete(tag.name);
            selectedTags.add(newName.trim());
          }
        }
        await onTagsChanged();
      };
      pill.appendChild(edit);
    }

    container.appendChild(pill);
  }
}
