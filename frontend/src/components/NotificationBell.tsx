import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface Props {
  socket: Socket | null;
}

export default function NotificationBell({ socket }: Props) {
  const [notifications, setNotifications] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { message: string }) => {
      setNotifications((prev) => [data.message, ...prev].slice(0, 20));
    };
    socket.on('notification', handler);
    return () => {
      socket.off('notification', handler);
    };
  }, [socket]);

  function toggle() {
    setOpen((o) => !o);
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="notif-bell" onClick={toggle}>
        🔔
        {notifications.length > 0 && <span className="notif-dot" />}
      </div>
      {open && (
        <div className="notif-dropdown">
          {notifications.length === 0 && <div className="notif-item">No notifications yet</div>}
          {notifications.map((n, i) => (
            <div className="notif-item" key={i}>{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}
