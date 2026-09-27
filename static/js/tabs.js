import { loadStats } from "./stats.js";

const tabBtns = document.querySelectorAll(".tab-btn");
const timerView = document.getElementById("timer-view");
const statsView = document.getElementById("stats-view");

tabBtns.forEach((btn) => {
  btn.onclick = async () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "timer") {
      timerView.classList.remove("hidden");
      statsView.classList.add("hidden");
    } else {
      timerView.classList.add("hidden");
      statsView.classList.remove("hidden");
      await loadStats();
    }
  };
});
