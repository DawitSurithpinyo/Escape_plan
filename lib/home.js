// lib/home.js (server-side)
const sessions = require('../util/sessions.js');
const gameConfig = require('../util/gameConfig.js');
const state = { online: 0, scores: { warder: 0, prisoner: 0 }, gameSpeed: 10};
const cookie = require('cookie');

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

    socket.on("admin:setGameSpeed", ({ speed }) => {
        const s = Number(speed) || 10;
        state.gameSpeed = s;
        console.log(`[admin] setGameSpeed received: ${s}`);
        io.of("/game").emit("server:updateGameSpeed", { speed: s });
      });

    socket.on("admin:reset", () => {
      // reset scores
      state.scores = { warder: 0, prisoner: 0 };
      pushAdmin();

      // Reset win/lose counts for all users in sessions
      Object.keys(sessions).forEach(userID => {
        if (sessions[userID]) {
          sessions[userID].win = 0;
          sessions[userID].lose = 0;
          sessions[userID].socketID = null,
          sessions[userID].wonLastRound = false,
          sessions[userID].roleCurrentGame = null;
        }
      });

      // 🟢 CHANGED: broadcast reset ONLY to /game so players get kicked back home
      io.of("/game").emit("reset:all");

      // 🟢 CHANGED: immediately zero the counter and broadcast it
      state.online = 0;
      pushPlayers(io);
      pushAdmin();
    });
  });

  return { pushAdmin };
}

// small helper so we can call from reset too
function pushPlayers(io) {
  io.emit("server:updateOnline", { online: state.online });          // homepage ("/")
  io.of("/game").emit("server:updateOnline", { online: state.online }); // game namespace
}

function pushGameSpeed(io, target = null) {
  const payload = { speed: state.gameSpeed };
  if (target) {
    target.emit("server:updateGameSpeed", payload);
  } else {
    io.emit("server:updateGameSpeed", payload);
    io.of("/game").emit("server:updateGameSpeed", payload);
    io.of("/admin").emit("server:updateGameSpeed", payload);
  }
}


module.exports = (io) => {
  const { pushAdmin } = initAdmin(io);

  // ----- your original code (ROOT "/") -----
  // 🟢 CHANGED: DO NOT count root "/" connections as players.
  // We keep chat/status etc. behavior the same; only remove the online++/--.
  io.on('connection', (socket) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const user = sessions[cookies.userID];
    socket.emit("receive obstacle", {count: gameConfig.obstacleAmount});

    // NO online++ here (home page is not a player)
    pushAdmin();
    pushPlayers(io);
    pushGameSpeed(io, socket);

    const id = socket.id;
    // let user = { "id": id, "name": "Unnamed" };
    console.log(id + " is cool.");
  
    socket.on('appearance:update', (data) => {
      console.log(`Appearance update from ${user.userName}:`, data);
      io.emit('appearance:update', data); // Broadcast to ALL clients
    });

    socket.on('chat message', (msg) => {
      const text = `${user.userName}: ${msg}`;
      io.emit('chat message', text);
    });

    socket.on('status message', (msg) => {
      const text = `Username is now ${msg}!`;
      user.userName = msg;
      io.emit('status message', text);
      pushAdmin();
    });

    socket.on('set name', (name) => {
      user.userName = name;
      pushAdmin();
    });

    socket.on("game:setSpeed", (newSpeed) => {
      if (isNaN(newSpeed) || !Number.isInteger(newSpeed) || newSpeed < 1 || newSpeed > 10) {
        return;
      }
      gameConfig.gameSpeed = newSpeed;
      console.log(`[gameNS] ${user.userName} set speed to ${newSpeed}`);
      socket.broadcast.emit("receive speed", { newSpeed });
      console.log(gameConfig.gameSpeed);
    });

    socket.on("set obstacle", ({ count }) => {
      if(isNaN(count) || !Number.isInteger(count) || count < 0 || count > 5){
        return;
      }
      gameConfig.obstacleAmount = count;
      socket.broadcast.emit("receive obstacle", { count }); // broadcast new obstacle count to other clients
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
      // NO online-- here either
      pushAdmin();
      pushPlayers(io);
    });
  });

  // ===== track the /game namespace (players) =====
  const gameNS = io.of('/game');
  gameNS.on('connection', (socket) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const user = sessions[cookies.userID];

    // 🟢 CHANGED: count ONLY /game connections as players
    state.online += 1;
    pushAdmin();
    pushPlayers(io);
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
      io.emit('chat message', `${user.userName}: ${msg}`);
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
      pushPlayers(io);
    });
    

  });
};


