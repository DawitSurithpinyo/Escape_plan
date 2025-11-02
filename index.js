const express = require('express');
const crypto = require('node:crypto');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const { gameIO } = require('./lib/game.js');
var cookieParser = require('cookie-parser');

const sessions = require('./util/sessions.js');

const app = express();
const server = createServer(app);
const io = new Server(server);


app.use(express.static(__dirname));
app.use(express.json()); // to parse JSON in requests
app.use(cookieParser()); // to read/write cookies in requests

app.get('/', (req, res) => {
  let reqUserID = req.cookies.userID;
  if(reqUserID && sessions.hasOwnProperty(reqUserID)){
    res.sendFile(join(__dirname, 'app/home.html'));
    return;
  }

  // set cookies, send back to client
  let userID = crypto.randomUUID();
  res.cookie('userID', userID, {httpOnly: true, sameSite: "lax"});

  sessions[userID] = {
    userName: null, // username, set in home page
    win: 0, // how many times player has won
    lose: 0,
    socketID: null, // current socket ID of user. Used to identify user during game since game initialization logic (who plays what role) uses socket object
    wonLastRound: false, // player won last round get to move first in next game (as specified in requirement)
    roleCurrentGame: null
  };

  res.sendFile(join(__dirname, 'app/home.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(join(__dirname, 'app/game.html'));
});

app.get('/server', (req, res) => {
  res.sendFile(join(__dirname, 'app/server.html'));
});


app.post('/api/setUsername', (req, res) => {
  let userID = req.cookies.userID;
  if (!userID || !sessions[userID]) {
    return res.status(400).json("Invalid or missing userID cookie");
  }

  sessions[userID].userName = req.body.userName;
  res.status(201).json("Set userName successfully");
});

app.get('/api/getUser', (req, res) => {
  let userID = req.cookies.userID;
  let session = sessions[userID];
  if (!session){
    return res.status(400).json("Error");
  }
  res.status(200).json({ ...session });
});

app.get('/api/getAllUser', (req, res) => {
  res.status(200).json( sessions );
});


// Initialize socket handlers
require('./lib/home')(io);
gameIO(io);
// require('./lib/server')(io);

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


module.exports = sessions;

//Fundmental Checkpoint close to finish
//Can do multiple devices
//As of 9/19 10%