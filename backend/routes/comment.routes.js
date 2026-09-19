const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth.middleware');

module.exports = function (io) {
  const router = express.Router();
  router.use(authenticate);

  // List comments for a task
  router.get('/task/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const result = await pool.query(
        `SELECT c.*, u.name AS author_name FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
        [taskId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not fetch comments' });
    }
  });

  // Add a comment
  router.post('/', async (req, res) => {
    try {
      const { taskId, content } = req.body;
      if (!taskId || !content) return res.status(400).json({ error: 'taskId and content are required' });

      const result = await pool.query(
        'INSERT INTO comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
        [taskId, req.user.id, content]
      );

      const task = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
      const comment = { ...result.rows[0], author_name: req.user.name };

      if (task.rows.length > 0) {
        io.to(`project:${task.rows[0].project_id}`).emit('comment-added', comment);
      }
      res.status(201).json(comment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not add comment' });
    }
  });

  return router;
};
