import { useState, useEffect, useCallback } from 'react';
import API from '../api/axios';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount,   setUnreadCount]   = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await API.get('notifications/');
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !n.is_read).length);
        } catch {
            // ignore — token may not be set yet
        }
    }, []);

    useEffect(() => {
        const immediateId = setTimeout(() => {
            fetchNotifications();
        }, 0);
        const id = setInterval(fetchNotifications, POLL_INTERVAL);
        return () => {
            clearTimeout(immediateId);
            clearInterval(id);
        };
    }, [fetchNotifications]);

    const markRead = useCallback(async (id) => {
        try {
            await API.post(`notifications/${id}/mark-read/`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* ignore */ }
    }, []);

    const markAllRead = useCallback(async () => {
        try {
            await API.post('notifications/mark-all-read/');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* ignore */ }
    }, []);

    return { notifications, unreadCount, markRead, markAllRead, refresh: fetchNotifications };
}
