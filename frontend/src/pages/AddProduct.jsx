import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Barcode from 'react-barcode';
import { QRCodeCanvas } from 'qrcode.react';
import Layout from '../components/Layout';
import API from '../api/axios';
import ScanInput from '../components/ScanInput';

export default function AddProduct() {
    const [form, setForm] = useState({
        name: '',
        sku: '',
        description: '',
        category: '',
        supplier: '',
        full_price: '',
        discount_percent: '0',
        low_stock_threshold: '10',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Quick-add modal state
    const [showCatModal, setShowCatModal] = useState(false);
    const [showSupModal, setShowSupModal] = useState(false);
    const [quickCat, setQuickCat] = useState('');
    const [quickSup, setQuickSup] = useState({ name: '', email: '', phone: '', address: '' });
    const [quickLoading, setQuickLoading] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [codeMode, setCodeMode] = useState('generate');

    const fetchDropdowns = () => {
        API.get('categories/').then(r => setCategories(r.data));
        API.get('suppliers/').then(r => setSuppliers(r.data));
    };

    useEffect(() => { fetchDropdowns(); }, []);

    const generateSKU = (name) => {
        if (!name) return '';
        const words = name.trim().toUpperCase().split(' ');
        const prefix = words.map(w => w[0]).join('').slice(0, 3);
        const number = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${number}`;
    };

    const handleNameChange = (value) => {
        setForm(prev => ({
            ...prev,
            name: value,
            sku: codeMode === 'generate' ? generateSKU(value) : prev.sku,
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError('');
    };

    // Quick-add category
    const handleQuickAddCategory = async () => {
        if (!quickCat.trim()) return;
        setQuickLoading(true);
        try {
            const res = await API.post('categories/', { name: quickCat.trim(), description: '' });
            await fetchDropdowns();
            setForm(prev => ({ ...prev, category: String(res.data.id) }));
            setQuickCat('');
            setShowCatModal(false);
        } catch (e) {
            alert('Error adding category: ' + JSON.stringify(e.response?.data));
        } finally {
            setQuickLoading(false);
        }
    };

    // Quick-add supplier
    const handleQuickAddSupplier = async () => {
        if (!quickSup.name.trim()) return;
        setQuickLoading(true);
        try {
            const res = await API.post('suppliers/', quickSup);
            await fetchDropdowns();
            setForm(prev => ({ ...prev, supplier: String(res.data.id) }));
            setQuickSup({ name: '', email: '', phone: '', address: '' });
            setShowSupModal(false);
        } catch (e) {
            alert('Error adding supplier: ' + JSON.stringify(e.response?.data));
        } finally {
            setQuickLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) return setError('Product name is required');
        const discountPercent = Number(form.discount_percent || 0);
        const fullPrice = Number(form.full_price || 0);
        if (!Number.isFinite(fullPrice) || fullPrice < 0) return setError('Full price must be 0 or greater');
        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return setError('Discount must be between 0 and 100');
        if (Number(form.low_stock_threshold) < 0) return setError('Low stock threshold cannot be negative');
        setLoading(true);
        try {
            const data = new FormData();
            const discountedPrice = Math.max(0, fullPrice * (1 - discountPercent / 100));
            const payload = {
                ...form,
                full_price: String(fullPrice),
                discount_percent: String(discountPercent),
                sale_price: discountedPrice.toFixed(2),
            };
            Object.entries(payload).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) data.append(k, v); });
            if (imageFile) data.append('image', imageFile);
            await API.post('products/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            navigate('/products');
        } catch (err) {
            const d = err.response?.data;
            if (d?.sku) setError('This SKU already exists. Edit the SKU field.');
            else setError(JSON.stringify(d || 'Error creating product'));
        } finally {
            setLoading(false);
        }
    };

    const qrPayload = useMemo(() => JSON.stringify({ sku: form.sku }), [form.sku]);
    const discountedSellingPrice = useMemo(() => {
        const fullPrice = Number(form.full_price || 0);
        const discountPercent = Number(form.discount_percent || 0);
        if (!Number.isFinite(fullPrice) || !Number.isFinite(discountPercent)) return 0;
        return Math.max(0, fullPrice * (1 - discountPercent / 100));
    }, [form.full_price, form.discount_percent]);

    const handleUseScannedCode = async (raw) => {
        setCodeMode('existing');
        setError('');
        setScanMessage('');
            const normalized = String(raw || '').trim();
            if (!normalized) return;
            try {
                const res = await API.get(`products/scan/?q=${encodeURIComponent(normalized)}`);
                const product = res.data;
            setForm(prev => ({
                ...prev,
                name: prev.name || product.name || '',
                sku: product.sku || normalized,
                    description: prev.description || product.description || '',
                    category: prev.category || (product.category ? String(product.category) : ''),
                    supplier: prev.supplier || (product.supplier ? String(product.supplier) : ''),
                    full_price: prev.full_price || (product.full_price ?? ''),
                    discount_percent: prev.discount_percent || (product.discount_percent ?? '0'),
                }));
                setScanMessage(`Matched existing product: ${product.name}. Values were prefilled where empty.`);
            } catch {
                setForm(prev => ({ ...prev, sku: normalized.toUpperCase() }));
            setScanMessage('No product found for this code. Using scanned value as SKU for new product.');
        }
    };

    const handleCodeModeChange = (mode) => {
        setCodeMode(mode);
        setScanMessage('');
        setError('');
        if (mode === 'generate') {
            setForm(prev => ({ ...prev, sku: generateSKU(prev.name) }));
        } else {
            setForm(prev => ({ ...prev, sku: '' }));
        }
    };

    const handlePrintLabel = () => window.print();

    const downloadCanvas = (canvasId, fileName) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
    };

    return (
        <Layout>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                    <button onClick={() => navigate('/products')} style={styles.backBtn}>← Back</button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>Add New Product</h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>Fill in the product details below</p>
                    </div>
                </div>

                {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        {/* LEFT */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Image upload */}
                            <div style={styles.card}>
                                <div style={styles.cardTitle}>Product Image</div>
                                <label style={styles.imageUploadArea}>
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="preview" style={styles.imagePreview} />
                                    ) : (
                                        <div style={styles.imagePlaceholder}>
                                            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                                            <div style={{ fontWeight: 600, color: '#cbd5e1', fontSize: 14 }}>Click to upload image</div>
                                            <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>PNG, JPG up to 5MB</div>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                                </label>
                                {imagePreview && (
                                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} style={styles.removeImgBtn}>
                                        ✕ Remove Image
                                    </button>
                                )}
                            </div>

                            {/* Barcode / QR Label */}
                            <div style={styles.card}>
                                <div style={styles.cardTitle}>Barcode & QR Label</div>
                                {!form.sku ? (
                                    <div style={styles.hint}>Enter or scan a SKU to generate barcode and QR.</div>
                                ) : (
                                    <div id="printable-label" style={styles.labelPanel}>
                                        <div style={{ marginBottom: 10, fontWeight: 700 }}>{form.name || 'New Product'}</div>
                                        <div style={styles.codeBox}>
                                            <Barcode value={form.sku} height={50} width={1.6} fontSize={14} background="#FFFFFF" />
                                        </div>
                                        <div style={styles.codeBox}>
                                            <QRCodeCanvas id="product-qr-canvas" value={qrPayload} size={124} includeMargin />
                                        </div>
                                        <div style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>{form.sku}</div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button type="button" style={styles.quickActionBtn} onClick={handlePrintLabel} disabled={!form.sku}>
                                        🖨️ Print Label
                                    </button>
                                    <button type="button" style={styles.quickActionBtn} onClick={() => downloadCanvas('product-qr-canvas', `${form.sku || 'product'}_qr.png`)} disabled={!form.sku}>
                                        ⬇ Download QR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div style={styles.card}>
                            <div style={styles.cardTitle}>Product Details</div>

                            {/* Name */}
                            <div style={styles.field}>
                                <label style={styles.label}>Product Name *</label>
                                <input style={styles.input} value={form.name}
                                    onChange={e => handleNameChange(e.target.value)}
                                    placeholder="e.g. Dell Laptop 15 inch" required />
                            </div>

                            {/* Code mode */}
                            <div style={styles.field}>
                                <label style={styles.label}>Barcode / QR Mode</label>
                                <div style={styles.modeRow}>
                                    <button
                                        type="button"
                                        onClick={() => handleCodeModeChange('existing')}
                                        style={codeMode === 'existing' ? styles.modeBtnActive : styles.modeBtn}
                                    >
                                        Use Existing Code
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCodeModeChange('generate')}
                                        style={codeMode === 'generate' ? styles.modeBtnActive : styles.modeBtn}
                                    >
                                        Generate New Code
                                    </button>
                                </div>
                                <span style={styles.hint}>
                                    {codeMode === 'existing'
                                        ? 'Scan or type manufacturer barcode/SKU.'
                                        : 'SKU is auto-generated from product name and can still be edited.'}
                                </span>
                            </div>

                            {codeMode === 'existing' && (
                                <>
                                    <ScanInput
                                        label="Scan Existing Barcode / QR"
                                        placeholder="Open camera or scan with hardware scanner"
                                        onScan={handleUseScannedCode}
                                    />
                                    {scanMessage && <div style={styles.scanInfo}>ℹ️ {scanMessage}</div>}
                                </>
                            )}

                            {/* SKU */}
                            <div style={styles.field}>
                                <label style={styles.label}>
                                    SKU <span style={styles.badge}>{codeMode === 'generate' ? 'Auto-generated' : 'Existing code'}</span>
                                </label>
                                <input
                                    style={{ ...styles.input, fontFamily: 'monospace', backgroundColor: '#F8FAFC' }}
                                    value={form.sku}
                                    onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                                    placeholder={codeMode === 'generate' ? 'Auto-fills from name' : 'Scan/type existing barcode value'}
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div style={styles.field}>
                                <label style={styles.label}>Description</label>
                                <textarea style={{ ...styles.input, height: 64, resize: 'vertical' }}
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optional description" />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Full Price (Rs.) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    style={styles.input}
                                    value={form.full_price}
                                    onChange={e => setForm({ ...form, full_price: e.target.value })}
                                    placeholder="e.g. 5000"
                                    required
                                />
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Discount (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    style={styles.input}
                                    value={form.discount_percent}
                                    onChange={e => setForm({ ...form, discount_percent: e.target.value })}
                                    placeholder="e.g. 10"
                                />
                                <span style={styles.hint}>Enter a value from 0 to 100.</span>
                            </div>

                            <div style={styles.previewBox}>
                                Discounted Selling Price: <strong>Rs. {discountedSellingPrice.toFixed(2)}</strong>
                            </div>

                            {/* Category with quick-add */}
                            <div style={styles.field}>
                                <div style={styles.labelRow}>
                                    <label style={styles.label}>Category</label>
                                    <button type="button" onClick={() => setShowCatModal(true)} style={styles.quickAddBtn}>
                                        + New Category
                                    </button>
                                </div>
                                <select style={styles.input} value={form.category}
                                    onChange={e => setForm({ ...form, category: e.target.value })}>
                                    <option value="">Select category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {categories.length === 0 && (
                                    <span style={styles.hint}>No categories yet — click "+ New Category" to add one</span>
                                )}
                            </div>

                            {/* Supplier with quick-add */}
                            <div style={styles.field}>
                                <div style={styles.labelRow}>
                                    <label style={styles.label}>Supplier</label>
                                    <button type="button" onClick={() => setShowSupModal(true)} style={styles.quickAddBtn}>
                                        + New Supplier
                                    </button>
                                </div>
                                <select style={styles.input} value={form.supplier}
                                    onChange={e => setForm({ ...form, supplier: e.target.value })}>
                                    <option value="">Select supplier</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                {suppliers.length === 0 && (
                                    <span style={styles.hint}>No suppliers yet — click "+ New Supplier" to add one</span>
                                )}
                            </div>

                            <div style={styles.field}>
                                <label style={styles.label}>Low Stock Threshold</label>
                                <input
                                    type="number"
                                    min="0"
                                    style={styles.input}
                                    value={form.low_stock_threshold}
                                    onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })}
                                    placeholder="e.g. 10"
                                />
                                <span style={styles.hint}>Alert will trigger when stock is equal to or below this value.</span>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                        <button type="submit" style={loading ? styles.btnDisabled : styles.submitBtn} disabled={loading}>
                            {loading ? '⏳ Saving...' : '✅ Add Product'}
                        </button>
                        <button type="button" onClick={() => navigate('/products')} style={styles.cancelBtn}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Quick Add Category Modal ── */}
            {showCatModal && (
                <Modal title="Add New Category" onClose={() => setShowCatModal(false)}>
                    <div style={styles.field}>
                        <label style={styles.label}>Category Name *</label>
                        <input
                            style={styles.input}
                            value={quickCat}
                            onChange={e => setQuickCat(e.target.value)}
                            placeholder="e.g. Electronics, Furniture..."
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleQuickAddCategory()}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button onClick={handleQuickAddCategory} style={quickLoading ? styles.btnDisabled : styles.submitBtn} disabled={quickLoading}>
                            {quickLoading ? 'Adding...' : 'Add Category'}
                        </button>
                        <button onClick={() => setShowCatModal(false)} style={styles.cancelBtn}>Cancel</button>
                    </div>
                </Modal>
            )}

            {/* ── Quick Add Supplier Modal ── */}
            {showSupModal && (
                <Modal title="Add New Supplier" onClose={() => setShowSupModal(false)}>
                    <div style={styles.field}>
                        <label style={styles.label}>Supplier Name *</label>
                        <input style={styles.input} value={quickSup.name}
                            onChange={e => setQuickSup({ ...quickSup, name: e.target.value })}
                            placeholder="e.g. Tech Distributor Co." autoFocus />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Email</label>
                        <input style={styles.input} type="email" value={quickSup.email}
                            onChange={e => setQuickSup({ ...quickSup, email: e.target.value })}
                            placeholder="supplier@company.com" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={styles.field}>
                            <label style={styles.label}>Phone</label>
                            <input style={styles.input} value={quickSup.phone}
                                onChange={e => setQuickSup({ ...quickSup, phone: e.target.value })}
                                placeholder="0300-1234567" />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Address</label>
                            <input style={styles.input} value={quickSup.address}
                                onChange={e => setQuickSup({ ...quickSup, address: e.target.value })}
                                placeholder="City, Country" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button onClick={handleQuickAddSupplier} style={quickLoading ? styles.btnDisabled : styles.submitBtn} disabled={quickLoading}>
                            {quickLoading ? 'Adding...' : 'Add Supplier'}
                        </button>
                        <button onClick={() => setShowSupModal(false)} style={styles.cancelBtn}>Cancel</button>
                    </div>
                </Modal>
            )}
        </Layout>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div style={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={modalStyles.box}>
                <div style={modalStyles.header}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{title}</span>
                    <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
                </div>
                <div style={modalStyles.body}>{children}</div>
            </div>
        </div>
    );
}

const modalStyles = {
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    box: { backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 14, padding: 0, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #2a2a4a' },
    body: { padding: 24 },
    closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 },
};

const styles = {
    backBtn: { background: '#ffffff10', border: '1px solid #2a2a4a', color: '#cbd5e1', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
    errorBox: { backgroundColor: '#450a0a22', color: '#f87171', padding: '12px 16px', borderRadius: 10, marginBottom: 20, border: '1px solid #dc262644', fontSize: 14 },
    scanInfo: { backgroundColor: '#1e3a8a22', color: '#93c5fd', padding: '10px 14px', borderRadius: 10, border: '1px solid #1e40af44', fontSize: 13 },
    card: { backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', padding: 20, borderRadius: 12 },
    cardTitle: { fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #2a2a4a' },
    imageUploadArea: { display: 'block', border: '2px dashed #2a2a4a', borderRadius: 10, cursor: 'pointer', overflow: 'hidden', background: '#0f0f23' },
    imagePreview: { width: '100%', height: 180, objectFit: 'cover', display: 'block' },
    imagePlaceholder: { padding: '32px 20px', textAlign: 'center' },
    removeImgBtn: { width: '100%', marginTop: 8, padding: '7px', background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
    field: { marginBottom: 14 },
    label: { display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13, color: '#cbd5e1' },
    labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    quickAddBtn: { background: 'none', border: 'none', color: '#93c5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 },
    quickActionBtn: { background: '#0f0f23', border: '1px solid #2a2a4a', color: '#cbd5e1', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    modeRow: { display: 'flex', gap: 8, marginBottom: 6 },
    modeBtn: { flex: 1, border: '1px solid #2a2a4a', background: '#0f0f23', color: '#cbd5e1', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    modeBtnActive: { flex: 1, border: '1px solid #6c63ff66', background: '#6c63ff22', color: '#a89cff', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    badge: { fontWeight: 'normal', color: '#4ade80', fontSize: 11, backgroundColor: '#14532d22', padding: '2px 8px', borderRadius: 10, marginLeft: 8, border: '1px solid #16a34a44' },
    hint: { display: 'block', marginTop: 4, fontSize: 12, color: '#94A3B8' },
    labelPanel: { border: '1px dashed #2a2a4a', borderRadius: 10, padding: 14, background: '#0f0f23', textAlign: 'center', color: '#fff' },
    codeBox: { marginBottom: 10, display: 'flex', justifyContent: 'center' },
    input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: 14, boxSizing: 'border-box', outline: 'none', backgroundColor: '#0f0f23', color: '#fff' },
    previewBox: { backgroundColor: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 12px', color: '#cbd5e1', fontSize: 14, marginBottom: 14 },
    submitBtn: { backgroundColor: '#6c63ff', color: 'white', border: 'none', padding: '11px 28px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15, boxShadow: '0 4px 12px rgba(108,99,255,0.3)' },
    btnDisabled: { backgroundColor: '#94A3B8', color: 'white', border: 'none', padding: '11px 28px', borderRadius: 8, cursor: 'not-allowed', fontWeight: 600, fontSize: 15 },
    cancelBtn: { background: '#ffffff10', border: '1px solid #2a2a4a', color: '#cbd5e1', padding: '11px 28px', borderRadius: 8, cursor: 'pointer', fontSize: 15 },
};
