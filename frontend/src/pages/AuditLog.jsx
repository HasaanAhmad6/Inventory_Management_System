import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import API from '../api/axios';

const ACTION_COLORS = {
    CREATE: { bg: '#16a34a22', color: '#4ade80', border: '#16a34a44' },
    UPDATE: { bg: '#d9770622', color: '#fbbf24', border: '#d9770644' },
    DELETE: { bg: '#dc262622', color: '#f87171', border: '#dc262644' },
};

const MODEL_OPTIONS = ['Product', 'Category', 'Supplier', 'Purchase', 'Sale', 'User'];
const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE'];

export default function AuditLog() {
    const [logs, setLogs]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [filterAction, setFilterAction] = useState('');
    const [filterModel, setFilterModel]   = useState('');
    const [filterUser, setFilterUser]     = useState('');

    useEffect(() => {
        let active = true;
        const params = {};
        if (filterAction) params.action = filterAction;
        if (filterModel) params.model_name = filterModel;
        if (filterUser) params.username = filterUser;
        API.get('audit-logs/', { params })
            .then(res => {
                if (active) setLogs(res.data?.results ?? res.data);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [filterAction, filterModel, filterUser]);

    const fmt = (iso) => {
        const d = new Date(iso);
        return d.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const selectStyle = {
        background: '#0f0f23', border: '1px solid #2a2a4a', color: '#ccc',
        borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer',
    };

    return (
        <Layout>
            <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>
                        🕵️ Audit Log
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
                        Full activity trail — who changed what and when.
                    </p>
                </div>

                {/* Filters */}
                <div style={{
                    display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20,
                    background: '#1a1a2e', padding: 16, borderRadius: 12,
                    border: '1px solid #2a2a4a'
                }}>
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selectStyle}>
                        <option value="">All Actions</option>
                        {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={selectStyle}>
                        <option value="">All Models</option>
                        {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input
                        placeholder="Filter by username…"
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        style={{ ...selectStyle, minWidth: 180 }}
                    />
                    {(filterAction || filterModel || filterUser) && (
                        <button
                            onClick={() => { setFilterAction(''); setFilterModel(''); setFilterUser(''); }}
                            style={{
                                background: '#ffffff10', border: '1px solid #2a2a4a',
                                color: '#94a3b8', borderRadius: 8, padding: '8px 14px',
                                fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Table */}
                <div style={{ background: '#1a1a2e', borderRadius: 14, border: '1px solid #2a2a4a', overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading...</div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>No audit log entries found.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                                    {['Timestamp', 'User', 'Action', 'Model', 'Object'].map(h => (
                                        <th key={h} style={{
                                            textAlign: 'left', padding: '12px 16px',
                                            color: '#64748b', fontWeight: 600,
                                            fontSize: 11, textTransform: 'uppercase', letterSpacing: 1
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => {
                                    const c = ACTION_COLORS[log.action] || {};
                                    return (
                                        <tr key={log.id} style={{
                                            borderBottom: '1px solid #2a2a4a',
                                            background: i % 2 === 0 ? 'transparent' : '#ffffff04'
                                        }}>
                                            <td style={{ padding: '11px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                {fmt(log.timestamp)}
                                            </td>
                                            <td style={{ padding: '11px 16px', color: '#a89cff', fontWeight: 600 }}>
                                                {log.username || '—'}
                                            </td>
                                            <td style={{ padding: '11px 16px' }}>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 20,
                                                    background: c.bg, color: c.color,
                                                    border: `1px solid ${c.border}`,
                                                    fontWeight: 700, fontSize: 11
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '11px 16px', color: '#60a5fa', fontWeight: 500 }}>
                                                {log.model_name}
                                            </td>
                                            <td style={{ padding: '11px 16px', color: '#e2e8f0', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.object_repr}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <p style={{ marginTop: 12, color: '#475569', fontSize: 12 }}>
                    Showing {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
                </p>
            </div>
        </Layout>
    );
}
