const { Server, Socket, Namespace } = require('socket.io');
const { gridInit } = require('../util/algotest.js');

let waiting = [];

/**
 * @param {Server} io
 */
function gameIO(io) {
  const gameNS = io.of("/game");

  gameNS.on("connection", async (socket) => {
    // ✅ FIX: if this socket leaves (including after admin reset redirect), remove from queue
    socket.on("disconnect", () => {
      waiting = waiting.filter(s => s.id !== socket.id);
    });

    waiting.push(socket);

    if (waiting.length === 2) {
      // generate board once both players arrive
      const { grid, obsPos, warderPos, prisonerPos, tunnelPos } = gridInit();
      let obsPosArray = Array.from(obsPos); // sets aren’t serializable

      let randomIndex = Math.random() > 0.5 ? 1 : 0;
      let warder = waiting[randomIndex];
      let prisoner = waiting[Math.abs(randomIndex - 1)];

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

            // apply move
            if (dx === 1)  Wpos += 1;
            if (dx === -1) Wpos -= 1;
            if (dy === 1)  Wpos -= 5;
            if (dy === -1) Wpos += 5;

            endTurn(gameNS, "warder", dx ?? null, dy ?? null);
            warder.gameData.movementBuffer = { dx: null, dy: null };

            if (Wpos === Ppos) {
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

            if (dx === 1)  Ppos += 1;
            if (dx === -1) Ppos -= 1;
            if (dy === 1)  Ppos -= 5;
            if (dy === -1) Ppos += 5;

            endTurn(gameNS, "prisoner", dx ?? null, dy ?? null);
            prisoner.gameData.movementBuffer = { dx: null, dy: null };
          }

          // win checks after prisoner move
          if (Wpos === Ppos) {
            safeEmit(warder, "game over", "warder");
            safeEmit(prisoner, "game over", "warder");
            break;
          }
          if (Ppos === Tpos) {
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
      } finally {
        // ✅ FIX: always clean listeners so they don’t stack on rematch
        try { warder.off("disconnect", onDiscW); } catch {}
        try { prisoner.off("disconnect", onDiscP); } catch {}
        try { warder.off("warder select move"); } catch {}
        try { prisoner.off("prisoner select move"); } catch {}
      }
    }
  });
}

module.exports = { gameIO };

/**
 * @param {Socket} player
 */
async function startTurn(player, character) {
  player.emit("turn start", character);
  await sleep(10000); // end turn after 10 seconds (client can still send early)
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
