import { useEffect, useState, FormEvent } from 'react';
import { Socket } from 'socket.io-client';
import api from '../services/api';

interface Comment {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assigned_name?: string;
}

interface Props {
  task: Task;
  socket: Socket | null;
  onClose: () => void;
  onDelete: (id: number) => void;
}

export default function TaskModal({ task, socket, onClose, onDelete }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    loadComments();
    if (!socket) return;
    const handler = (comment: Comment & { task_id: number }) => {
      if ((comment as any).task_id === task.id) {
        setComments((prev) => [...prev, comment]);
      }
    };
    socket.on('comment-added', handler);
    return () => {
      socket.off('comment-added', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, socket]);

  async function loadComments() {
    const res = await api.get(`/api/comments/task/${task.id}`);
    setComments(res.data);
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    await api.post('/api/comments', { taskId: task.id, content });
    setContent('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ marginTop: 0 }}>{task.title}</h3>
          <button className="btn danger small" onClick={() => onDelete(task.id)}>Delete</button>
        </div>
        {task.description && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{task.description}</p>}
        {task.assigned_name && <p style={{ fontSize: 12 }}>Assigned to: {task.assigned_name}</p>}

        <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />
        <h4 style={{ fontSize: 13 }}>Comments</h4>
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <span className="who">{c.author_name}:</span>{c.content}
          </div>
        ))}
        <form onSubmit={submitComment} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: '#0f1115', color: 'white' }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
          />
          <button className="btn small" type="submit">Send</button>
        </form>

        <button className="btn secondary" style={{ marginTop: 16, width: '100%' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
