import { useEffect } from 'react';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", isDanger = true }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
            <div style={styles.modal}>
                <div style={styles.modalHeader}>
                    <h3 style={styles.modalTitle}>{title}</h3>
                    <button type="button" style={styles.closeBtn} onClick={onCancel} aria-label="Close modal">
                        ✕
                    </button>
                </div>
                <div style={styles.modalBody}>
                    <p style={styles.message}>{message}</p>
                </div>
                <div style={styles.modalFooter}>
                    <button type="button" style={styles.cancelBtn} onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button 
                        type="button" 
                        style={isDanger ? styles.dangerBtn : styles.confirmBtn} 
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: { 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.8)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 10000, 
        padding: 16,
        backdropFilter: 'blur(4px)'
    },
    modal: { 
        background: '#1a1a2e', 
        border: '1px solid #2a2a4a', 
        borderRadius: 16, 
        width: '100%', 
        maxWidth: 400,
        padding: 24,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
    },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 },
    closeBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', lineHeight: 1 },
    modalBody: { marginBottom: 24 },
    message: { color: '#94a3b8', fontSize: 15, lineHeight: 1.5, margin: 0 },
    modalFooter: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
    cancelBtn: { 
        padding: '10px 16px', 
        background: '#334155', 
        color: 'white', 
        border: 'none', 
        borderRadius: 8, 
        cursor: 'pointer', 
        fontWeight: 600, 
        fontSize: 14 
    },
    confirmBtn: { 
        padding: '10px 16px', 
        background: '#16A34A', 
        color: 'white', 
        border: 'none', 
        borderRadius: 8, 
        cursor: 'pointer', 
        fontWeight: 600, 
        fontSize: 14 
    },
    dangerBtn: { 
        padding: '10px 16px', 
        background: '#DC2626', 
        color: 'white', 
        border: 'none', 
        borderRadius: 8, 
        cursor: 'pointer', 
        fontWeight: 600, 
        fontSize: 14 
    },
};
