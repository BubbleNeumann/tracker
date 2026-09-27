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
    titleInput.value = "";
  }
  renderTags();
}

function tickElapsed() {
  if (!state.runningEntry) return;
  const seconds = (Date.now() - new Date(state.runningEntry.start_time).getTime()) / 1000;
  runningElapsed.textContent = formatDuration(Math.max(0, seconds));
}

export async function refreshCurrent() {
  state.runningEntry = await api("/api/timer/current");
  updateStartStopUI();
  if (state.tickTimer) clearInterval(state.tickTimer);
  if (state.runningEntry) {
    tickElapsed();
    state.tickTimer = setInterval(tickElapsed, 1000);
  }
}

async function stopTimer() {
  await api("/api/timer/stop", { method: "POST" });
  state.runningEntry = null;
  state.selectedTags = new Set();
  if (state.tickTimer) clearInterval(state.tickTimer);
  updateStartStopUI();
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
