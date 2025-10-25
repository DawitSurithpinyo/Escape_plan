// lib/server.js
export default function setupServer(io) {
  const adminNS = io.of("/admin");

  adminNS.on("connection", (socket) => {
    console.log("Admin connected:", socket.id);

    socket.on("admin:reset", () => {
      console.log("Admin pressed reset!");
      // reset everyone's score
      io.emit("server:updateScores", { scores: { warder: 0, prisoner: 0 } });
      // kick everyone back to home page
      io.emit("reset:all");
    });
  });
}

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
  // make the admin page also go back to home
  window.location.href = "/";
});
