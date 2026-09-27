import { api } from "./api.js";
import { state } from "./state.js";
import { escapeHtml } from "./format.js";
import { loadEntries } from "./entries.js";
import { refreshCurrent } from "./timer.js";
import { renderStatsProjectOptions } from "./stats.js";
import { loadTags, renderTags } from "./tags.js";
import { PENCIL_ICON } from "./icons.js";

const projectSelector = document.getElementById("project-selector");
const projectDot = document.getElementById("project-dot");
const projectNameEl = document.getElementById("project-name");
const projectDropdown = document.getElementById("project-dropdown");
const newProjectBtn = document.getElementById("new-project-btn");
const newProjectModal = document.getElementById("new-project-modal");
const newProjectName = document.getElementById("new-project-name");
const newProjectColor = document.getElementById("new-project-color");
const newProjectCancel = document.getElementById("new-project-cancel");
const newProjectCreate = document.getElementById("new-project-create");

export async function loadProjects() {
  state.allProjects = await api("/api/projects");
  if (!state.currentProject && state.allProjects.length > 0) {
    state.currentProject = state.allProjects[0];
  }
  renderProjectSelector();
  renderStatsProjectOptions();
}

function renderProjectSelector() {
  if (state.currentProject) {
    projectDot.style.color = state.currentProject.color;
    projectDot.style.background = state.currentProject.color;
    projectNameEl.textContent = state.currentProject.name;
  } else {
    projectNameEl.textContent = "No project";
  }

  projectDropdown.innerHTML = "";
  for (const project of state.allProjects) {
    const opt = document.createElement("div");
    opt.className = "project-option";
    opt.innerHTML = `
      <span class="project-dot" style="background:${project.color};color:${project.color}"></span>
      <span>${escapeHtml(project.name)}</span>
      <span class="project-option-delete" data-id="${project.id}" title="Rename or delete project">${PENCIL_ICON}</span>
    `;
    opt.querySelector("span:nth-child(2)").onclick = async () => {
      state.currentProject = project;
      projectDropdown.classList.add("hidden");
      renderProjectSelector();
      renderStatsProjectOptions();
      state.selectedTags = new Set();
      await loadTags();
      renderTags();
      await loadEntries();
      await refreshCurrent();
    };
    opt.querySelector(".project-option-delete").onclick = async (e) => {
      e.stopPropagation();
      const newName = prompt("Rename project (leave blank to delete):", project.name);
      if (newName === null) return;
      if (!newName.trim()) {
        if (!confirm(`Delete project "${project.name}"? This deletes its time entries too.`)) return;
        await api(`/api/projects/${project.id}`, { method: "DELETE" });
        if (state.currentProject && state.currentProject.id === project.id) state.currentProject = null;
      } else if (newName.trim() !== project.name) {
        const updated = await api(`/api/projects/${project.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: newName.trim() }),
        });
        if (state.currentProject && state.currentProject.id === project.id) {
          state.currentProject = updated;
        }
      }
      await loadProjects();
      state.selectedTags = new Set();
      await loadTags();
      renderTags();
      await loadEntries();
      await refreshCurrent();
    };
    projectDropdown.appendChild(opt);
  }
}

projectSelector.onclick = () => {
  projectDropdown.classList.toggle("hidden");
};

document.addEventListener("click", (e) => {
  if (!projectSelector.contains(e.target) && !projectDropdown.contains(e.target)) {
    projectDropdown.classList.add("hidden");
  }
});

newProjectBtn.onclick = () => {
  newProjectName.value = "";
  newProjectColor.value = "#7cff2e";
  newProjectModal.classList.remove("hidden");
};

newProjectCancel.onclick = () => newProjectModal.classList.add("hidden");

newProjectCreate.onclick = async () => {
  const name = newProjectName.value.trim();
  if (!name) return;
  const project = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, color: newProjectColor.value }),
  });
  newProjectModal.classList.add("hidden");
  state.currentProject = project;
  await loadProjects();
  state.selectedTags = new Set();
  await loadTags();
  renderTags();
  await loadEntries();
  await refreshCurrent();
};
