import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications';
import useBreakpoint from '../hooks/useBreakpoint';

export default function NotificationBell() {
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const ref  = useRef(null);
    const navigate = useNavigate();
    const { isMobile, isTablet } = useBreakpoint();

    // Close panel when clicking outside
    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleNotifClick = (n) => {
        if (!n.is_read) markRead(n.id);
        if (n.product) navigate('/low-stock');
        setOpen(false);
    };

    const formatTime = (dateStr) => new Date(dateStr).toLocaleString();

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(o => !o)}
                title="Notifications"
                style={{
                    background: open ? '#6c63ff22' : 'none',
                    border: '1px solid ' + (open ? '#6c63ff66' : 'transparent'),
                    borderRadius: 10, cursor: 'pointer',
                    width: 38, height: 38,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', transition: 'all 0.2s',
                }}
            >
                <span style={{ fontSize: 18 }}>🔔</span>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 2, right: 2,
                        background: '#ef4444', color: '#fff',
                        fontSize: 9, fontWeight: 700,
                        minWidth: 16, height: 16, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px', lineHeight: 1,
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    top: isMobile ? 62 : 44,
                    right: isMobile ? 'auto' : undefined,
                    left: isMobile ? '50%' : 0,
                    transform: isMobile ? 'translateX(-50%)' : 'none',
                    width: isMobile ? 'min(94vw, 380px)' : (isTablet ? 340 : 360),
                    maxHeight: isMobile ? '70vh' : 'min(70vh, 460px)',
                    overflowY: 'auto',
                    background: '#1e1e3a', border: '1px solid #2a2a4a',
                    borderRadius: 12, boxShadow: '0 8px 32px #00000060',
                    zIndex: 4000,
                    scrollbarWidth: 'thin', scrollbarColor: '#2a2a4a #1e1e3a',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderBottom: '1px solid #2a2a4a',
                        position: 'sticky', top: 0, background: '#1e1e3a', zIndex: 1,
                    }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                            Notifications {unreadCount > 0 && (
                                <span style={{ color: '#ef4444', fontSize: 12 }}>({unreadCount} new)</span>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{
                                background: 'none', border: 'none', color: '#6c63ff',
                                fontSize: 11, cursor: 'pointer', fontWeight: 600,
                            }}>
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    {notifications.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: '#555' }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
                            <div style={{ fontSize: 13 }}>No notifications</div>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #2a2a4a',
                                    cursor: 'pointer',
                                    background: n.is_read ? 'transparent' : '#f97316' + '0d',
                                    transition: 'background 0.15s',
                                    display: 'flex', gap: 10, alignItems: 'flex-start',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
                                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : '#f9731608'}
                            >
                                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                                    {n.is_read ? '📭' : '📬'}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    color: n.is_read ? '#aaa' : '#fff',
                                    fontSize: 13, fontWeight: n.is_read ? 400 : 600,
                                    marginBottom: 3, lineHeight: 1.3,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {n.title}
                                </div>
                                <div style={{
                                    color: '#888',
                                    fontSize: 11,
                                    lineHeight: 1.4,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {n.message}
                                </div>
                                    <div style={{ color: '#555', fontSize: 10, marginTop: 4 }}>
                                        {formatTime(n.created_at)}
                                    </div>
                                </div>
                                {!n.is_read && (
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: '#f97316', flexShrink: 0, marginTop: 5,
                                    }} />
                                )}
                            </div>
                        ))
                    )}

                    {/* Footer link */}
                    {notifications.length > 0 && (
                        <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button onClick={() => { navigate('/low-stock'); setOpen(false); }}
                                style={{
                                    background: 'none', border: 'none',
                                    color: '#6c63ff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                                }}>
                                View Low Stock Report
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
