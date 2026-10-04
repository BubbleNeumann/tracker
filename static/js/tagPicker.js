import { api } from "./api.js";
import { PENCIL_ICON } from "./icons.js";

// Renders a toggleable "+ New tag" pill into `container`. Clicking it prompts
// for a name, creates the tag under `projectId`, adds it to `selectedTags`,
// and calls `rerender` so the caller can redraw with the new tag included.
const tagModal = document.getElementById("edit-tag-modal");
const tagNameInput = document.getElementById("edit-tag-name");
const tagColorInput = document.getElementById("edit-tag-color");
const tagColorClear = document.getElementById("edit-tag-color-clear");
const tagDeleteBtn = document.getElementById("edit-tag-delete");
const tagCancelBtn = document.getElementById("edit-tag-cancel");
const tagSaveBtn = document.getElementById("edit-tag-save");

let editingTag = null;
let tagColorCleared = false;
let onTagModalDone = null;

function openTagModal(tag, onDone) {
  editingTag = tag;
  onTagModalDone = onDone;
  tagNameInput.value = tag.name;
  tagColorCleared = !tag.color;
  tagColorInput.value = tag.color || "#4a9eff";
  tagModal.classList.remove("hidden");
}

tagColorInput.oninput = () => { tagColorCleared = false; };
tagColorClear.onclick = () => { tagColorCleared = true; tagColorInput.value = "#4a9eff"; };
tagCancelBtn.onclick = () => tagModal.classList.add("hidden");

tagSaveBtn.onclick = async () => {
  const name = tagNameInput.value.trim();
  if (!editingTag || !name) return;
  await api(`/api/tags/${editingTag.id}`, {
    method: "PUT",
    body: JSON.stringify({ name, color: tagColorCleared ? "" : tagColorInput.value }),
  });
  tagModal.classList.add("hidden");
  await onTagModalDone({ renamedTo: name !== editingTag.name ? name : null });
};

tagDeleteBtn.onclick = async () => {
  if (!editingTag) return;
  if (!confirm(`Delete tag "${editingTag.name}"? It will be removed from all entries.`)) return;
  await api(`/api/tags/${editingTag.id}`, { method: "DELETE" });
  tagModal.classList.add("hidden");
  await onTagModalDone({ deleted: true });
};

export function applyTagColor(el, color) {
  if (!color) return;
  el.style.setProperty("--tag-border", color);
  el.style.setProperty("--tag-text", color);
}

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
// the tag be renamed, recolored or deleted. After such a
// change, `selectedTags` is updated to match and `onTagsChanged` is called
// so the caller can reload its tag list and redraw.
export function renderSelectableTagPills(container, allTags, selectedTags, rerender, onTagsChanged) {
  for (const tag of allTags) {
    const pill = document.createElement("div");
    pill.className = "tag-pill" + (selectedTags.has(tag.name) ? " selected" : "");
    applyTagColor(pill, tag.color);

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
      edit.title = "Edit tag";
      edit.onclick = (e) => {
        e.stopPropagation();
        openTagModal(tag, async ({ renamedTo, deleted }) => {
          if (deleted) selectedTags.delete(tag.name);
          else if (renamedTo && selectedTags.has(tag.name)) {
            selectedTags.delete(tag.name);
            selectedTags.add(renamedTo);
          }
          await onTagsChanged();
        });
      };
      pill.appendChild(edit);
    }

    container.appendChild(pill);
  }
}
