// lib/server.js
export default function setupServer(io) {}

const socket = io("/admin");

const onlineEl = document.getElementById("online");
const warderEl = document.getElementById("warder");
const prisonerEl = document.getElementById("prisoner");
const resetBtn = document.getElementById("resetBtn");

socket.on("connect", () => {
  console.log("Connected to admin dashboard");
});

socket.on("server:updateOnline", ({ online }) => {
  onlineEl.textContent = online;
});

socket.on("server:updateScores", ({ scores }) => {
  warderEl.textContent = scores.warder;
  prisonerEl.textContent = scores.prisoner;
});

resetBtn.addEventListener("click", () => {
  socket.emit("admin:reset");
});
