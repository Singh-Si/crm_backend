const socketIO = require('socket.io');
let io;

function initialize(server) {
  io = socketIO(server);
// console.log("asdf");
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Handle disconnect event if needed
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
} 

function emitToUser(userId, eventName, data) {
  // Check if the user is connected and emit the event
  const userSocket = io.sockets.sockets[userId];
  if (userSocket) {
    userSocket.emit(eventName, data);
  }
}

module.exports = {
  initialize,
  emitToUser,
  io
};
