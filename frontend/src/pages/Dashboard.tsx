import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import NotificationBell from '../components/NotificationBell';

interface Project {
  id: number;
  name: string;
  description: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) connectSocket(token);
    loadProjects();
  }, [token]);

  async function loadProjects() {
    const res = await api.get('/api/projects');
    setProjects(res.data);
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await api.post('/api/projects', { name, description });
    setProjects((prev) => [res.data, ...prev]);
    setName('');
    setDescription('');
    setShowForm(false);
  }

  return (
    <div>
      <div className="topbar">
        <h2>BoardFlow</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NotificationBell socket={getSocket()} />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.name}</span>
          <button className="btn secondary small" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="dashboard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Your Projects</h3>
          <button className="btn" onClick={() => setShowForm((s) => !s)}>+ New Project</button>
        </div>

        {showForm && (
          <form onSubmit={createProject} style={{ marginTop: 16, background: 'var(--panel)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="field"><label>Project name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="field"><label>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button className="btn" type="submit">Create</button>
          </form>
        )}

        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.id} onClick={() => navigate(`/project/${p.id}`)}>
              <h3>{p.name}</h3>
              <p>{p.description || 'No description'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
