import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import useBreakpoint from '../hooks/useBreakpoint';

export default function Profits() {
    const navigate = useNavigate();
    const { isSuperUser } = useAuth();
    const { isMobile, isTablet } = useBreakpoint();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortBy, setSortBy] = useState('profit'); // profit | revenue | margin

    useEffect(() => {
        if (!isSuperUser()) return;
        API.get('profits/')
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.detail || 'Failed to load profit report'))
            .finally(() => setLoading(false));
    }, [isSuperUser]);

    const fmt = (n) => `Rs. ${Number(n).toLocaleString()}`;

    const getProfitColor = (profit) => profit >= 0 ? '#4ade80' : '#f87171';
    const getProfitBg   = (profit) => profit >= 0 ? '#14532d22' : '#450a0a22';

    const getMarginColor = (margin) => {
        if (margin >= 30) return '#4ade80';
        if (margin >= 10) return '#fbbf24';
        return '#f87171';
    };

    const sorted = data ? [...data.products].sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'margin')  return b.margin - a.margin;
        return b.profit - a.profit;
    }) : [];
    const accessDenied = !isSuperUser();

    if (loading && !accessDenied) return (
        <Layout>
            <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>
                Calculating profits...
            </div>
        </Layout>
    );

    if (accessDenied) return (
        <Layout>
            <div style={{ maxWidth: 900, margin: '40px auto', background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 10, padding: 16 }}>
                ⚠️ Only superuser can view the profit report.
            </div>
        </Layout>
    );

    if (error) return (
        <Layout>
            <div style={{ maxWidth: 900, margin: '40px auto', background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', borderRadius: 10, padding: 16 }}>
                ⚠️ {error}
            </div>
        </Layout>
    );

    if (!data) return (
        <Layout>
            <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>
                No data available.
            </div>
        </Layout>
    );

    const { summary } = data;

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>Profit Report</h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
                        Revenue, cost, and profit breakdown per product
                    </p>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'), gap: 16, marginBottom: 28 }}>
                    {[
                        { label: 'Total Revenue', value: fmt(summary.total_revenue), icon: '💰', color: '#4ade80', bg: '#14532d22', border: '#16a34a44' },
                        { label: 'Total Cost',    value: fmt(summary.total_cost),    icon: '🛒', color: '#c4b5fd', bg: '#7c3aed22', border: '#7c3aed44' },
                        { label: 'Net Profit',    value: fmt(summary.total_profit),  icon: '📈',
                            color:  summary.total_profit >= 0 ? '#4ade80' : '#f87171',
                            bg:     summary.total_profit >= 0 ? '#14532d22' : '#450a0a22',
                            border: summary.total_profit >= 0 ? '#16a34a44' : '#dc262644',
                        },
                        { label: 'Profit Margin', value: `${summary.margin}%`,       icon: '📊',
                            color:  getMarginColor(summary.margin),
                            bg:     summary.margin >= 10 ? '#14532d22' : '#450a0a22',
                            border: summary.margin >= 10 ? '#16a34a44' : '#dc262644',
                        },
                    ].map((card, i) => (
                        <div key={i} style={{
                            backgroundColor: '#1a1a2e', borderRadius: 14, padding: 22,
                            border: `1px solid ${card.border}`,
                        }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>
                                {card.icon}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</div>
                            <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Product Table */}
                <div style={{ backgroundColor: '#1a1a2e', borderRadius: 14, border: '1px solid #2a2a4a', overflow: 'hidden' }}>

                {/* Table Header with sort */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 10, padding: '18px 24px', borderBottom: '1px solid #2a2a4a' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
                        Per Product Breakdown
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#94A3B8', fontSize: 13 }}>Sort by:</span>
                        {['profit', 'revenue', 'margin'].map(opt => (
                            <button key={opt} onClick={() => setSortBy(opt)} style={{
                                padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                                border: sortBy === opt ? '1px solid #6c63ff66' : '1px solid #2a2a4a',
                                backgroundColor: sortBy === opt ? '#6c63ff22' : '#0f0f23',
                                color: sortBy === opt ? '#a89cff' : '#94A3B8',
                            }}>
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#16162a' }}>
                            {['Product', 'Category', 'Units Sold', 'Revenue', 'Cost', 'Profit', 'Margin'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>
                                    No sales data yet. Record some sales to see profit calculations.
                                </td>
                            </tr>
                        ) : sorted.map((row, i) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #2a2a4a', backgroundColor: i % 2 === 0 ? 'transparent' : '#ffffff04' }}>

                                {/* Product */}
                                <td style={{ padding: '14px 16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/products?focusProductId=${row.id}`)}
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
                                        {row.name}
                                    </button>
                                    <div style={{ color: '#94A3B8', fontSize: 12, fontFamily: 'monospace' }}>{row.sku}</div>
                                </td>

                                {/* Category */}
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ backgroundColor: '#1e40af22', color: '#93c5fd', border: '1px solid #1e40af44', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                                        {row.category}
                                    </span>
                                </td>

                                {/* Units Sold */}
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{row.total_sold}</span>
                                    <span style={{ color: '#94A3B8', fontSize: 12, marginLeft: 4 }}>units</span>
                                </td>

                                {/* Revenue */}
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(row.revenue)}</span>
                                </td>

                                {/* Cost */}
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{ fontWeight: 600, color: '#c4b5fd' }}>{fmt(row.cost)}</span>
                                </td>

                                {/* Profit */}
                                <td style={{ padding: '14px 16px' }}>
                                    <span style={{
                                        fontWeight: 700, fontSize: 15,
                                        color: getProfitColor(row.profit),
                                        backgroundColor: getProfitBg(row.profit),
                                        padding: '4px 10px', borderRadius: 8,
                                    }}>
                                        {row.profit >= 0 ? '+' : ''}{fmt(row.profit)}
                                    </span>
                                </td>

                                {/* Margin */}
                                <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {/* Progress bar */}
                                        <div style={{ width: 60, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.min(Math.abs(row.margin), 100)}%`,
                                                backgroundColor: getMarginColor(row.margin),
                                                borderRadius: 3,
                                            }} />
                                        </div>
                                        <span style={{ fontWeight: 600, color: getMarginColor(row.margin), fontSize: 14 }}>
                                            {row.margin}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>

                    {/* Totals row */}
                    {sorted.length > 0 && (
                        <tfoot>
                            <tr style={{ backgroundColor: '#0F172A' }}>
                                <td style={{ padding: '14px 16px', color: 'white', fontWeight: 700 }} colSpan="3">
                                    TOTAL
                                </td>
                                <td style={{ padding: '14px 16px', color: '#4ADE80', fontWeight: 700 }}>
                                    {fmt(summary.total_revenue)}
                                </td>
                                <td style={{ padding: '14px 16px', color: '#C4B5FD', fontWeight: 700 }}>
                                    {fmt(summary.total_cost)}
                                </td>
                                <td style={{ padding: '14px 16px', color: summary.total_profit >= 0 ? '#4ADE80' : '#F87171', fontWeight: 700, fontSize: 15 }}>
                                    {summary.total_profit >= 0 ? '+' : ''}{fmt(summary.total_profit)}
                                </td>
                                <td style={{ padding: '14px 16px', color: '#94A3B8', fontWeight: 700 }}>
                                    {summary.margin}%
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
                </div>
                </div>
            </div>
        </Layout>
    );
}
