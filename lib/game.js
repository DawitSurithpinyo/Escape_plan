const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

/**
 * @param {Server} io
 */
function gameIO(io) {
  const gameNS = io.of("/game");

  gameNS.on("connection", async (socket) => {
    const db = await open({
      filename: '../db/database.db',
      driver: sqlite3.Database
    });
    try{
      result = await db.run('SELECT * FROM game_sessions');
      // need to implement something like game session id when later multiple concurrent games are possible
    }
    catch{
      // table doesn't exists
      result = await db.run('CREATE TABLE game_sessions (obsPos )')
    }
    socket.emit("game connection");
  });
}

module.exports = { gameIO };