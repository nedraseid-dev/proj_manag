const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// List projects the user is a member of
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.* FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch projects' });
  }
});

// Create a project - creator becomes owner/member automatically
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    await client.query('BEGIN');
    const projectResult = await client.query(
      'INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', req.user.id]
    );
    const project = projectResult.rows[0];
    await client.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.user.id, 'owner']
    );
    await client.query('COMMIT');
    res.status(201).json(project);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not create project' });
  } finally {
    client.release();
  }
});

// Get one project with members
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const members = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role FROM project_members pm
       JOIN users u ON u.id = pm.user_id WHERE pm.project_id = $1`,
      [id]
    );
    res.json({ ...project.rows[0], members: members.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch project' });
  }
});

// Add a member by email
router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'No user with that email' });

    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, userResult.rows[0].id]
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add member' });
  }
});

module.exports = router;
