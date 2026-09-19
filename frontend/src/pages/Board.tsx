import { useEffect, useState, FormEvent, DragEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import TaskModal from '../components/TaskModal';
import NotificationBell from '../components/NotificationBell';

interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  assigned_to: number | null;
  assigned_name?: string;
}

interface Member {
  id: number;
  name: string;
  email: string;
}

const COLUMNS: { key: Task['status']; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

export default function Board() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    const socket = connectSocket(token);
    socket.emit('join-project', id);

    socket.on('task-created', (task: Task) => {
      if (String(task.project_id) === id) setTasks((prev) => [...prev, task]);
    });
    socket.on('task-updated', (task: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    });
    socket.on('task-deleted', ({ id: taskId }: { id: number }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    loadProject();
    loadTasks();

    return () => {
      socket.emit('leave-project', id);
      socket.off('task-created');
      socket.off('task-updated');
      socket.off('task-deleted');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function loadProject() {
    const res = await api.get(`/api/projects/${id}`);
    setProjectName(res.data.name);
    setMembers(res.data.members);
  }

  async function loadTasks() {
    const res = await api.get(`/api/tasks/project/${id}`);
    setTasks(res.data);
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post('/api/tasks', {
      projectId: id,
      title,
      description,
      assignedTo: assignedTo || null,
    });
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setShowTaskForm(false);
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    try {
      await api.post(`/api/projects/${id}/members`, { email: memberEmail });
      setMemberEmail('');
      loadProject();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Could not add member');
    }
  }

  async function deleteTask(taskId: number) {
    await api.delete(`/api/tasks/${taskId}`);
    setSelectedTask(null);
  }

  function handleDrop(e: DragEvent, status: Task['status']) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status) {
      api.patch(`/api/tasks/${taskId}`, { status });
    }
  }

  return (
    <div>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn secondary small" onClick={() => navigate('/')}>← Back</button>
          <h2>{projectName}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NotificationBell socket={getSocket()} />
          <button className="btn small" onClick={() => setShowTaskForm((s) => !s)}>+ Task</button>
        </div>
      </div>

      <div style={{ padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Members: {members.map((m) => m.name).join(', ')}</span>
        <form onSubmit={addMember} style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="Add member by email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border)', background: '#0f1115', color: 'white', fontSize: 12 }}
          />
          <button className="btn secondary small" type="submit">Add</button>
        </form>
      </div>

      {showTaskForm && (
        <form onSubmit={createTask} style={{ margin: 16, background: 'var(--panel)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
          <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="field"><label>Description</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field">
            <label>Assign to</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ padding: 8, background: '#0f1115', color: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <button className="btn" type="submit">Create Task</button>
        </form>
      )}

      <div className="board">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`column ${dragOverCol === col.key ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className="column-title">{col.label} ({tasks.filter((t) => t.status === col.key).length})</div>
            {tasks.filter((t) => t.status === col.key).map((task) => (
              <div
                key={task.id}
                className="task-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('taskId', String(task.id))}
                onClick={() => setSelectedTask(task)}
              >
                <h4>{task.title}</h4>
                {task.assigned_name && <div className="assignee">👤 {task.assigned_name}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          socket={getSocket()}
          onClose={() => setSelectedTask(null)}
          onDelete={deleteTask}
        />
      )}
    </div>
  );
}
