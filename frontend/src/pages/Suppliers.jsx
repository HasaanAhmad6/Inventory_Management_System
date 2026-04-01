import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import { modalActionStyles } from '../components/modalActionStyles';

const emptyForm = { name: '', email: '', phone: '', address: '' };

export default function Suppliers() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [suppliers, setSuppliers] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [search, setSearch] = useState('');

    const fetchSuppliers = () => {
        API.get('suppliers/').then(r => setSuppliers(r.data));
    };

    useEffect(() => { fetchSuppliers(); }, []);

    useEffect(() => {
        if (searchParams.get('openModal') !== 'supplier') return;
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowSupplierModal(true);
        const next = new URLSearchParams(searchParams);
        next.delete('openModal');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const openAddModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowSupplierModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!form.name.trim()) return setError('Supplier name is required');
        setLoading(true);
        try {
            if (editingId) {
                await API.put(`suppliers/${editingId}/`, form);
                setMessage('Supplier updated successfully!');
            } else {
                await API.post('suppliers/', form);
                setMessage('Supplier added successfully!');
            }
            setForm(emptyForm);
            setEditingId(null);
            setShowSupplierModal(false);
            fetchSuppliers();
        } catch (err) {
            setError(err.response?.data?.name?.[0] || 'Error saving supplier');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (sup) => {
        setEditingId(sup.id);
        setForm({ name: sup.name, email: sup.email || '', phone: sup.phone || '', address: sup.address || '' });
        setMessage('');
        setError('');
        setShowSupplierModal(true);
    };

    const handleDelete = (id) => {
        setItemToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await API.delete('suppliers/' + itemToDelete + '/');
            fetchSuppliers();
            setShowConfirm(false);
            setItemToDelete(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Error deleting item");
        }
    };

    const handleCloseModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowSupplierModal(false);
    };

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Suppliers</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
                        Manage your suppliers — each product can have a different supplier
                    </p>
                </div>

                <div style={styles.actionRow}>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/purchases?openModal=purchase')}>Record New Purchase</button>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/categories?openModal=category')}>Add New Category</button>
                    <button type="button" style={styles.actionBtnPrimary} onClick={openAddModal}>Add New Supplier</button>
                </div>

                {message && <div style={styles.success}>✅ {message}</div>}

                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        All Suppliers
                        <span style={styles.countBadge}>{suppliers.length}</span>
                    </div>

                    {suppliers.length > 3 && (
                        <div style={{ position: 'relative', marginBottom: 16 }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
                            <input
                                style={{ ...styles.input, paddingLeft: 36 }}
                                placeholder="Search suppliers..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <div style={styles.empty}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>🏭</div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>No suppliers yet</div>
                            <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>
                                Add your first supplier from the action button above
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filtered.map(sup => (
                                <div key={sup.id} style={styles.supRow}>
                                    <div style={styles.supIcon}>🏭</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
                                            {sup.name}
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                                            {sup.email && (
                                                <span style={styles.supDetail}>📧 {sup.email}</span>
                                            )}
                                            {sup.phone && (
                                                <span style={styles.supDetail}>📞 {sup.phone}</span>
                                            )}
                                        </div>
                                        {sup.address && (
                                            <div style={{ ...styles.supDetail, marginTop: 2 }}>
                                                📍 {sup.address}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button onClick={() => handleEdit(sup)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(sup.id)} style={styles.deleteBtn}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <FormModal
                open={showSupplierModal}
                title={editingId ? 'Edit Supplier' : 'Add New Supplier'}
                onClose={handleCloseModal}
                error={error}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" form="supplier-form" style={loading ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={loading}>
                            {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Supplier'}
                        </button>
                    </div>
                )}
            >
                <form id="supplier-form" onSubmit={handleSubmit}>
                    <div style={styles.field}>
                        <label style={styles.label}>Supplier / Company Name *</label>
                        <input
                            style={styles.input}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Tech Distributor Co."
                            required
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input
                            style={styles.input}
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="supplier@company.com"
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Phone</label>
                        <input
                            style={styles.input}
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            placeholder="e.g. 0300-1234567"
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Address</label>
                        <textarea
                            style={{ ...styles.input, height: 70, resize: 'vertical' }}
                            value={form.address}
                            onChange={e => setForm({ ...form, address: e.target.value })}
                            placeholder="Full address"
                        />
                    </div>
                </form>
            </FormModal>
        <ConfirmModal
                open={showConfirm}
                title="Delete Supplier"
                message="Are you sure you want to delete this supplier? Products linked to them will lose their supplier."
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirm(false)}
                confirmText="Delete"
            />
        </Layout>
    );
}

const styles = {
    card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a4a' },
    cardTitle: { fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #2a2a4a', display: 'flex', alignItems: 'center', gap: 8 },
    countBadge: { backgroundColor: '#14532d', color: '#86efac', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700, border: '1px solid #166534' },
    actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    actionBtn: { padding: '9px 14px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    actionBtnPrimary: { padding: '9px 14px', borderRadius: 8, border: '1px solid #15803d', backgroundColor: '#16A34A', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    success: { backgroundColor: '#F0FDF4', color: '#16A34A', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #BBF7D0' },
    field: { marginBottom: 14 },
    label: { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#cbd5e1' },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a', backgroundColor: '#0f0f23', color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    empty: { textAlign: 'center', padding: '40px 20px' },
    supRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a4a', backgroundColor: '#0f0f23' },
    supIcon: { fontSize: 20, width: 38, height: 38, backgroundColor: '#1a1a2e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, border: '1px solid #2a2a4a' },
    supDetail: { color: '#94A3B8', fontSize: 12 },
    editBtn: { backgroundColor: '#172554', color: '#93c5fd', border: '1px solid #1e3a8a', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    deleteBtn: { backgroundColor: '#2b1014', color: '#f87171', border: '1px solid #7f1d1d', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
};

