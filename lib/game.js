const { Server, Socket, Namespace } = require('socket.io');
const { gridInit } = require('../util/algotest.js');
// const { db } = /** @type {{ db: import('mongodb').Db }} */ (require('../index.js'));

var waiting = [];
var movementBuffer = {dx: null, dy: null}

/**
 * @param {Server} io
 */
function gameIO(io) {
  const gameNS = io.of("/game");

  gameNS.on("connection", async (socket) => {
    // const col = db.collection('game_state');
    // const result = await col.findOne({
    //   'game_id': data.
    // })
    waiting.push(socket);

    if(waiting.length === 2){
      // generate board once both players arrive
      const {grid, obsPos, warderPos, prisonerPos, tunnelPos} = gridInit();
      let obsPosArray = Array.from(obsPos); // socket cannot emit set (unserializable object), need to convert to array first

      let randomIndex = (Math.random() > 0.5) ? 1 : 0;
      let warder = waiting[randomIndex]
      let prisoner = waiting[Math.abs(randomIndex - 1)]
      warder.emit("start game", {grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character:"warder"});
      prisoner.emit("start game", {grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character:"prisoner"});


      // actually start playing game
      let winner;
      let round = 0;
      while (!winner) {
        if (round % 2 === 0) {
          console.log(`round ${round}, warder's turn`);
          await startTurn(gameNS, warder.id, "warder");
          endTurn(gameNS, prisoner.id, "prisoner", movementBuffer.dx, movementBuffer.dy);
        }
        else {
          console.log(`round ${round}, prisoner's turn`);
          await startTurn(gameNS, prisoner.id, "prisoner");
          endTurn(gameNS, warder.id, "warder", movementBuffer.dx, movementBuffer.dy);
        }
        round += 1;
        movementBuffer.dx = null;
        movementBuffer.dy = null;
        if (round === 5) {
          console.log("end");
          waiting = []
          break; // to test
        }
      }
    }

    socket.on("warder select move", ({dx, dy}) => {
      console.log(dx, dy);
      movementBuffer.dx = dx;
      movementBuffer.dy = dy;
    });

    socket.on("prisoner select move", ({dx, dy}) => {
      console.log(dx, dy);
      movementBuffer.dx = dx;
      movementBuffer.dy = dy;
    });
    
  });
}

module.exports = { gameIO };

/**
 * @param {Namespace} io
 */
async function startTurn(io, playerSocketId, character) {
  io.to(playerSocketId).emit("turn start", character);
  // setTimeout(() => endTurn(io, nextPlayerSocketId, character), 10000); // end turn after 10 seconds
  await sleep(10000); // end turn after 10 seconds
}

/**
 * @param {Namespace} io
 */
function endTurn(io, nextPlayerSocketId, character, dx, dy) {
  io.emit("turn end", {character, dx, dy});
  // startTurn(io, nextPlayerSocketId);
}


function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}