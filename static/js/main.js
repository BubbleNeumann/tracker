import { loadTags } from "./tags.js";
import { loadProjects } from "./projects.js";
import { refreshCurrent } from "./timer.js";
import { loadEntries, isEditingEntry } from "./entries.js";
import "./tabs.js";

const POLL_INTERVAL_MS = 10000;

let refreshInFlight = false;

async function refreshAll({ isPoll = false } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    await loadProjects();
    await loadTags();
    // Don't yank an entry that's mid-edit in this tab out from under the user;
    // the next poll or focus refresh will pick up remote changes once they're done.
    if (!isPoll || !isEditingEntry()) {
      await loadEntries();
    }
    // refreshCurrent() re-renders the tag bar with the freshly loaded tags above.
    await refreshCurrent();
  } finally {
    refreshInFlight = false;
  }
}

async function init() {
  await refreshAll();
  setInterval(() => refreshAll({ isPoll: true }), POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshAll({ isPoll: true });
  });
}

init();
