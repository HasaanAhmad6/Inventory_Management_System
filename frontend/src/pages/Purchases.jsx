import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import ScanInput from '../components/ScanInput';
import FormModal from '../components/FormModal';
import { modalActionStyles } from '../components/modalActionStyles';
import { useAuth } from '../context/AuthContext';

const defaultForm = {
    product: '',
    quantity: '',
    unit_cost: '',
    full_selling_price: '',
    discount_percent: '0',
    selling_price: '',
    notes: '',
};

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

export default function Purchases() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { can } = useAuth();
    const [purchases, setPurchases] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchaseAuditHistory, setPurchaseAuditHistory] = useState([]);
    const [purchaseAuditLoading, setPurchaseAuditLoading] = useState(true);
    const [purchaseAuditError, setPurchaseAuditError] = useState('');
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [editPurchaseId, setEditPurchaseId] = useState(null);
    const [form, setForm] = useState(defaultForm);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [scanClearSignal, setScanClearSignal] = useState(0);

    const fetchData = () => {
        API.get('purchases/').then(r => setPurchases(r.data));
        API.get('products/').then(r => setProducts(r.data));
    };

    const fetchPurchaseAuditHistory = () => {
        if (!(can('audit.view') || can('purchases.manage'))) {
            setPurchaseAuditLoading(false);
            return;
        }
        setPurchaseAuditLoading(true);
        setPurchaseAuditError('');
        API.get('audit-logs/', {
            params: { action: 'UPDATE', model_name: 'Purchase' },
        })
            .then((res) => {
                setPurchaseAuditHistory(res.data?.results ?? res.data ?? []);
            })
            .catch((err) => {
                setPurchaseAuditError(err.response?.data?.detail || 'Failed to load purchase edit history.');
            })
            .finally(() => setPurchaseAuditLoading(false));
    };

    useEffect(() => {
        fetchData();
        fetchPurchaseAuditHistory();
    }, []);

    useEffect(() => {
        const full = toNumber(form.full_selling_price, 0);
        const discount = Math.min(100, Math.max(0, toNumber(form.discount_percent, 0)));
        const discounted = Number((full * (1 - (discount / 100))).toFixed(2));
        setForm(prev => ({ ...prev, selling_price: String(discounted) }));
    }, [form.full_selling_price, form.discount_percent]);

    useEffect(() => {
        if (searchParams.get('openModal') !== 'purchase') return;
        setForm(defaultForm);
        setEditPurchaseId(null);
        setError('');
        setScanMessage('');
        setShowPurchaseModal(true);
        const next = new URLSearchParams(searchParams);
        next.delete('openModal');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const openPurchaseModal = () => {
        setForm(defaultForm);
        setEditPurchaseId(null);
        setError('');
        setScanMessage('');
        setScanClearSignal(prev => prev + 1);
        setShowPurchaseModal(true);
    };

    const openEditPurchaseModal = (purchase) => {
        setEditPurchaseId(purchase.id);
        setForm({
            product: String(purchase.product),
            quantity: String(purchase.quantity ?? ''),
            unit_cost: String(purchase.unit_cost ?? ''),
            full_selling_price: String(purchase.full_selling_price ?? purchase.selling_price ?? ''),
            discount_percent: String(purchase.discount_percent ?? 0),
            selling_price: String(purchase.selling_price ?? ''),
            notes: purchase.notes ?? '',
        });
        setError('');
        setMessage('');
        setScanMessage('');
        setShowPurchaseModal(true);
    };

    const closePurchaseModal = () => {
        setShowPurchaseModal(false);
        setEditPurchaseId(null);
        setError('');
        setScanMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const payload = {
                ...form,
                discount_percent: String(Math.min(100, Math.max(0, toNumber(form.discount_percent, 0)))),
            };
            if (editPurchaseId) {
                await API.patch(`purchases/${editPurchaseId}/`, payload);
                setMessage('Purchase updated successfully! Stock has been adjusted.');
            } else {
                await API.post('purchases/', payload);
                setMessage('Purchase recorded successfully! Stock has been updated.');
            }
            setForm(defaultForm);
            setEditPurchaseId(null);
            setScanMessage('');
            setScanClearSignal(prev => prev + 1);
            setShowPurchaseModal(false);
            fetchData();
            fetchPurchaseAuditHistory();
        } catch (err) {
            setError(err.response?.data?.detail || (editPurchaseId ? 'Error updating purchase' : 'Error recording purchase'));
        } finally {
            setLoading(false);
        }
    };

    const handlePurchaseScan = async (raw) => {
        setError('');
        setMessage('');
        setScanMessage('');
        const q = String(raw || '').trim();
        if (!q) return;
        try {
            const res = await API.get(`products/scan/?q=${encodeURIComponent(q)}`);
            const product = res.data;
            setForm(prev => ({
                ...prev,
                product: String(product.id),
                unit_cost: product.price ?? '',
                full_selling_price: product.full_price ?? product.sale_price ?? '',
                discount_percent: '0',
            }));
            setScanMessage(`Scanned: ${product.name} (${product.sku}). Enter quantity and save.`);
        } catch (err) {
            setError(err.response?.data?.detail || 'No product matched this code.');
        }
    };

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Purchases</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>Record incoming stock from suppliers</p>
                </div>

                <div style={styles.actionRow}>
                    <button type="button" style={styles.actionBtnPrimary} onClick={openPurchaseModal}>Record New Purchase</button>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/categories?openModal=category')}>Add New Category</button>
                    <button type="button" style={styles.actionBtn} onClick={() => navigate('/suppliers?openModal=supplier')}>Add New Supplier</button>
                </div>

                {message && <div style={styles.success}>✅ {message}</div>}

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Purchase History ({purchases.length} records)</div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={{ backgroundColor: '#0f0f23' }}>
                                    {['Product', 'Quantity', 'Unit Cost', 'Effective Price', 'Full/Discount', 'Total', 'Date', 'Notes', 'Actions'].map(h => (
                                        <th key={h} style={styles.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {purchases.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No purchases yet</td></tr>
                                ) : purchases.map((p, i) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #2a2a4a', backgroundColor: i % 2 === 0 ? '#14142b' : '#0f0f23' }}>
                                        <td style={styles.td}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/products?focusProductId=${p.product}`)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    margin: 0,
                                                    color: '#93c5fd',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    fontSize: 14,
                                                    textDecoration: 'underline',
                                                    textUnderlineOffset: 2,
                                                }}
                                            >
                                                {p.product_name}
                                            </button>
                                        </td>
                                        <td style={styles.td}><span style={styles.qtyBadge}>{p.quantity}</span></td>
                                        <td style={styles.td}>Rs. {Number(p.unit_cost).toLocaleString()}</td>
                                        <td style={styles.td}>Rs. {Number(p.selling_price).toLocaleString()}</td>
                                        <td style={styles.td}>
                                            {p.full_selling_price ? (
                                                <>
                                                    Rs. {Number(p.full_selling_price).toLocaleString()}
                                                    <div style={{ fontSize: 12, color: '#94A3B8' }}>
                                                        {Number(p.discount_percent || 0).toLocaleString()}% off
                                                    </div>
                                                </>
                                            ) : <span style={{ color: '#64748B' }}>—</span>}
                                        </td>
                                        <td style={styles.td}><span style={{ fontWeight: 600 }}>Rs. {(p.quantity * p.unit_cost).toLocaleString()}</span></td>
                                        <td style={styles.td}>{new Date(p.date).toLocaleDateString()}</td>
                                        <td style={styles.td}>{p.notes || <span style={{ color: '#64748B' }}>—</span>}</td>
                                        <td style={styles.td}>
                                            {can('purchases.manage') ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openEditPurchaseModal(p)}
                                                    style={styles.editBtn}
                                                >
                                                    Edit
                                                </button>
                                            ) : (
                                                <span style={{ color: '#64748B' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {(can('audit.view') || can('purchases.manage')) && (
                    <div style={{ ...styles.card, marginTop: 20 }}>
                        <div style={styles.cardTitle}>Purchase Edit History</div>
                        {purchaseAuditLoading ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Loading edit history...</div>
                        ) : purchaseAuditError ? (
                            <div style={{ color: '#fca5a5', padding: '8px 0' }}>{purchaseAuditError}</div>
                        ) : purchaseAuditHistory.length === 0 ? (
                            <div style={{ color: '#94A3B8' }}>No purchase edits have been recorded yet.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                                {purchaseAuditHistory.slice(0, 8).map((entry) => (
                                    <div
                                        key={entry.id}
                                        style={{
                                            background: '#0f0f23',
                                            border: '1px solid #2a2a4a',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                            <div style={{ color: '#a89cff', fontWeight: 700, fontSize: 13 }}>
                                                {entry.username || 'System'} updated Purchase #{entry.object_id}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                                {new Date(entry.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                                            {entry.object_repr}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <FormModal
                open={showPurchaseModal}
                title={editPurchaseId ? 'Edit Purchase' : 'Record New Purchase'}
                onClose={closePurchaseModal}
                error={error}
                maxWidth={680}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={closePurchaseModal}>Cancel</button>
                        <button type="submit" form="purchase-form" style={loading ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={loading}>
                            {loading ? 'Saving...' : (editPurchaseId ? 'Save Changes' : '+ Record Purchase')}
                        </button>
                    </div>
                )}
            >
                <ScanInput
                    label="Scan Product"
                    placeholder="Scan barcode/QR or type code"
                    onScan={handlePurchaseScan}
                    clearSignal={scanClearSignal}
                />
                {scanMessage && <div style={styles.scanInfo}>ℹ️ {scanMessage}</div>}
                <form id="purchase-form" onSubmit={handleSubmit}>
                    <Field label="Product *">
                        <select
                            style={styles.input}
                            value={form.product}
                            onChange={e => {
                                const pid = e.target.value;
                                const prod = products.find(p => String(p.id) === String(pid));
                                setForm({
                                    ...form,
                                    product: pid,
                                    unit_cost: prod?.price ?? form.unit_cost,
                                    full_selling_price: prod?.full_price ?? prod?.sale_price ?? form.full_selling_price,
                                    discount_percent: String(prod?.discount_percent ?? form.discount_percent),
                                });
                            }}
                            required
                        >
                            <option value="">Select product</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (Stock: {p.stock?.quantity ?? 0})
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Quantity *">
                        <input style={styles.input} type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                    </Field>
                    <Field label="Unit Cost (Rs.) *">
                        <input style={styles.input} type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} required />
                    </Field>
                    <Field label="Full Selling Price (Rs.) *">
                        <input style={styles.input} type="number" min="0" step="0.01" value={form.full_selling_price} onChange={e => setForm({ ...form, full_selling_price: e.target.value })} required />
                    </Field>
                    <Field label="Discount (%)">
                        <input style={styles.input} type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} />
                    </Field>
                    <Field label="Effective Selling Price (Rs.)">
                        <input style={styles.input} type="number" value={form.selling_price} readOnly />
                    </Field>
                    <Field label="Notes">
                        <input style={styles.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
                    </Field>
                </form>
            </FormModal>
        </Layout>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#cbd5e1' }}>{label}</label>
            {children}
        </div>
    );
}

const styles = {
    card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 24, border: '1px solid #2a2a4a' },
    cardTitle: { fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #2a2a4a' },
    actionRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    actionBtn: { padding: '9px 14px', borderRadius: 8, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    actionBtnPrimary: { padding: '9px 14px', borderRadius: 8, border: '1px solid #6d28d9', backgroundColor: '#7C3AED', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    success: { backgroundColor: '#F0FDF4', color: '#16A34A', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #BBF7D0' },
    scanInfo: { backgroundColor: '#17255466', color: '#93c5fd', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, border: '1px solid #1e3a8a' },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a', backgroundColor: '#0f0f23', color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 680 },
    th: { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    td: { padding: '12px 14px', color: '#E2E8F0', fontSize: 14 },
    qtyBadge: { backgroundColor: '#172554', color: '#93c5fd', padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: '1px solid #1e3a8a' },
    editBtn: { backgroundColor: '#172554', color: '#93c5fd', border: '1px solid #1e3a8a', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 },
};

