const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const { gameIO } = require('./lib/game.js');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'app/home.html'));
});

app.get('/game', (req, res) => {
  res.sendFile(join(__dirname, 'app/game.html'));
});

app.get('/server', (req, res) => {
  res.sendFile(join(__dirname, 'app/server.html'));
});


// Initialize socket handlers
require('./lib/home')(io);
gameIO(io);
// require('./lib/server')(io);

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


//Fundmental Checkpoint close to finish
//Can do multiple devices
//As of 9/19 10%