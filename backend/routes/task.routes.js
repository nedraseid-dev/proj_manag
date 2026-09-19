const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth.middleware');

module.exports = function (io) {
  const router = express.Router();
  router.use(authenticate);

  // List tasks for a project
  router.get('/project/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const result = await pool.query(
        `SELECT t.*, u.name AS assigned_name FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.project_id = $1
         ORDER BY t.position ASC, t.created_at ASC`,
        [projectId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not fetch tasks' });
    }
  });

  // Create a task
  router.post('/', async (req, res) => {
    try {
      const { projectId, title, description, assignedTo } = req.body;
      if (!projectId || !title) return res.status(400).json({ error: 'projectId and title are required' });

      const result = await pool.query(
        `INSERT INTO tasks (project_id, title, description, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [projectId, title, description || '', assignedTo || null, req.user.id]
      );
      const task = result.rows[0];

      if (assignedTo) {
        await pool.query(
          'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
          [assignedTo, `You were assigned to task "${title}"`]
        );
        io.to(`user:${assignedTo}`).emit('notification', { message: `You were assigned to task "${title}"` });
      }

      io.to(`project:${projectId}`).emit('task-created', task);
      res.status(201).json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not create task' });
    }
  });

  // Update a task (status change = drag between columns, reassignment, edits)
  router.patch('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, status, assignedTo, position } = req.body;

      const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
      const before = existing.rows[0];

      const result = await pool.query(
        `UPDATE tasks SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           assigned_to = COALESCE($4, assigned_to),
           position = COALESCE($5, position)
         WHERE id = $6 RETURNING *`,
        [title, description, status, assignedTo, position, id]
      );
      const task = result.rows[0];

      if (assignedTo && assignedTo !== before.assigned_to) {
        await pool.query(
          'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
          [assignedTo, `You were assigned to task "${task.title}"`]
        );
        io.to(`user:${assignedTo}`).emit('notification', { message: `You were assigned to task "${task.title}"` });
      }

      io.to(`project:${task.project_id}`).emit('task-updated', task);
      res.json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not update task' });
    }
  });

  // Delete a task
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

      await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      io.to(`project:${existing.rows[0].project_id}`).emit('task-deleted', { id: Number(id) });
      res.json({ message: 'Task deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not delete task' });
    }
  });

  return router;
};
