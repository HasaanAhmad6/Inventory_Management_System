import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import useBreakpoint from '../hooks/useBreakpoint';

function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div style={{ backgroundColor: '#0F172A', padding: '10px 14px', borderRadius: 8, color: 'white', fontSize: 13 }}>
                <div style={{ color: '#94A3B8', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{payload[0].value} units sold</div>
            </div>
        );
    }
    return null;
}

export default function Dashboard() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [monthsWindow, setMonthsWindow] = useState(6);
    const [chartLoading, setChartLoading] = useState(false);
    const [chartError, setChartError] = useState('');
    const isInitialLoadRef = useRef(true);
    const { user, isSuperUser } = useAuth();
    const { isMobile, isTablet } = useBreakpoint();

    const handleMonthsWindowChange = (value) => {
        setChartLoading(true);
        setChartError('');
        setMonthsWindow(value);
    };

    useEffect(() => {
        const isInitial = isInitialLoadRef.current;

        API.get(`dashboard/?months=${monthsWindow}`)
            .then(res => setData(res.data))
            .catch(err => {
                const detail = err.response?.data?.detail || 'Failed to load dashboard data.';
                if (isInitial) {
                    setError(detail);
                } else {
                    setChartError(detail);
                }
            })
            .finally(() => {
                if (isInitial) {
                    setLoading(false);
                    isInitialLoadRef.current = false;
                } else {
                    setChartLoading(false);
                }
            });
    }, [monthsWindow]);

    if (loading) return (
        <Layout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <div style={{ color: '#94A3B8', fontSize: 16 }}>Loading dashboard...</div>
            </div>
        </Layout>
    );

    if ((error && !data) || !data) return (
        <Layout>
            <div style={{ padding: isMobile ? 16 : 28, maxWidth: 900, margin: '0 auto' }}>
                <div style={{
                    maxWidth: 900,
                    margin: '24px auto',
                    background: '#450a0a22',
                    border: '1px solid #dc262644',
                    color: '#f87171',
                    borderRadius: 10,
                    padding: 16
                }}>
                    ⚠️ {error || 'Dashboard data is unavailable right now.'}
                </div>
            </div>
        </Layout>
    );

    const fmt = (n) => `Rs. ${Number(n).toLocaleString()}`;

    // ── PRIVILEGED CARDS (superuser only for financials) ─────────────────────
    const superUserCards = [
        { label: 'Total Products',  value: data.total_products,  icon: '📦', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', isCurrency: false },
        { label: 'Total Revenue',   value: fmt(data.total_revenue),   icon: '💰', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', isCurrency: true  },
        { label: 'Total Cost',      value: fmt(data.total_cost),      icon: '🛒', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', isCurrency: true  },
        { label: 'Net Profit',      value: fmt(data.total_profit),    icon: '📈',
          color:  data.total_profit >= 0 ? '#16A34A' : '#DC2626',
          bg:     data.total_profit >= 0 ? '#F0FDF4' : '#FEF2F2',
          border: data.total_profit >= 0 ? '#BBF7D0' : '#FECACA', isCurrency: true },
        { label: 'Low Stock Items', value: data.low_stock_items, icon: '⚠️',
          color:  data.low_stock_items > 0 ? '#DC2626' : '#16A34A',
          bg:     data.low_stock_items > 0 ? '#FEF2F2' : '#F0FDF4',
          border: data.low_stock_items > 0 ? '#FECACA' : '#BBF7D0', isCurrency: false },
        { label: 'Units Sold',      value: data.total_sales,     icon: '📊', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', isCurrency: false },
        { label: 'Active Vouchers',  value: data.total_vouchers,  icon: '🎟️', color: '#B45309', bg: '#FFFBEB', border: '#FEF3C7', isCurrency: false },
    ];

    // ── STAFF CARDS (no financial info) ──────────────────────────────────────
    const staffCards = [
        { label: 'Total Products',  value: data.total_products,  icon: '📦', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
        { label: 'Low Stock Items', value: data.low_stock_items, icon: '⚠️',
          color:  data.low_stock_items > 0 ? '#DC2626' : '#16A34A',
          bg:     data.low_stock_items > 0 ? '#FEF2F2' : '#F0FDF4',
          border: data.low_stock_items > 0 ? '#FECACA' : '#BBF7D0' },
        { label: 'Active Vouchers',  value: data.total_vouchers,  icon: '🎟️', color: '#B45309', bg: '#FFFBEB', border: '#FEF3C7' },
    ];

    const cards = isSuperUser() ? superUserCards : staffCards;
    const cardColumns = isMobile ? 1 : (isTablet ? 2 : (isSuperUser() ? 3 : 2));

    return (
        <Layout>
            <div style={{ padding: isMobile ? 16 : 28, maxWidth: 1200, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>
                        Dashboard
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 14 }}>
                        Welcome back, <strong style={{ color: '#a89cff' }}>{user?.username}</strong>!
                        {isSuperUser() ? " Here's your full business overview." : " Here's your workspace overview."}
                    </p>
                </div>

                {/* Summary Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cardColumns}, 1fr)`,
                    gap: 16,
                    marginBottom: 28
                }}>
                    {cards.map((card, i) => (
                        <div key={i} style={{
                            backgroundColor: '#1a1a2e',
                            borderRadius: 14,
                            padding: 22,
                            border: `1px solid #2a2a4a`,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: '50%', backgroundColor: card.bg, opacity: 0.07 }} />
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    backgroundColor: card.bg + '22',
                                    border: `1px solid ${card.border}44`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 20, marginBottom: 14
                                }}>
                                    {card.icon}
                                </div>
                                <div style={{ fontSize: card.isCurrency ? 22 : 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                                    {card.value}
                                </div>
                                <div style={{ color: '#64748B', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
                                    {card.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Low Stock Alert — visible to everyone */}
                {data.low_stock_items > 0 && data.low_stock_list?.length > 0 && (
                    <div style={{
                        backgroundColor: '#1a1a2e',
                        borderRadius: 14,
                        padding: 24,
                        border: '1px solid #dc262644',
                        marginBottom: 28,
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
                            ⚠️ Low Stock Alert
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.low_stock_list.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', backgroundColor: '#0f0f23',
                                    borderRadius: 10, border: '1px solid #2a2a4a'
                                }}>
                                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                                        {item.product__name}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                                            Threshold: {item.low_stock_threshold}
                                        </span>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 20,
                                            background: '#dc262622', color: '#f87171',
                                            border: '1px solid #dc262644',
                                            fontWeight: 700, fontSize: 12
                                        }}>
                                            {item.quantity} left
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Monthly Sales Chart — superuser only */}
                {isSuperUser() && data.monthly_data && (
                    <div style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 28, border: '1px solid #2a2a4a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>Monthly Sales</h3>
                                <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 13 }}>
                                    Units sold over the last {monthsWindow} month{monthsWindow === 1 ? '' : 's'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <select
                                    value={monthsWindow}
                                    onChange={(e) => handleMonthsWindowChange(Number(e.target.value))}
                                    disabled={chartLoading}
                                    style={{
                                        backgroundColor: '#0f0f23',
                                        color: '#cbd5e1',
                                        border: '1px solid #2a2a4a',
                                        borderRadius: 8,
                                        padding: '6px 10px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    <option value={1}>Last 1 Month</option>
                                    <option value={3}>Last 3 Months</option>
                                    <option value={6}>Last 6 Months</option>
                                    <option value={12}>Last 12 Months</option>
                                </select>
                                <div style={{ backgroundColor: '#1E40AF22', color: '#60a5fa', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, border: '1px solid #1E40AF44' }}>
                                    Last {monthsWindow} Month{monthsWindow === 1 ? '' : 's'}
                                </div>
                            </div>
                        </div>
                        {chartError && (
                            <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>
                                {chartError}
                            </div>
                        )}
                        {chartLoading && (
                            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 10 }}>
                                Updating monthly chart...
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                            <BarChart data={data.monthly_data} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 13 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94A3B8', fontSize: 13 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                                <Bar dataKey="sales" fill="#6c63ff" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Staff workspace panel — shown only to staff */}
                {!isSuperUser() && (
                    <div style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 28, border: '1px solid #2a2a4a' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                            Quick Actions
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                            {[
                                { icon: '📦', label: 'Browse Products',  desc: 'View all available products and stock levels', path: '/products' },
                                { icon: '💰', label: 'Record a Sale',     desc: 'Create a new sale entry', path: '/sales' },
                            ].map((item, i) => (
                                <Link key={i} to={item.path} style={{
                                    display: 'block', padding: 18,
                                    background: '#0f0f23', borderRadius: 12,
                                    border: '1px solid #2a2a4a', textDecoration: 'none',
                                    transition: 'border-color 0.2s',
                                }}>
                                    <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                                    <div style={{ color: '#64748b', fontSize: 12 }}>{item.desc}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
}
