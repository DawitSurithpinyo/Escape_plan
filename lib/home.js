module.exports = (io) => {
  io.on('connection', (socket) => {
    const id = socket.id;
    let user = { "id": id, "name": "Unnamed"};
    //const joinNoti = id + " has joined."
    console.log(id + " is cool.");
    
    socket.on('chat message', (msg) => {
      const text = `${user.name}: ${msg}`
      io.emit('chat message', text);
    });
    
    socket.on('status message', (msg) => {
      const text = `Username is now ${msg}!`
      user.name = msg;
      io.emit('status message', text);
    });
    
    socket.on('set name', (name) => {
      user.name = name;
    });
  });
};