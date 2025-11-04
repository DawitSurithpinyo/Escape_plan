// /lib/server.js
// Client-side script used by server.html (admin dashboard)

const socket = io("/admin");

const onlineEl   = document.getElementById("online");
const warderEl   = document.getElementById("warder");
const prisonerEl = document.getElementById("prisoner");
const resetBtn   = document.getElementById("resetBtn");

socket.on("connect", () => {
  console.log("[ADMIN] Connected to /admin");
});

socket.on("server:updateOnline", ({ online }) => {
  if (onlineEl) onlineEl.textContent = String(online);
});

socket.on("server:updateScores", ({ scores }) => {
  if (!scores) return;
  if (warderEl)   warderEl.textContent = String(scores.warder ?? 0);
  if (prisonerEl) prisonerEl.textContent = String(scores.prisoner ?? 0);
});

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    console.log("[ADMIN] Reset clicked");
    socket.emit("admin:reset");
  });
}
