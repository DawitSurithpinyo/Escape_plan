const { Server, Socket, Namespace } = require('socket.io');
const { gridInit } = require('../util/algotest.js');
const sessions = require('../util/sessions.js');
const gameConfig = require('../util/gameConfig.js');
const cookie = require('cookie');

let waiting = [];
var time = gameConfig.gameSpeed;

// 🟢 ADDED: cumulative counters
let totalGamesPlayed = 0;       // total games played since server start
let totalTurnsThisGame = 0;     // number of turns in the current game

/**
 * @param {Server} io
 */
function gameIO(io) {
  const gameNS = io.of("/game");

  gameNS.on("connection", async (socket) => {
    // read cookies during websocket connection establishing to identify user
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    sessions[cookies.userID].socketID = socket.id;
    const user = sessions[cookies.userID];

    socket.emit("Speed",{time})
    
    //chat function
    socket.on('chat message', (msg) => {
      const text = `${user.userName}: ${msg}`;
      gameNS.emit('chat message', text);
    });

    // ✅ FIX: if this socket leaves (including after admin reset redirect), remove from queue
    socket.on("disconnect", () => {
      waiting = waiting.filter(s => s.id !== socket.id);

      let countExpectingRematch = 0;
      for (let [key, value] of Object.entries(sessions)) {
        if(socket.id === value.socketID){
          value.wantsRematch = null;
          value.roleCurrentGame = null;
          value.socketID = null;
        }
        if(value.expectingRematch){
          countExpectingRematch += 1;
          value.expectingRematch = null;
        }
      }
      if(countExpectingRematch < 2){
        for (let [key, value] of Object.entries(sessions)) {
          value.expectingRematch = null;
        }
        gameNS.emit("exit");
      }
    });

    waiting.push(socket);

    // update the player info box in game.html to the first player that arrived
    if (waiting.length === 1) {
      const p1Info = {
        userName: user.userName,
        win: user.win,
        lose: user.lose,
      };
      socket.emit("first player", p1Info);
    }

    if (waiting.length === 2) {
      // generate board once both players arrive
      const { grid, obsPos, warderPos, prisonerPos, tunnelPos } = gridInit(gameConfig.obstacleAmount);
      let obsPosArray = Array.from(obsPos); // sets aren’t serializable
      
      var warder;
      var prisoner;
      let hasPlayedBefore = false;
      for (let [key, value] of Object.entries(sessions)) {
        // check if there is any player that won last round
        if (value.wonLastRound === true) {
          hasPlayedBefore = true;
          break;
        }
      }
      
      // if yes, that player start first (AKA become warder)
      if (hasPlayedBefore) {
        // Find the previous winner session
        const winnerEntry = Object.entries(sessions).find(([id, value]) => value.wonLastRound);

        if (winnerEntry) {
          const [winnerId, winnerSession] = winnerEntry;

          // Find which socket in waiting belongs to that winner
          const warderSocket = waiting.find(s => s.id === winnerSession.socketID);

          if (warderSocket) {
            warder = warderSocket;
            prisoner = waiting.find(s => s.id !== warder.id);
            sessions[winnerId].roleCurrentGame = "warder";

            for (let [key, value] of Object.entries(sessions)) {
              if (value.wonLastRound === false) {
                value.roleCurrentGame = "prisoner";
              }
            }

            sessions[winnerId].wonLastRound = false; // reset wonLastRound record of previous round's winner
          } else {
            // Fallback to random if winner not found in waiting
            let randomIndex = Math.random() > 0.5 ? 1 : 0;
            warder = waiting[randomIndex];
            prisoner = waiting[Math.abs(randomIndex - 1)];

            for (let [key, value] of Object.entries(sessions)) {
              if (value.socketID === warder.id) {
                value.roleCurrentGame = "warder";
              }
              else if (value.socketID === prisoner.id){
                value.roleCurrentGame = "prisoner";
              }
              value.wonLastRound = false;
            }
          }
        }
      }

      // if not, randomize who becomes warder and prisoner
      else {
        let randomIndex = Math.random() > 0.5 ? 1 : 0;
        warder = waiting[randomIndex];
        prisoner = waiting[Math.abs(randomIndex - 1)];

        for (let [key, value] of Object.entries(sessions)) {
          if (value.socketID === warder.id) {
            value.roleCurrentGame = "warder";
          }
          else if (value.socketID === prisoner.id){
            value.roleCurrentGame = "prisoner";
          }
          value.wonLastRound = false;
        }
      }

      // update user info board in game.html to both players
      const [p1, p2] = waiting;
      const p1Info = Object.values(sessions).find(v => v.socketID === p1.id);
      const p2Info = Object.values(sessions).find(v => v.socketID === p2.id);

      const playerList = [
        { userName: p1Info.userName, win: p1Info.win, lose: p1Info.lose },
        { userName: p2Info.userName, win: p2Info.win, lose: p2Info.lose },
      ];
      warder.emit("both players", playerList);
      prisoner.emit("both players", playerList);

      // clear queue for next pair
      waiting = [];

      // ✅ FIX: guard if someone already disconnected while pairing
      if (!warder?.connected || !prisoner?.connected) {
        if (warder?.connected) waiting.push(warder);
        if (prisoner?.connected) waiting.push(prisoner);
        return;
      }

      warder.gameData   = { character: "warder",   movementBuffer: { dx: null, dy: null } };
      prisoner.gameData = { character: "prisoner", movementBuffer: { dx: null, dy: null } };
      warder.emit("start game",   { grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character: "warder" });
      prisoner.emit("start game", { grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character: "prisoner" });

      // 🟢 ADDED: reset counters and announce game start
      totalGamesPlayed += 1;

      totalTurnsThisGame = 0;
      gameNS.emit("server:updateGames", { totalGamesPlayed });
      gameNS.emit("server:updateTurns", { totalTurnsThisGame });
      console.log(`🟢 Game #${totalGamesPlayed} started`);



      warder.on("warder select move",   ({ dx, dy }) => { warder.gameData.movementBuffer = { dx, dy }; });
      prisoner.on("prisoner select move", ({ dx, dy }) => { prisoner.gameData.movementBuffer = { dx, dy }; });

      // ✅ FIX: stop the loop immediately if either player disconnects
      let aborted = false;
      const onDiscW = () => { aborted = true; try { prisoner.emit("game over", "opponent disconnected"); } catch {} };
      const onDiscP = () => { aborted = true; try { warder.emit("game over", "opponent disconnected"); } catch {} };
      warder.once("disconnect", onDiscW);
      prisoner.once("disconnect", onDiscP);

      try {
        // actually start playing game
        let round = 0;
        let Wpos = warderPos;
        let Ppos = prisonerPos;
        let Tpos = tunnelPos;
        console.log(`W : ${Wpos}, P : ${Ppos}, T : ${Tpos} `);

        // loop until someone wins or aborted
        while (!aborted) {
          // 🟢 ADDED: count turns in this game
          totalTurnsThisGame += 1;
          gameNS.emit("server:updateTurns", { totalTurnsThisGame });
          console.log(`🔸 Turn ${totalTurnsThisGame} in Game #${totalGamesPlayed}`);

          if (round % 2 === 0) {
            console.log(`round ${round}, warder's turn`);
            await startTurn(warder, "warder", aborted);
            if (aborted) break;

            // ✅ FIX: await a SINGLE 'move' (or timeout) instead of using await socket.once(...)
            // const { x, y } = await waitForMove(warder, 11000, () => aborted);
            const { dx, dy } = {
              dx: warder.gameData.movementBuffer.dx,
              dy: warder.gameData.movementBuffer.dy
            };
            let unmovedWpos = new Set(obsPos).add(tunnelPos);
            // temp position
            let tempWpos =0;
            if (dx === 1)  tempWpos= Wpos + 1;
            if (dx === -1) tempWpos =Wpos - 1;
            if (dy === 1)  tempWpos = Wpos - 5;
            if (dy === -1) tempWpos = Wpos + 5;

            if(!(unmovedWpos.has(tempWpos))){
               // apply move
              if (dx === 1)  Wpos += 1;
              if (dx === -1) Wpos -= 1;
              if (dy === 1)  Wpos -= 5;
              if (dy === -1) Wpos += 5;
            }
            

           

            endTurn(gameNS, "warder", dx ?? null, dy ?? null);
            warder.gameData.movementBuffer = { dx: null, dy: null };

            if (Wpos === Ppos) {
              // warder wins
              for (let [key, value] of Object.entries(sessions)) {
                if (value.socketID == warder.id) {
                  value.win += 1;
                  value.wonLastRound = true;
                  value.roleCurrentGame = null;
                  value.socketID = null;
                }
                else if (value.socketID == prisoner.id) {
                  value.lose += 1;
                  value.roleCurrentGame = null;
                  value.socketID = null;
                }
              }              
              safeEmit(warder, "game over", "warder");
              safeEmit(prisoner, "game over", "warder");
              break;
            }
          } else {
            console.log(`round ${round}, prisoner's turn`);
            await startTurn(prisoner, "prisoner", aborted);
            if (aborted) break;

            // const { x, y } = await waitForMove(prisoner, 11000, () => aborted);
            const { dx, dy } = {
              dx: prisoner.gameData.movementBuffer.dx,
              dy: prisoner.gameData.movementBuffer.dy
            };

            let unmovedPpos = new Set(obsPos);
            // temp position
            let tempPpos =0;
            if (dx === 1)  tempPpos= Ppos + 1;
            if (dx === -1) tempPpos =Ppos - 1;
            if (dy === 1)  tempPpos = Ppos - 5;
            if (dy === -1) tempPpos = Ppos + 5;

            if(!(unmovedPpos.has(tempPpos))){
              if (dx === 1)  Ppos += 1;
              if (dx === -1) Ppos -= 1;
              if (dy === 1)  Ppos -= 5;
              if (dy === -1) Ppos += 5;

            }
            
            endTurn(gameNS, "prisoner", dx ?? null, dy ?? null);
            prisoner.gameData.movementBuffer = { dx: null, dy: null };
          }

          // win checks after prisoner move
          if (Wpos === Ppos) {
            // warder wins
            for (let [key, value] of Object.entries(sessions)) {
              if (value.socketID == warder.id) {
                value.win += 1;
                value.wonLastRound = true;
                value.roleCurrentGame = null;
                value.socketID = null;
              }
              else if (value.socketID == prisoner.id) {
                value.lose += 1;
                value.roleCurrentGame = null;
                value.socketID = null;
              }
            }
            safeEmit(warder, "game over", "warder");
            safeEmit(prisoner, "game over", "warder");
            break;
          }
          if (Ppos === Tpos) {
            // prisoner wins
            for (let [key, value] of Object.entries(sessions)) {
              if (value.socketID == prisoner.id) {
                value.win += 1;
                value.wonLastRound = true;
                value.roleCurrentGame = null;
                value.socketID = null;
              }
              else if (value.socketID == warder.id) {
                value.lose += 1;
                value.roleCurrentGame = null;
                value.socketID = null;
              }
            }
            safeEmit(warder, "game over", "prisoner");
            safeEmit(prisoner, "game over", "prisoner");
            break;
          }

          round += 1;
          if (round >= 30) {
            console.log("turn exceeded threshold");
            break;
          }
        }

        // 🟢 ADDED: log game summary
        console.log(`🟥 Game #${totalGamesPlayed} ended after ${totalTurnsThisGame} turns`);
        // update clients with final values


      } finally {

        // ✅ FIX: always clean listeners so they don’t stack on rematch
        try { warder.off("disconnect", onDiscW); } catch {}
        try { prisoner.off("disconnect", onDiscP); } catch {}
        try { warder.off("warder select move"); } catch {}
        try { prisoner.off("prisoner select move"); } catch {}
      }
    }


    socket.on("exit selected", () => {
      for (let [key, value] of Object.entries(sessions)) {
        value.roleCurrentGame = null;
        value.wonLastRound = false;
        value.socketID = null;
        value.wantsRematch = null;
      }
      gameNS.emit("exit");
    });

    socket.on("play again selected", () => {
      sessions[cookies.userID].wantsRematch = true;

      let voteCount = 0;
      for (let [key, value] of Object.entries(sessions)) {
        if(value.wantsRematch){
          voteCount += 1;
        }
      }

      if (voteCount === 2){
        for (let [key, value] of Object.entries(sessions)) {
          value.expectingRematch = true;
          value.wantsRematch = null;
        }
        gameNS.emit("play again");
      }
    })
  });
}

module.exports = { gameIO };

/**
 * @param {Socket} player
 */
async function startTurn(player, character) {
  var time2 = gameConfig.gameSpeed;
  player.emit("turn start", ({character, time2}));
  await sleep((time2 + 1) * 1000); // end turn after 10 seconds (client can still send early)
}

/**
 * Wait for exactly one 'move' OR time out, OR abort early.
 */
function waitForMove(sock, ms, isAborted) {
  return new Promise((resolve) => {
    let done = false;

    const finish = (payload) => {
      if (done) return;
      done = true;
      try { sock.off("move", onMove); } catch {}
      try { clearTimeout(t); } catch {}
      try { clearInterval(abortPoll); } catch {}
      resolve(payload);
    };

    const onMove = (x, y) => finish({ x, y });
    const t = setTimeout(() => finish({ x: null, y: null }), ms);
    const abortPoll = setInterval(() => {
      if (isAborted && isAborted()) finish({ x: null, y: null });
    }, 100);

    sock.once("move", onMove);
  });
}

/**
 * @param {Namespace} io
 */
async function endTurn(io, character, dx, dy) {
  io.emit("turn end", { character, dx, dy });
}

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function safeEmit(sock, ev, payload) {
  try { sock.emit(ev, payload); } catch {}
}
