import { api } from "./api.js";
import { state } from "./state.js";
import { formatDuration, formatDurationLong, formatDurationNoSeconds, isoDate } from "./format.js";
import { escapeHtml } from "./format.js";

const statsProjectSelect = document.getElementById("stats-project-select");
const statsTotalTime = document.getElementById("stats-total-time");
const statsSessions = document.getElementById("stats-sessions");
const statsLongest = document.getElementById("stats-longest");
const statsLongestLabel = document.getElementById("stats-longest-label");
const tagStatsContainer = document.getElementById("tag-stats-container");
const chartContainer = document.getElementById("chart-container");
const calendarGrid = document.getElementById("calendar-grid");
const calendarMonths = document.getElementById("calendar-months");
const calendarScroll = document.querySelector(".calendar-scroll");
const calendarPrevBtn = document.getElementById("calendar-prev");
const calendarNextBtn = document.getElementById("calendar-next");
const calendarTodayBtn = document.getElementById("calendar-today");

const CALENDAR_HALF_WEEKS = 20;
const CELL_SIZE = 13;
const CELL_GAP = 3;
const COLUMN_WIDTH = CELL_SIZE + CELL_GAP;

export function renderStatsProjectOptions() {
  const previousValue = statsProjectSelect.value || "all";
  statsProjectSelect.innerHTML = '<option value="all">All Projects</option>';
  for (const project of state.allProjects) {
    const opt = document.createElement("option");
    opt.value = project.id;
    opt.textContent = project.name;
    statsProjectSelect.appendChild(opt);
  }
  statsProjectSelect.value = previousValue;
}

const TAG_COLORS = [
  "#3fa9f5",
  "#8a7dff",
  "#ff5c5c",
  "#3ddc84",
  "#c77dff",
  "#ff9f3f",
  "#ffe14d",
  "#ff5cc8",
  "#5ce1e6",
  "#a3ff5c",
];

function tagColor(index) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export async function loadStats() {
  const projectId = statsProjectSelect.value || "all";
  const [totals, daily, byTag] = await Promise.all([
    api(`/api/stats?project_id=${encodeURIComponent(projectId)}`),
    api(`/api/stats/daily?project_id=${encodeURIComponent(projectId)}`),
    api(`/api/stats/by-tag?project_id=${encodeURIComponent(projectId)}`),
  ]);
  statsTotalTime.textContent = formatDurationNoSeconds(totals.total_seconds);
  statsSessions.textContent = totals.sessions;
  statsLongest.textContent = formatDurationLong(totals.longest_seconds);
  statsLongestLabel.textContent = totals.longest_label || "";
  state.dailyStats = daily;
  renderTagStats(byTag, projectId === "all");
  renderChart();
  renderCalendar();
}

function renderTagStats(byTag, groupByProject) {
  tagStatsContainer.innerHTML = "";
  if (byTag.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No tagged time yet.";
    tagStatsContainer.appendChild(empty);
    return;
  }

  const maxSeconds = Math.max(...byTag.map((t) => t.seconds), 1);
  byTag.forEach((tagStat, index) => {
    const color = tagColor(index);
    const row = document.createElement("div");
    row.className = "tag-stat-row";
    const pct = Math.max((tagStat.seconds / maxSeconds) * 100, 2);
    const label = groupByProject
      ? `<span class="tag-stat-project">[${escapeHtml(tagStat.project_name)}]</span> ${escapeHtml(tagStat.tag)}`
      : escapeHtml(tagStat.tag);
    row.innerHTML = `
      <span class="tag-stat-name" style="color:${color}">${label}</span>
      <span class="tag-stat-bar-track">
        <span class="tag-stat-bar-fill" style="width:${pct}%;background:${color}"></span>
      </span>
      <span class="tag-stat-value">${formatDurationLong(tagStat.seconds)}</span>
    `;
    tagStatsContainer.appendChild(row);
  });
}

statsProjectSelect.onchange = loadStats;
calendarPrevBtn.onclick = () => {
  calendarScroll.scrollBy({ left: -COLUMN_WIDTH * 8, behavior: "smooth" });
};
calendarNextBtn.onclick = () => {
  calendarScroll.scrollBy({ left: COLUMN_WIDTH * 8, behavior: "smooth" });
};
calendarTodayBtn.onclick = () => centerCalendarOnToday(true);

function renderChart() {
  const byDate = new Map(state.dailyStats.map((d) => [d.date, d.seconds]));
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    days.push({ date: d, seconds: byDate.get(key) || 0 });
  }

  const maxSeconds = Math.max(...days.map((d) => d.seconds), 1);

  chartContainer.innerHTML = "";
  for (const day of days) {
    const wrap = document.createElement("div");
    wrap.className = "chart-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    const pct = Math.max((day.seconds / maxSeconds) * 100, day.seconds > 0 ? 2 : 0);
    bar.style.height = pct + "%";
    wrap.appendChild(bar);

    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    const label = day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    tooltip.textContent = `${label}: ${formatDuration(day.seconds)}`;
    wrap.appendChild(tooltip);

    chartContainer.appendChild(wrap);
  }
}

function heatLevel(seconds, maxSeconds) {
  if (seconds <= 0 || maxSeconds <= 0) return 0;
  const ratio = seconds / maxSeconds;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function mondayIndex(jsDay) {
  return (jsDay + 6) % 7; // Monday = 0 ... Sunday = 6
}

function renderCalendar() {
  const byDate = new Map(state.dailyStats.map((d) => [d.date, d.seconds]));
  const maxSeconds = Math.max(...state.dailyStats.map((d) => d.seconds), 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - mondayIndex(today.getDay()));

  const rangeStart = new Date(startOfThisWeek);
  rangeStart.setDate(rangeStart.getDate() - CALENDAR_HALF_WEEKS * 7);
  const rangeEnd = new Date(startOfThisWeek);
  rangeEnd.setDate(rangeEnd.getDate() + CALENDAR_HALF_WEEKS * 7 + 6);

  calendarGrid.innerHTML = "";
  calendarMonths.innerHTML = "";

  let columnIndex = -1;
  let lastMonth = null;

  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const weekday = mondayIndex(d.getDay());
    if (weekday === 0) columnIndex++;

    const key = isoDate(d);
    const seconds = byDate.get(key) || 0;
    const level = heatLevel(seconds, maxSeconds);
    const cell = document.createElement("div");
    cell.className = "calendar-cell" + (level > 0 ? ` heat-${level}` : "");
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    cell.dataset.tooltip = `${label}: ${formatDuration(seconds)}`;
    calendarGrid.appendChild(cell);

    const monthKey = d.getFullYear() + "-" + d.getMonth();
    if (weekday === 0 && monthKey !== lastMonth) {
      lastMonth = monthKey;
      const monthLabel = document.createElement("div");
      monthLabel.className = "calendar-month-label";
      monthLabel.style.left = columnIndex * COLUMN_WIDTH + "px";
      monthLabel.textContent = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }).replace(" ", " '");
      calendarMonths.appendChild(monthLabel);
    }
  }

  centerCalendarOnToday();
}

function centerCalendarOnToday(smooth) {
  const target = CALENDAR_HALF_WEEKS * COLUMN_WIDTH - calendarScroll.clientWidth / 2 + COLUMN_WIDTH / 2;
  calendarScroll.scrollTo({ left: Math.max(target, 0), behavior: smooth ? "smooth" : "auto" });
}
