import { useEffect, useState, Fragment } from 'react';
import Layout from '../components/Layout';
import API from '../api/axios';

export default function SalesHistory() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [expandedBills, setExpandedBills] = useState({});
    const [downloadingBill, setDownloadingBill] = useState(null);
    const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const toggleBillExpand = (billId) => {
        setExpandedBills(prev => ({ ...prev, [billId]: !prev[billId] }));
    };

    const fetchSales = () => {
        setLoading(true);
        API.get('sales/')
            .then(r => {
                setSales(r.data?.results ?? r.data);
                setError('');
            })
            .catch(err => setError(err.response?.data?.detail || 'Failed to load sales history'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSales(); }, []);

    const grouped = sales.reduce((acc, s) => {
        const key = s.bill_id || `SINGLE-${s.id}`;
        if (!acc[key]) {
            acc[key] = {
                bill_id: key,
                customer_name: s.customer_name,
                date: s.date,
                items: [],
                total: 0,
            };
        }
        acc[key].items.push(s);
        const lineTotal = Number(s.quantity) * Number(s.unit_price) - Number(s.discount_amount || 0);
        acc[key].total += lineTotal;
        return acc;
    }, {});
    const bills = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));

        const downloadPdf = async (url, filename) => {
        try {
            const token = localStorage.getItem('access');
            const fetchRes = await fetch(`http://127.0.0.1:8000/api/${url}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!fetchRes.ok) throw new Error('Fetch PDF failed');
            const data = await fetchRes.blob();
            const blob = new Blob([data], { type: 'application/pdf' });
            const url_blob = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.href = url_blob;
            link.download = filename;
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url_blob);
            }, 1000);
        } catch (err) {
            console.error('PDF download error:', err);
            setError('Failed to download invoice. Please try again.');
        }
    };

    const downloadBillInvoice = async (bill) => {
        setDownloadingBill(bill.bill_id);
        setError('');
        try {
            const saleIds = bill.items.map(it => it.id);
            const filename = `invoice_${bill.bill_id}.pdf`;
            const token = localStorage.getItem('access');
            console.log('[Invoice Download] Starting fetch...');
            const fetchRes = await fetch('http://127.0.0.1:8000/api/sales/invoice-selected/', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sale_ids: saleIds })
            });
            if (!fetchRes.ok) {
                const errText = await fetchRes.text();
                console.error('Fetch Invoice Error:', errText);
                throw new Error('Fetch invoice failed: ' + fetchRes.status);
            }
            const jsonData = await fetchRes.json();
            const binaryString = window.atob(jsonData.pdf_64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blobData = new Blob([bytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blobData);
            const link = document.createElement('a');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.href = url;
            link.download = filename || `invoice_${Date.now()}.pdf`;
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 1000);
        } catch (err) {
            console.error('Invoice download error:', err);
            setError('Failed to download invoice. Please try again.');
        } finally {
            setDownloadingBill(null);
        }
    };

    const handleBulkInvoice = async () => {
        setBulkLoading(true);
        const params = new URLSearchParams();
        if (bulkStart) params.append('start', bulkStart);
        if (bulkEnd) params.append('end', bulkEnd);
        try {
            await downloadPdf(`sales/invoice-bulk/?${params}`, 'invoice_bulk.pdf');
        } finally {
            setBulkLoading(false);
        }
    };

    return (
        <Layout>
            <div style={{ padding: 28 }}>
                <h2 style={{ marginTop: 0, color: '#fff' }}>📜 Sales History</h2>
                <p style={{ marginTop: 0, color: '#94A3B8' }}>Admin-only sales records and invoices.</p>

                {error && (
                    <div style={{ 
                        backgroundColor: '#7f1d1d', 
                        color: '#fca5a5', 
                        padding: '12px 14px', 
                        borderRadius: 8, 
                        marginBottom: 16, 
                        border: '1px solid #991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                        <button 
                            onClick={() => setError('')}
                            style={{ 
                                marginLeft: 'auto', 
                                background: 'none', 
                                border: 'none', 
                                color: '#fca5a5', 
                                cursor: 'pointer',
                                fontSize: 16,
                                padding: 4
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', background: '#1a1a2e', borderRadius: 10, border: '1px solid #2a2a4a' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#86efac', whiteSpace: 'nowrap' }}>📄 Bulk Invoice</span>
                    <input type="date" value={bulkStart} onChange={e => setBulkStart(e.target.value)} style={styles.input} />
                    <span style={{ color: '#94A3B8', fontSize: 13 }}>to</span>
                    <input type="date" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} style={styles.input} />
                    <button onClick={handleBulkInvoice} disabled={bulkLoading} style={styles.bulkBtn}>
                        {bulkLoading ? 'Generating...' : '⬇ Download'}
                    </button>
                </div>

                <div style={styles.card}>
                    {loading ? (
                        <div style={{ color: '#94A3B8', padding: 24 }}>Loading...</div>
                    ) : error ? (
                        <div style={{ color: '#f87171', padding: 24 }}>⚠️ {error}</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={{ backgroundColor: '#0f0f23' }}>
                                        {['Bill ID', 'Customer', '# Items', 'Bill Total', 'Date', ''].map(h => (
                                            <th key={h} style={styles.th}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {bills.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No sales yet</td></tr>
                                    ) : bills.map((bill, i) => {
                                        const isExpanded = expandedBills[bill.bill_id];
                                        const itemCount = bill.items.length;
                                        const usedVoucherCode = bill.items.find(it => it.voucher_code)?.voucher_code;
                                        return (
                                            <Fragment key={bill.bill_id}>
                                                <tr 
                                                    style={{ 
                                                        borderBottom: isExpanded ? 'none' : '1px solid #2a2a4a', 
                                                        backgroundColor: i % 2 === 0 ? '#14142b' : '#0f0f23',
                                                        cursor: 'pointer',
                                                    }}
                                                    onClick={() => toggleBillExpand(bill.bill_id)}
                                                >
                                                    <td style={styles.td}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ color: '#94A3B8', fontSize: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                                                            <code style={{ color: '#cbd5e1', fontWeight: 600 }}>{bill.bill_id}</code>
                                                        </div>
                                                    </td>
                                                    <td style={styles.td}><span style={{ fontWeight: 600, color: '#fff' }}>{bill.customer_name}</span></td>
                                                    <td style={styles.td}>
                                                        <span style={{
                                                            backgroundColor: '#172554',
                                                            color: '#93c5fd',
                                                            padding: '4px 10px',
                                                            borderRadius: 12,
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            border: '1px solid #1e3a8a'
                                                        }}>
                                                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <span style={{ fontWeight: 700, color: '#86efac', fontSize: 15 }}>
                                                            Rs. {bill.total.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td style={styles.td}>{new Date(bill.date).toLocaleDateString()}</td>
                                                    <td style={styles.td}>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                downloadBillInvoice(bill);
                                                            }} 
                                                            disabled={downloadingBill === bill.bill_id}
                                                            style={{
                                                                ...styles.invoiceBtn,
                                                                opacity: downloadingBill === bill.bill_id ? 0.6 : 1,
                                                                cursor: downloadingBill === bill.bill_id ? 'not-allowed' : 'pointer'
                                                            }}
                                                        >
                                                            {downloadingBill === bill.bill_id ? '⏳ Downloading...' : '📄 Invoice'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr key={`${bill.bill_id}-details`} style={{ backgroundColor: i % 2 === 0 ? '#0f0f23' : '#14142b', borderBottom: '1px solid #2a2a4a' }}>
                                                        <td colSpan="6" style={{ padding: '0 14px 12px 48px' }}>
                                                            <div style={{ 
                                                                backgroundColor: '#1a1a2e', 
                                                                borderRadius: 8, 
                                                                padding: 12,
                                                                border: '1px solid #2a2a4a'
                                                            }}>
                                                                <div style={{ 
                                                                    fontWeight: 600, 
                                                                    fontSize: 12, 
                                                                    color: '#94A3B8', 
                                                                    marginBottom: 10,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: 0.5
                                                                }}>
                                                                    Bill Items
                                                                </div>
                                                                <div style={{ marginBottom: 10, fontSize: 12, color: '#cbd5e1' }}>
                                                                    Voucher Used: <span style={{ color: usedVoucherCode ? '#86efac' : '#94A3B8', fontWeight: 700 }}>{usedVoucherCode || 'None'}</span>
                                                                </div>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                    <thead>
                                                                        <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                                                                            <th style={{ ...styles.th, textAlign: 'left', padding: '6px 8px' }}>Product</th>
                                                                            <th style={{ ...styles.th, textAlign: 'center', padding: '6px 8px' }}>Qty</th>
                                                                            <th style={{ ...styles.th, textAlign: 'right', padding: '6px 8px' }}>Unit Price</th>
                                                                            <th style={{ ...styles.th, textAlign: 'right', padding: '6px 8px' }}>Voucher Disc.</th>
                                                                            <th style={{ ...styles.th, textAlign: 'right', padding: '6px 8px' }}>Line Total</th>
                                                                            <th style={{ ...styles.th, textAlign: 'left', padding: '6px 8px' }}>Notes</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {bill.items.map((it, idx) => {
                                                                            const charged = Number(it.unit_price || 0);
                                                                            const full = Number(it.full_unit_price || 0);
                                                                            const hasDiscount = full > charged;
                                                                            const voucherDiscount = Number(it.discount_amount || 0);
                                                                            const lineTotal = (charged * Number(it.quantity)) - voucherDiscount;
                                                                            return (
                                                                                <tr key={it.id} style={{ borderBottom: idx < bill.items.length - 1 ? '1px solid #2a2a4a33' : 'none' }}>
                                                                                    <td style={{ padding: '8px', color: '#E2E8F0', fontSize: 13 }}>
                                                                                        <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                                                                                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>SKU: {it.product_sku || '—'}</div>
                                                                                    </td>
                                                                                    <td style={{ padding: '8px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#93c5fd' }}>
                                                                                        {it.quantity}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px', textAlign: 'right', fontSize: 13 }}>
                                                                                        {hasDiscount ? (
                                                                                            <div>
                                                                                                <div style={{ color: '#94A3B8', textDecoration: 'line-through', fontSize: 11 }}>
                                                                                                    Rs. {formatMoney(full)}
                                                                                                </div>
                                                                                                <div style={{ color: '#86efac', fontWeight: 700 }}>
                                                                                                    Rs. {formatMoney(charged)}
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div style={{ color: '#E2E8F0', fontWeight: 600 }}>
                                                                                                Rs. {formatMoney(charged)}
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                                                                                        {voucherDiscount > 0 ? (
                                                                                            <span style={{ color: '#fca5a5' }}>-Rs. {formatMoney(voucherDiscount)}</span>
                                                                                        ) : (
                                                                                            <span style={{ color: '#64748B' }}>-</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                                                                                        Rs. {lineTotal.toLocaleString()}
                                                                                    </td>
                                                                                    <td style={{ padding: '8px', color: '#94A3B8', fontSize: 12 }}>
                                                                                        {it.notes || '—'}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

const styles = {
    card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a' },
    input: { width: 150, padding: '8px 10px', borderRadius: 8, border: '1px solid #2a2a4a', backgroundColor: '#0f0f23', color: '#E2E8F0' },
    bulkBtn: { background: '#16A34A', color: 'white', border: '1px solid #166534', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    td: { padding: '12px 14px', color: '#E2E8F0', fontSize: 14 },
    invoiceBtn: { background: '#172554', color: '#93c5fd', border: '1px solid #1e3a8a', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
};
