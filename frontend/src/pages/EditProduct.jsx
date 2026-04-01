import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';

export default function EditProduct() {
    const { id } = useParams();
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
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        API.get(`products/${id}/`).then(r => {
            const p = r.data;
            setForm({
                name: p.name ?? '',
                sku: p.sku ?? '',
                description: p.description ?? '',
                category: p.category ?? '',
                supplier: p.supplier ?? '',
                full_price: p.full_price ?? '',
                discount_percent: p.discount_percent ?? '0',
                low_stock_threshold: String(p?.stock?.low_stock_threshold ?? 10),
            });
        });
        API.get('categories/').then(r => setCategories(r.data));
        API.get('suppliers/').then(r => setSuppliers(r.data));
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const discountPercent = Number(form.discount_percent || 0);
        const fullPrice = Number(form.full_price || 0);
        if (!Number.isFinite(fullPrice) || fullPrice < 0) {
            setError('Full price must be 0 or greater.');
            return;
        }
        if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
            setError('Discount must be between 0 and 100.');
            return;
        }
        if (Number(form.low_stock_threshold) < 0) {
            setError('Low stock threshold cannot be negative.');
            return;
        }
        setLoading(true);
        try {
            const discountedPrice = Math.max(0, fullPrice * (1 - discountPercent / 100));
            await API.put(`products/${id}/`, {
                ...form,
                full_price: String(fullPrice),
                discount_percent: String(discountPercent),
                sale_price: discountedPrice.toFixed(2),
            });
            navigate('/products');
        } catch (err) {
            setError(err.response?.data?.detail || 'Error updating product');
        } finally {
            setLoading(false);
        }
    };

    const discountedSellingPrice = Math.max(
        0,
        Number(form.full_price || 0) * (1 - Number(form.discount_percent || 0) / 100)
    );

    const fieldInputStyle = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid #2a2a4a',
        boxSizing: 'border-box',
        background: '#0f0f23',
        color: '#fff',
        fontSize: 14,
        outline: 'none',
    };

    return (
        <Layout>
            <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
                <h2 style={{ color: '#fff', margin: '0 0 14px', fontSize: 26 }}>Edit Product</h2>
                <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 20 }}>Update product details and assignments.</div>
                {error && (
                    <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #FECACA' }}>
                        ⚠️ {error}
                    </div>
                )}
                <div style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', padding: 32, borderRadius: 12 }}>
                    <form onSubmit={handleSubmit}>
                        {[['Product Name','name'],['SKU','sku'],['Description','description']].map(([label,key,type='text']) => (
                            <div key={key} style={{ marginBottom: 16 }}>
                                <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>{label}</label>
                                <input style={fieldInputStyle}
                                    type={type} value={form[key]} onChange={e => setForm({...form, [key]:e.target.value})} required />
                            </div>
                        ))}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>Full Price (Rs.)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                style={fieldInputStyle}
                                value={form.full_price}
                                onChange={e => setForm({ ...form, full_price: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>Discount (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                style={fieldInputStyle}
                                value={form.discount_percent}
                                onChange={e => setForm({ ...form, discount_percent: e.target.value })}
                            />
                        </div>
                        <div style={{ marginBottom: 16, background: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: 8, padding: '10px 12px', color: '#cbd5e1' }}>
                            Discounted Selling Price: <strong>Rs. {Number.isFinite(discountedSellingPrice) ? discountedSellingPrice.toFixed(2) : '0.00'}</strong>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>Category</label>
                            <select style={fieldInputStyle}
                                value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>Supplier</label>
                            <select style={fieldInputStyle}
                                value={form.supplier} onChange={e => setForm({...form, supplier:e.target.value})}>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display:'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#cbd5e1' }}>Low Stock Threshold</label>
                            <input
                                type="number"
                                min="0"
                                style={fieldInputStyle}
                                value={form.low_stock_threshold}
                                onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:24 }}>
                            <button type='submit' style={{ backgroundColor:'#16a34a', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:600 }} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
                            <button type='button' onClick={() => navigate('/products')} style={{ background:'#ffffff10', color:'#cbd5e1', border:'1px solid #2a2a4a', padding:'10px 24px', borderRadius:8, cursor:'pointer' }}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}
