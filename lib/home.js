// lib/home.js (or wherever this file is)
const state = { online: 0, scores: { warder: 0, prisoner: 0 } };

// setup admin namespace for server.html dashboard
function initAdmin(io) {
  const adminNS = io.of("/admin");

  const pushAdmin = (target = null) => {
    const t = target || adminNS;
    t.emit("server:updateOnline", { online: state.online });
    t.emit("server:updateScores", { scores: state.scores });
  };

  adminNS.on("connection", (socket) => {
    pushAdmin(socket);
    socket.on("admin:reset", () => {
      state.scores = { warder: 0, prisoner: 0 };
      pushAdmin();

      // ✅ added: tell everyone to go back home
      io.emit("reset:all");
    });
  });

  return { pushAdmin };
}

module.exports = (io) => {
  const { pushAdmin } = initAdmin(io);

  const pushPlayers = () => {
    io.emit("server:updateOnline", { online: state.online });
    io.of("/game").emit("server:updateOnline", { online: state.online });
  };

  // ----- your original code starts here -----
  io.on('connection', (socket) => {
    // count root connection
    state.online += 1;
    pushAdmin();
    pushPlayers();

    const id = socket.id;
    let user = { "id": id, "name": "Unnamed" };
    console.log(id + " is cool.");

    socket.on('chat message', (msg) => {
      const text = `${user.name}: ${msg}`;
      io.emit('chat message', text);
    });

    socket.on('status message', (msg) => {
      const text = `Username is now ${msg}!`;
      user.name = msg;
      io.emit('status message', text);
      pushAdmin();
    });

    socket.on('set name', (name) => {
      user.name = name;
      pushAdmin();
    });

    socket.on('game start', (username) => {
      console.log(`${username} start the game!`);
      io.emit('status message', `${username} start the game!`);

      // add warder/prisoner count
      const giveWarder = state.scores.warder <= state.scores.prisoner;
      if (giveWarder) state.scores.warder += 1;
      else state.scores.prisoner += 1;
      pushAdmin();
    });

    socket.on('disconnect', () => {
      state.online = Math.max(0, state.online - 1);
      pushAdmin();
      pushPlayers();
    });
  });
  // ----- your original code ends here -----

  // ===== also track the /game namespace =====
  const gameNS = io.of('/game');
  gameNS.on('connection', (socket) => {
    state.online += 1;
    pushAdmin();
    pushPlayers();

    let name = "Unnamed";

    socket.on('set name', (n) => {
      name = n || "Unnamed";
      pushAdmin();
    });

    socket.on('status message', (msg) => {
      name = msg || name;
      io.emit('status message', `Username is now ${name}!`);
      pushAdmin();
    });

    socket.on('chat message', (msg) => {
      io.emit('chat message', `${name}: ${msg}`);
    });

    socket.on('game start', (username) => {
      const who = username || name || "Unnamed";
      console.log(`[gameNS] ${who} start the game!`);
      io.emit('status message', `${who} start the game!`);

      const giveWarder = state.scores.warder <= state.scores.prisoner;
      if (giveWarder) state.scores.warder += 1;
      else state.scores.prisoner += 1;
      pushAdmin();
    });

    socket.on('disconnect', () => {
      state.online = Math.max(0, state.online - 1);
      pushAdmin();
      pushPlayers();
    });
  });
};
