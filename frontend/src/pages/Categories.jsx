import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import { modalActionStyles } from '../components/modalActionStyles';

const emptyForm = { name: '', description: '' };

export default function Categories() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [pageError, setPageError] = useState('');

    const fetchCategories = () => {
        API.get('categories/')
            .then(r => {
                setCategories(r.data);
                setPageError('');
            })
            .catch(err => {
                setPageError(err.response?.data?.detail || 'Failed to load categories');
            });
    };

    useEffect(() => { fetchCategories(); }, []);

    useEffect(() => {
        if (searchParams.get('openModal') !== 'category') return;
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowCategoryModal(true);
        const next = new URLSearchParams(searchParams);
        next.delete('openModal');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const openAddModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowCategoryModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!form.name.trim()) return setError('Category name is required');
        setLoading(true);
        try {
            if (editingId) {
                await API.put(`categories/${editingId}/`, form);
                setMessage('Category updated successfully!');
            } else {
                await API.post('categories/', form);
                setMessage('Category added successfully!');
            }
            setForm(emptyForm);
            setEditingId(null);
            setShowCategoryModal(false);
            fetchCategories();
        } catch (err) {
            setError(err.response?.data?.name?.[0] || 'Error saving category');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (cat) => {
        setEditingId(cat.id);
        setForm({ name: cat.name, description: cat.description || '' });
        setMessage('');
        setError('');
        setShowCategoryModal(true);
    };

    const handleDelete = (id) => {
        setItemToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await API.delete('categories/' + itemToDelete + '/');
            fetchCategories();
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
        setShowCategoryModal(false);
    };

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                {pageError && (
                    <div style={{ maxWidth: 1100, margin: '0 auto 16px', background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 10, padding: 12 }}>
                        ⚠️ {pageError}
                    </div>
                )}

                <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Categories</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
                        Manage product categories — add as many as you need
                    </p>
                </div>

                <div style={styles.actionRow}>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/purchases?openModal=purchase')}>Record New Purchase</button>
                    <button type="button" style={styles.actionBtnPrimary} onClick={openAddModal}>Add New Category</button>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/suppliers?openModal=supplier')}>Add New Supplier</button>
                </div>

                {message && <div style={styles.success}>✅ {message}</div>}

                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        All Categories
                        <span style={styles.countBadge}>{categories.length}</span>
                    </div>

                    {categories.length === 0 ? (
                        <div style={styles.empty}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>🗂</div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>No categories yet</div>
                            <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>Add your first category from the action button above</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {categories.map(cat => (
                                <div key={cat.id} style={styles.catRow}>
                                    <div style={styles.catIcon}>🗂</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>{cat.name}</div>
                                        {cat.description && (
                                            <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>{cat.description}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleEdit(cat)} style={styles.editBtn}>Edit</button>
                                        <button onClick={() => handleDelete(cat.id)} style={styles.deleteBtn}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <FormModal
                open={showCategoryModal}
                title={editingId ? 'Edit Category' : 'Add New Category'}
                onClose={handleCloseModal}
                error={error}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" form="category-form" style={loading ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={loading}>
                            {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Category'}
                        </button>
                    </div>
                )}
            >
                <form id="category-form" onSubmit={handleSubmit}>
                    <div style={styles.field}>
                        <label style={styles.label}>Category Name *</label>
                        <input
                            style={styles.input}
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Electronics, Furniture, Clothing"
                            required
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Description</label>
                        <textarea
                            style={{ ...styles.input, height: 80, resize: 'vertical' }}
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Optional description"
                        />
                    </div>
                </form>
            </FormModal>
        <ConfirmModal
                open={showConfirm}
                title="Delete Category"
                message="Are you sure you want to delete this category? Products using it will lose their category."
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
    countBadge: { backgroundColor: '#172554', color: '#93c5fd', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700, border: '1px solid #1e3a8a' },
    actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    actionBtn: { padding: '9px 14px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    actionBtnPrimary: { padding: '9px 14px', borderRadius: 8, border: '1px solid #1d4ed8', backgroundColor: '#1E40AF', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    success: { backgroundColor: '#F0FDF4', color: '#16A34A', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #BBF7D0' },
    field: { marginBottom: 14 },
    label: { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#cbd5e1' },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: 14, boxSizing: 'border-box', outline: 'none', backgroundColor: '#0f0f23', color: '#fff' },
    empty: { textAlign: 'center', padding: '40px 20px' },
    catRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a4a', backgroundColor: '#0f0f23' },
    catIcon: { fontSize: 22, width: 36, height: 36, backgroundColor: '#1a1a2e', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #2a2a4a' },
    editBtn: { backgroundColor: '#172554', color: '#93c5fd', border: '1px solid #1e3a8a', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
    deleteBtn: { backgroundColor: '#2b1014', color: '#f87171', border: '1px solid #7f1d1d', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
};

