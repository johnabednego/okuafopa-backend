let io = null;

function init(server) {
  const socketio = require('socket.io');
  io = socketio(server, {
    cors: {
      origin: '*', // tighten in production
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  io.on('connection', (socket) => {
    // client should send { type: 'farmer'|'buyer', id: '<userId>' } to subscribe
    socket.on('subscribe', (payload) => {
      try {
        const { type, id } = payload || {};
        if (type && id) {
          socket.join(`${type}:${id}`);
        }
      } catch (e) {
        // ignore
      }
    });

    socket.on('unsubscribe', (payload) => {
      try {
        const { type, id } = payload || {};
        if (type && id) socket.leave(`${type}:${id}`);
      } catch (e) {}
    });
  });
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized. Call init(server) first.');
  return io;
}

module.exports = { init, getIo };
