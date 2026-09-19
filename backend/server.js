require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const registerSocketHandlers = require('./sockets');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', require('./routes/task.routes')(io));
app.use('/api/comments', require('./routes/comment.routes')(io));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

registerSocketHandlers(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
