import { api } from "./api.js";
import { state } from "./state.js";
import { escapeHtml } from "./format.js";
import { loadEntries } from "./entries.js";
import { refreshCurrent, clearTitleInput } from "./timer.js";
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
const newProjectTitle = document.getElementById("new-project-title");
const projectDeleteBtn = document.getElementById("project-delete");
const newProjectCancel = document.getElementById("new-project-cancel");
const newProjectCreate = document.getElementById("new-project-create");

export async function switchToProject(project) {
  state.currentProject = project;
  clearTitleInput();
  renderProjectSelector();
  renderStatsProjectOptions();
  state.selectedTags = new Set();
  await loadTags();
  renderTags();
  await loadEntries();
  await refreshCurrent();
}

document.addEventListener("switch-project", (e) => switchToProject(e.detail));

export async function loadProjects() {
  state.allProjects = await api("/api/projects");
  if (state.currentProject) {
    // Reflect a rename/delete made from another tab or device.
    state.currentProject =
      state.allProjects.find((p) => p.id === state.currentProject.id) || null;
  }
  if (!state.currentProject && state.allProjects.length > 0) {
    state.currentProject = state.allProjects[0];
  }
  renderProjectSelector();
  renderStatsProjectOptions();
}

function renderProjectSelector() {
  renderProjectHeader();
  // Rebuilding the list while it's open (e.g. from the background poll) can
  // swap the row out between mousedown and mouseup, which drops the click.
  // It's rebuilt from fresh data every time the dropdown is opened instead.
  if (!projectDropdown.classList.contains("hidden")) return;
  renderProjectDropdown();
}

function renderProjectHeader() {
  if (state.currentProject) {
    projectDot.style.color = state.currentProject.color;
    projectDot.style.background = state.currentProject.color;
    projectNameEl.textContent = state.currentProject.name;
  } else {
    projectNameEl.textContent = "No project";
  }
}

function renderProjectDropdown() {
  projectDropdown.innerHTML = "";
  for (const project of state.allProjects) {
    const opt = document.createElement("div");
    opt.className = "project-option";
    opt.innerHTML = `
      <span class="project-dot" style="background:${project.color};color:${project.color}"></span>
      <span>${escapeHtml(project.name)}</span>
      <span class="project-option-delete" data-id="${project.id}" title="Edit project">${PENCIL_ICON}</span>
    `;
    // The whole row is the click target, not just the name text.
    opt.onclick = async () => {
      projectDropdown.classList.add("hidden");
      await switchToProject(project);
    };
    opt.querySelector(".project-option-delete").onclick = (e) => {
      e.stopPropagation();
      openProjectModal(project);
    };
    projectDropdown.appendChild(opt);
  }
}

projectSelector.onclick = () => {
  if (projectDropdown.classList.contains("hidden")) renderProjectDropdown();
  projectDropdown.classList.toggle("hidden");
};

document.addEventListener("click", (e) => {
  if (!projectSelector.contains(e.target) && !projectDropdown.contains(e.target)) {
    projectDropdown.classList.add("hidden");
  }
});

let editingProject = null;

function openProjectModal(project) {
  editingProject = project;
  newProjectTitle.textContent = project ? "Edit Project" : "New Project";
  newProjectCreate.textContent = project ? "Save" : "Create";
  projectDeleteBtn.classList.toggle("hidden", !project);
  newProjectName.value = project ? project.name : "";
  newProjectColor.value = project ? project.color : "#7cff2e";
  newProjectModal.classList.remove("hidden");
}

async function refreshAfterProjectChange() {
  await loadProjects();
  clearTitleInput();
  state.selectedTags = new Set();
  await loadTags();
  renderTags();
  await loadEntries();
  await refreshCurrent();
}

newProjectBtn.onclick = () => openProjectModal(null);

newProjectCancel.onclick = () => newProjectModal.classList.add("hidden");

projectDeleteBtn.onclick = async () => {
  const project = editingProject;
  if (!project) return;
  if (!confirm(`Delete project "${project.name}"? This deletes its time entries too.`)) return;
  await api(`/api/projects/${project.id}`, { method: "DELETE" });
  if (state.currentProject && state.currentProject.id === project.id) state.currentProject = null;
  newProjectModal.classList.add("hidden");
  await refreshAfterProjectChange();
};

newProjectCreate.onclick = async () => {
  const name = newProjectName.value.trim();
  if (!name) return;
  if (editingProject) {
    const updated = await api(`/api/projects/${editingProject.id}`, {
      method: "PUT",
      body: JSON.stringify({ name, color: newProjectColor.value }),
    });
    if (state.currentProject && state.currentProject.id === updated.id) {
      state.currentProject = updated;
    }
    newProjectModal.classList.add("hidden");
    await refreshAfterProjectChange();
    return;
  }
  const project = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, color: newProjectColor.value }),
  });
  newProjectModal.classList.add("hidden");
  state.currentProject = project;
  await refreshAfterProjectChange();
};
