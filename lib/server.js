// lib/server.js
export default function setupServer(io) {}

const socket = io("/admin");

const onlineEl = document.getElementById("online");
const warderEl = document.getElementById("warder");
const prisonerEl = document.getElementById("prisoner");
const resetBtn = document.getElementById("resetBtn");
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'app/index.html'));
});

// Serve game.html on /game
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'app/game.html'));
});

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
