const jwt = require('jsonwebtoken');

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (${socket.user?.name})`);

    // Every user gets a personal room for direct notifications
    socket.join(`user:${socket.user.id}`);

    // Join a project room to receive its live task/comment updates
    socket.on('join-project', (projectId) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
    });
  });
}

module.exports = registerSocketHandlers;
