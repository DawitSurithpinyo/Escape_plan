const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);


app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  const id = socket.id;
  //const joinNoti = id + " has joined."
  console.log(id+" is cool.");
  socket.on('chat message', (msg) => {
    const text = `${id}: ${msg}`
    io.emit('chat message', (text));
  });
  socket.on('status message',(msg) => {
    io.emit('status message',msg);
  })
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});

//Fundmental Checkpoint close to finish
//Can do multiple devices
//As of 9/19 10%