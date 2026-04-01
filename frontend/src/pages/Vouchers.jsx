import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import API from '../api/axios';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';

const emptyForm = { 
    code: '', 
    voucher_type: 'percentage', 
    discount_value: '', 
    max_discount: '',
    min_spend: '0', 
    limit_usage: '1',
    expiry_date: '',
    is_active: true,
    specific_product: '',
    specific_customer: ''
};

export default function Vouchers() {
    const [vouchers, setVouchers] = useState([]);
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [pageError, setPageError] = useState('');

    const fetchVouchers = () => {
        API.get('vouchers/')
            .then(r => {
                setVouchers(r.data);
                setPageError('');
            })
            .catch(err => {
                setPageError(err.response?.data?.detail || 'Failed to load vouchers');
            });
    };

    const fetchProducts = () => {
        API.get('products/')
            .then(r => setProducts(r.data))
            .catch(err => console.error('Failed to load products', err));
    };

    useEffect(() => {
        fetchVouchers();
        fetchProducts();
    }, []);

    const openAddModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowModal(true);
    };

    const openEditModal = (v) => {
        setEditingId(v.id);
        setForm({
            code: v.code,
            voucher_type: v.voucher_type,
            discount_value: v.discount_value,
            max_discount: v.max_discount || '',
            min_spend: v.min_spend,
            limit_usage: v.limit_usage,
            expiry_date: v.expiry_date ? v.expiry_date.split('T')[0] : '',
            is_active: v.is_active,
            specific_product: v.specific_product || '',
            specific_customer: v.specific_customer || ''
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const data = { ...form };
        if (!data.specific_product) data.specific_product = null;
        if (!data.max_discount || data.voucher_type !== 'percentage') data.max_discount = null;

        // Ensure proper date format for Django
        if (data.expiry_date && !data.expiry_date.includes('T')) {
            data.expiry_date = `${data.expiry_date}T23:59:59Z`;
        }

        const request = editingId
            ? API.put(`vouchers/${editingId}/`, data)
            : API.post('vouchers/', data);

        request
            .then(() => {
                setMessage(`Voucher ${editingId ? 'updated' : 'created'} successfully!`);
                fetchVouchers();
                setShowModal(false);
            })
            .catch(err => {
                const detail = err.response?.data?.detail || 'Something went wrong';
                setError(typeof detail === 'object' ? JSON.stringify(detail) : detail);
            })
            .finally(() => setLoading(false));
    };

    const handleDelete = (id) => {
        setItemToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await API.delete('vouchers/' + itemToDelete + '/');
            fetchVouchers();
            setShowConfirm(false);
            setItemToDelete(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Error deleting item");
        }
    };

    const formatMoney = (val) => Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

    return (
        <Layout title="Vouchers">
            <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Voucher Management</h2>
                        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Create and manage discount codes for your customers</p>
                    </div>
                    <button onClick={openAddModal} style={styles.addBtn}>+ Create Voucher</button>
                </div>

                {message && <div style={styles.success}>✅ {message}</div>}
                {pageError && <div style={styles.error}>⚠️ {pageError}</div>}

                <div style={styles.card}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={{ backgroundColor: '#0f0f23' }}>
                                    {['Code', 'Type', 'Value', 'Min Spend', 'Cap', 'Target', 'Usage', 'Expiry', 'Status', 'Actions'].map(h => (
                                        <th key={h} style={styles.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vouchers.length === 0 ? (
                                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No vouchers found.</td></tr>
                                ) : vouchers.map(v => (
                                    <tr key={v.id} style={{ borderBottom: '1px solid #2a2a4a' }}>
                                        <td style={styles.td}><code style={{ color: '#86efac', fontWeight: 700, fontSize: 14 }}>{v.code}</code></td>
                                        <td style={styles.td}>{v.voucher_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</td>
                                        <td style={styles.td}>{v.voucher_type === 'percentage' ? `${v.discount_value}%` : `Rs. ${formatMoney(v.discount_value)}`}</td>
                                        <td style={styles.td}>Rs. {formatMoney(v.min_spend)}</td>
                                        <td style={styles.td}>{v.max_discount ? `Rs. ${formatMoney(v.max_discount)}` : '—'}</td>
                                        <td style={styles.td}>
                                            {v.specific_product_name && <div style={{fontSize: 12, color: '#93c5fd'}}>Prod: {v.specific_product_name}</div>}
                                            {v.specific_customer && <div style={{fontSize: 12, color: '#f9a8d4'}}>Cust: {v.specific_customer}</div>}
                                            {!v.specific_product && !v.specific_customer && <span style={{color: '#64748B'}}>General</span>}
                                        </td>
                                        <td style={styles.td}>{v.used_count} / {v.limit_usage}</td>
                                        <td style={styles.td}>{new Date(v.expiry_date).toLocaleDateString()}</td>
                                        <td style={styles.td}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                backgroundColor: v.is_active ? '#16A34A22' : '#DC262622',
                                                color: v.is_active ? '#86efac' : '#fca5a5'
                                            }}>
                                                {v.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button onClick={() => openEditModal(v)} style={styles.editBtn}>Edit</button>
                                                <button onClick={() => handleDelete(v.id)} style={styles.deleteBtn}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <FormModal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingId ? 'Edit Voucher' : 'Create Voucher'}
            >
                <form onSubmit={handleSubmit}>
                    {error && <div style={styles.error}>{error}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={styles.label}>Target Product (Optional)</label>
                            <select
                                style={styles.input}
                                value={form.specific_product}
                                onChange={e => setForm({...form, specific_product: e.target.value})}
                            >
                                <option value="">--- All Products ---</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={styles.label}>Target Customer Name (Optional)</label>
                            <input
                                style={styles.input}
                                value={form.specific_customer}
                                onChange={e => setForm({...form, specific_customer: e.target.value})}
                                placeholder="E.g. John Doe"
                            />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={styles.label}>Voucher Code *</label>
                            <input
                                style={styles.input}
                                value={form.code}
                                onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
                                placeholder="E.g. SUMMER20"
                                required
                            />
                        </div>
                        <div>
                            <label style={styles.label}>Type</label>
                            <select
                                style={styles.input}
                                value={form.voucher_type}
                                onChange={e => setForm({...form, voucher_type: e.target.value})}
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (Rs.)</option>
                            </select>
                        </div>
                        <div>
                            <label style={styles.label}>Discount Value *</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={form.discount_value}
                                onChange={e => setForm({...form, discount_value: e.target.value})}
                                required
                            />
                        </div>
                        {form.voucher_type === 'percentage' && (
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={styles.label}>Capital (Max Discount Rs.) - Optional</label>
                                <input
                                    type="number"
                                    style={styles.input}
                                    value={form.max_discount}
                                    onChange={e => setForm({...form, max_discount: e.target.value})}
                                    placeholder="Max amount to discount (E.g. 500)"
                                />
                            </div>
                        )}
                        <div>
                            <label style={styles.label}>Min Spend (Rs.)</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={form.min_spend}
                                onChange={e => setForm({...form, min_spend: e.target.value})}
                            />
                        </div>
                        <div>
                            <label style={styles.label}>Usage Limit</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={form.limit_usage}
                                onChange={e => setForm({...form, limit_usage: e.target.value})}
                            />
                        </div>
                        <div>
                            <label style={styles.label}>Expiry Date *</label>
                            <input
                                type="date"
                                style={styles.input}
                                value={form.expiry_date}
                                onChange={e => setForm({...form, expiry_date: e.target.value})}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={e => setForm({...form, is_active: e.target.checked})}
                                id="is_active"
                            />
                            <label htmlFor="is_active" style={{ ...styles.label, marginBottom: 0 }}>Active</label>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                        <button type="submit" disabled={loading} style={styles.submitBtn}>
                            {loading ? 'Saving...' : editingId ? 'Update Voucher' : 'Create Voucher'}
                        </button>
                        <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>Cancel</button>
                    </div>
                </form>
            </FormModal>
        <ConfirmModal
                open={showConfirm}
                title="Delete Voucher"
                message="Are you sure you want to delete this voucher?"
                onConfirm={confirmDelete}
                onCancel={() => setShowConfirm(false)}
                confirmText="Delete"
            />
        </Layout>
    );
}

const styles = {
    card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 0, border: '1px solid #2a2a4a', overflow: 'hidden' },
    addBtn: { padding: '10px 20px', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },
    success: { backgroundColor: '#16A34A22', color: '#86efac', padding: '12px 16px', borderRadius: 8, marginBottom: 20, border: '1px solid #16A34A44' },
    error: { backgroundColor: '#DC262622', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 20, border: '1px solid #DC262644' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    td: { padding: '14px 16px', color: '#E2E8F0', fontSize: 14 },
    editBtn: { background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f644', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    deleteBtn: { background: 'transparent', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    label: { display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#cbd5e1' },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: 14, backgroundColor: '#0f0f23', color: '#fff', outline: 'none' },
    submitBtn: { flex: 1, padding: '12px', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },       
    cancelBtn: { flex: 1, padding: '12px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 },       
};
