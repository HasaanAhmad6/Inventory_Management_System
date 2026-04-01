import { useEffect } from 'react';
import useBreakpoint from '../hooks/useBreakpoint';

export default function FormModal({ open, title, onClose, error, maxWidth = 560, children, footer }) {
    const { isMobile, isTablet } = useBreakpoint();

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const computedMaxWidth = isMobile ? Math.min(420, maxWidth) : (isTablet ? Math.min(520, maxWidth) : maxWidth);

    return (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{ ...styles.modal, maxWidth: computedMaxWidth, padding: isMobile ? 16 : 24 }}>
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>{title}</h3>
                    <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Close modal">
                        ✕
                    </button>
                </div>
                {error && <div style={styles.modalError}>⚠️ {error}</div>}
                {children}
                {footer}
            </div>
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
    modal: { background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 16, width: '100%', maxHeight: 'min(88vh, 760px)', overflowY: 'auto' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 },
    closeBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', lineHeight: 1, minWidth: 36, minHeight: 36 },
    modalError: { background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 },
};
