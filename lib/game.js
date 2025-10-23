const { Server, Socket, Namespace } = require('socket.io');
const { gridInit } = require('../util/algotest.js');
// const { db } = /** @type {{ db: import('mongodb').Db }} */ (require('../index.js'));

var waiting = [];

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

      warder.gameData = { character: "warder", movementBuffer: {dx: null, dy: null} };
      prisoner.gameData = { character: "prisoner", movementBuffer: {dx: null, dy: null} };
      warder.emit("start game", {grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character:"warder"});
      prisoner.emit("start game", {grid, obsPosArray, warderPos, prisonerPos, tunnelPos, character:"prisoner"});

      warder.on("warder select move", ({dx, dy}) => {
        console.log(`Warder selected move: ${dx}, ${dy}`);
        //endTurn(gameNS, "warder", dx, dy)
        warder.gameData.movementBuffer = {dx, dy};
      });

      prisoner.on("prisoner select move", ({dx, dy}) => {
        console.log(`Prisoner selected move: ${dx}, ${dy}`);
        //endTurn(gameNS, "prisoner", dx, dy)
        prisoner.gameData.movementBuffer = {dx, dy};
      });

      // actually start playing game
      let winner;
      let round = 0;
      let Wpos = warderPos;
      let Ppos = prisonerPos;
      let Tpos = tunnelPos;
      console.log(`W : ${Wpos}, P : ${Ppos}, T : ${Tpos} `)
      while (!winner) {
        if (round % 2 === 0) {
          console.log(`round ${round}, warder's turn`);
          await startTurn(warder, "warder");

          const {dx, dy} = warder.gameData.movementBuffer;
          console.log(`warder ${dx} ${dy}`);

          await warder.once("move",(x, y) => {
              if(x === 1){
                Wpos += 1;
                console.log(`warder move to ${Wpos}`);
              };
              if(x === -1){
                Wpos -= 1;
                console.log(`warder move to ${Wpos}`);
              };
              if(y === 1){
                Wpos -= 5;
                console.log(`warder move to ${Wpos}`);
              };
              if(y === -1){
                Wpos += 5;
                console.log(`warder move to ${Wpos}`);
              };
        });
          endTurn(gameNS, "warder", dx, dy);
          warder.gameData.movementBuffer = {dx: null, dy: null};
          if (Wpos === Ppos) {
            warder.emit("game over", "warder");
            prisoner.emit("game over", "warder");
            waiting = [];
            break;
        }
        }
        else {
          console.log(`round ${round}, prisoner's turn`);
          await startTurn(prisoner, "prisoner");

          const {dx, dy} = prisoner.gameData.movementBuffer;
          console.log(`prisoner ${dx} ${dy}`);
          await prisoner.once("move",(x,y) => {
              if(x === 1){
                Ppos += 1;
                console.log(`prisoner move to ${Ppos}`);
              };
              if(x === -1){
                Ppos -= 1;
                console.log(`Prisoner move to ${Ppos}`);
              };
              if(y === 1){
                Ppos -= 5;
                console.log(`Prisoner move to ${Ppos}`);
              };
              if(y === -1){
                Ppos += 5;
                console.log(`Prisoner move to ${Ppos}`);
              };
          });
          endTurn(gameNS, "prisoner", dx, dy); 
          prisoner.gameData.movementBuffer = {dx: null, dy: null};
        }
        round += 1;
        if (Wpos === Ppos) {
          warder.emit("game over", "warder");
          prisoner.emit("game over", "warder");
          waiting = [];
          break;
        }
        if (Ppos === Tpos){
          warder.emit("game over", "prisoner");
          prisoner.emit("game over", "prisoner");
          waiting = [];
          break;
        }
        if (round === 30) {
          console.log("turn exceeded threshold");
          waiting = [];
          break; // to test
        }
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
  // setTimeout(() => endTurn(io, nextPlayerSocketId, character), 10000); // end turn after 10 seconds
  await sleep(10000); // end turn after 10 seconds
}

/**
 * @param {Namespace} io
 */
async function endTurn(io, character, dx, dy) {
  io.emit("turn end", {character, dx, dy});
  // startTurn(io, nextPlayerSocketId);
}


function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}