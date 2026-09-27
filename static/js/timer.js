import { api } from "./api.js";
import { state } from "./state.js";
import { escapeHtml, formatDuration } from "./format.js";
import { renderTags } from "./tags.js";
import { loadEntries } from "./entries.js";
import { openEditEntry } from "./editEntry.js";

const titleInput = document.getElementById("title-input");
const startStopBtn = document.getElementById("start-stop-btn");
const idleCard = document.getElementById("idle-card");
const runningWidget = document.getElementById("running-widget");
const runningTitle = document.getElementById("running-title");
const runningElapsed = document.getElementById("running-elapsed");
const runningTags = document.getElementById("running-tags");
const bigStopBtn = document.getElementById("big-stop-btn");
const otherRunningContainer = document.getElementById("other-running-timers");

export function clearTitleInput() {
  titleInput.value = "";
}

function updateStartStopUI() {
  if (state.runningEntry) {
    idleCard.classList.add("hidden");
    runningWidget.classList.remove("hidden");
    runningTitle.textContent = state.runningEntry.title;
    runningTags.innerHTML = state.runningEntry.tags
      .map((t) => `<span class="entry-tag">${escapeHtml(t)}</span>`)
      .join("");
    state.selectedTags = new Set(state.runningEntry.tags);
  } else {
    idleCard.classList.remove("hidden");
    runningWidget.classList.add("hidden");
    startStopBtn.textContent = "Start";
    startStopBtn.className = "btn-start";
    titleInput.disabled = false;
  }
  renderTags();
  renderOtherRunning();
}

function tickElapsed() {
  if (!state.runningEntry) return;
  const seconds = (Date.now() - new Date(state.runningEntry.start_time).getTime()) / 1000;
  runningElapsed.textContent = formatDuration(Math.max(0, seconds));
}

function tickOtherRunning() {
  if (!otherRunningContainer) return;
  otherRunningContainer.querySelectorAll("[data-start]").forEach((el) => {
    const seconds = (Date.now() - new Date(el.dataset.start).getTime()) / 1000;
    el.textContent = formatDuration(Math.max(0, seconds));
  });
}

function renderOtherRunning() {
  if (!otherRunningContainer) return;

  if (state.runningEntries.length === 0) {
    otherRunningContainer.innerHTML = "";
    otherRunningContainer.classList.add("hidden");
    return;
  }

  otherRunningContainer.classList.remove("hidden");
  otherRunningContainer.innerHTML = state.runningEntries
    .map((entry) => {
      const project = state.allProjects.find((p) => p.id === entry.project_id);
      const name = project ? escapeHtml(project.name) : "Unknown project";
      const color = project ? project.color : "#888";
      const isCurrent = state.currentProject && entry.project_id === state.currentProject.id;
      return `
        <div class="other-running-item${isCurrent ? " is-current" : ""}" data-project-id="${entry.project_id}" title="${name}">
          <span class="project-dot" style="background:${color};color:${color}"></span>
          <span class="other-running-name">${escapeHtml(entry.title)}</span>
          <span class="other-running-elapsed" data-start="${entry.start_time}">00:00:00</span>
        </div>
      `;
    })
    .join("");
  tickOtherRunning();
}

export async function refreshRunningEntries() {
  state.runningEntries = await api("/api/timer/running");
}

export async function refreshCurrent() {
  await refreshRunningEntries();
  state.runningEntry = state.currentProject
    ? state.runningEntries.find((e) => e.project_id === state.currentProject.id) || null
    : null;
  updateStartStopUI();
  if (state.tickTimer) clearInterval(state.tickTimer);
  if (state.otherTickTimer) clearInterval(state.otherTickTimer);
  if (state.runningEntry) {
    tickElapsed();
    state.tickTimer = setInterval(tickElapsed, 1000);
  }
  state.otherTickTimer = setInterval(tickOtherRunning, 1000);
}

async function stopTimer() {
  if (!state.currentProject) return;
  await api(`/api/timer/stop?project_id=${state.currentProject.id}`, { method: "POST" });
  state.runningEntry = null;
  state.selectedTags = new Set();
  if (state.tickTimer) clearInterval(state.tickTimer);
  await refreshRunningEntries();
  updateStartStopUI();
  titleInput.value = "";
  await loadEntries();
}

async function startTimer() {
  if (!state.currentProject) {
    alert("Create a project first.");
    return;
  }
  const title = titleInput.value.trim() || "Untitled";
  state.runningEntry = await api("/api/timer/start", {
    method: "POST",
    body: JSON.stringify({ title, project_id: state.currentProject.id, tags: Array.from(state.selectedTags) }),
  });
  await refreshRunningEntries();
  updateStartStopUI();
  tickElapsed();
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = setInterval(tickElapsed, 1000);
}

startStopBtn.onclick = () => (state.runningEntry ? stopTimer() : startTimer());
bigStopBtn.onclick = (e) => {
  e.stopPropagation();
  stopTimer();
};

runningWidget.onclick = () => {
  if (state.runningEntry) openEditEntry(state.runningEntry, refreshCurrent);
};

if (otherRunningContainer) {
  otherRunningContainer.onclick = (e) => {
    const item = e.target.closest(".other-running-item");
    if (!item || item.classList.contains("is-current")) return;
    const projectId = Number(item.dataset.projectId);
    const project = state.allProjects.find((p) => p.id === projectId);
    if (project) {
      document.dispatchEvent(new CustomEvent("switch-project", { detail: project }));
    }
  };
}
