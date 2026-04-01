import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import ScanInput from '../components/ScanInput';
import FormModal from '../components/FormModal';
import { modalActionStyles } from '../components/modalActionStyles';

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

const computeDiscountedPrice = (fullPrice, discountPercent) => {
    const full = toNumber(fullPrice, 0);
    const discount = Math.min(100, Math.max(0, toNumber(discountPercent, 0)));
    return Number((full * (1 - (discount / 100))).toFixed(2));
};

export default function Purchases() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [purchases, setPurchases] = useState([]);
    const [products, setProducts] = useState([]);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
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

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const discounted = computeDiscountedPrice(form.full_selling_price, form.discount_percent);
        setForm(prev => ({ ...prev, selling_price: String(discounted) }));
    }, [form.full_selling_price, form.discount_percent]);

    useEffect(() => {
        if (searchParams.get('openModal') !== 'purchase') return;
        setForm(defaultForm);
        setError('');
        setScanMessage('');
        setShowPurchaseModal(true);
        const next = new URLSearchParams(searchParams);
        next.delete('openModal');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const openPurchaseModal = () => {
        setForm(defaultForm);
        setError('');
        setScanMessage('');
        setScanClearSignal(prev => prev + 1);
        setShowPurchaseModal(true);
    };

    const closePurchaseModal = () => {
        setShowPurchaseModal(false);
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
                selling_price: String(computeDiscountedPrice(form.full_selling_price, form.discount_percent)),
            };
            await API.post('purchases/', payload);
            setMessage('Purchase recorded successfully! Stock has been updated.');
            setForm(defaultForm);
            setScanMessage('');
            setScanClearSignal(prev => prev + 1);
            setShowPurchaseModal(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.detail || 'Error recording purchase');
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
                discount_percent: String(product.discount_percent ?? 0),
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
                                    {['Product', 'Quantity', 'Unit Cost', 'Effective Price', 'Full/Discount', 'Total', 'Date', 'Notes'].map(h => (
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <FormModal
                open={showPurchaseModal}
                title="Record New Purchase"
                onClose={closePurchaseModal}
                error={error}
                maxWidth={680}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={closePurchaseModal}>Cancel</button>
                        <button type="submit" form="purchase-form" style={loading ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={loading}>
                            {loading ? 'Saving...' : '+ Record Purchase'}
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
};

