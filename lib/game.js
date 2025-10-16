const { Server } = require('socket.io');
const { gridInit } = require('../util/algotest.js');
// const { db } = /** @type {{ db: import('mongodb').Db }} */ (require('../index.js'));

const waiting = [];

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
      const {grid, obsPos, wardenPos, prisonerPos, tunnelPos} = gridInit();
      let obsPosArray = Array.from(obsPos); // socket cannot emit set (unserializable object), need to convert to array first

      waiting[0].emit("start game", {grid, obsPosArray, wardenPos, prisonerPos, tunnelPos});
      waiting[1].emit("start game", {grid, obsPosArray, wardenPos, prisonerPos, tunnelPos});
    }

    socket.on("prisoner move", ({dx, dy}) => {
      gameNS.emit("prisoner moved", {dx, dy});
    });
    
  });
}

module.exports = { gameIO };