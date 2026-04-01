import { useState, useEffect } from 'react';
import API from '../api/axios';

export default function AddPurchase() {
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState({ product: '', quantity: '', unit_cost: '' });

    useEffect(() => { API.get('products/').then(r => setProducts(r.data)); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await API.post('purchases/', form);
        alert('Purchase recorded! Stock updated.');
    };

    return (
        <form onSubmit={handleSubmit}>
            <select value={form.product} onChange={e => setForm({...form, product: e.target.value})}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type='number' placeholder='Quantity' onChange={e => setForm({...form, quantity: e.target.value})} />
            <input type='number' placeholder='Unit Cost' onChange={e => setForm({...form, unit_cost: e.target.value})} />
            <button type='submit'>Record Purchase</button>
        </form>
    );
}
