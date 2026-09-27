import { loadTags } from "./tags.js";
import { loadProjects } from "./projects.js";
import { refreshCurrent } from "./timer.js";
import { loadEntries } from "./entries.js";
import "./tabs.js";

async function init() {
  await loadProjects();
  await loadTags();
  await refreshCurrent();
  await loadEntries();
}

init();
