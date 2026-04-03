import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import API from '../api/axios';

export default function DemandForecast() {
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payload, setPayload] = useState(null);

    const fetchForecast = async (horizon = days) => {
        setLoading(true);
        setError('');
        try {
            const res = await API.get(`demand-forecast/?days=${horizon}`);
            setPayload(res.data);
        } catch (err) {
            const message = err?.response?.data?.detail || 'Unable to load demand forecast.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForecast(7);
    }, []);

    const rows = payload?.forecast || [];
    const summary = payload?.summary || {};
    const gemini = payload?.gemini || {};
    const insightsText = gemini.insights || 'Set GEMINI_API_KEY on backend env to enable AI recommendations.';
    const shouldScrollInsights = insightsText.length > 700;

    const topAtRisk = useMemo(
        () => rows.filter((r) => r.will_run_low_within_horizon).slice(0, 8),
        [rows]
    );

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #111827 100%)',
                    border: '1px solid #2a2a4a',
                    borderRadius: 14,
                    padding: 20,
                    marginBottom: 20,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 800 }}>Demand Forecast</h2>
                            <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }}>
                                Statistical forecast for all products, plus Gemini 2.5 Flash planning insights.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <label style={{ color: '#cbd5e1', fontSize: 13 }}>Horizon</label>
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                style={{
                                    background: '#0f172a',
                                    color: '#e2e8f0',
                                    border: '1px solid #334155',
                                    borderRadius: 8,
                                    padding: '7px 10px',
                                    fontWeight: 600,
                                }}
                            >
                                {[7, 10, 14, 21, 30].map((option) => (
                                    <option key={option} value={option}>{option} days</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => fetchForecast(days)}
                                style={{
                                    border: '1px solid #6366f1',
                                    background: '#6366f133',
                                    color: '#c7d2fe',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {error ? (
                    <div style={{
                        border: '1px solid #7f1d1d',
                        background: '#450a0a22',
                        color: '#fecaca',
                        borderRadius: 12,
                        padding: '12px 14px',
                        marginBottom: 18,
                        fontSize: 14,
                    }}>
                        {error}
                    </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <StatCard title="Total Products" value={summary.total_products ?? 0} color="#38bdf8" />
                    <StatCard title={`At Risk in ${summary.horizon_days ?? 7} Days`} value={summary.at_risk_count ?? 0} color="#fb7185" />
                    <StatCard title="Already Low Stock" value={summary.already_low_count ?? 0} color="#f59e0b" />
                    <StatCard title="No Sales Signal" value={summary.no_sales_signal_count ?? 0} color="#a78bfa" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 14, alignItems: 'start' }}>
                    <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid #2a2a4a',
                            color: '#e2e8f0',
                            fontWeight: 700,
                            fontSize: 14,
                        }}>
                            Product Forecast Table
                        </div>
                        {loading ? (
                            <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Calculating demand forecast...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                                    <thead>
                                        <tr style={{ background: '#151528' }}>
                                            {['Product', 'Stock', 'Threshold', 'Avg/Day (7d)', 'Forecast', 'Stock After', 'Low In (days)', 'Risk'].map((head) => (
                                                <th key={head} style={{
                                                    textAlign: 'left',
                                                    color: '#64748b',
                                                    fontSize: 11,
                                                    letterSpacing: 1,
                                                    textTransform: 'uppercase',
                                                    padding: '11px 14px',
                                                    borderBottom: '1px solid #2a2a4a',
                                                }}>{head}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((item, idx) => (
                                            <tr key={item.product_id} style={{ background: idx % 2 === 0 ? 'transparent' : '#ffffff04' }}>
                                                <td style={{ padding: '12px 14px', borderBottom: '1px solid #2a2a4a' }}>
                                                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                                                    <div style={{ color: '#64748b', fontSize: 11 }}>{item.sku} {item.category ? `• ${item.category}` : ''}</div>
                                                </td>
                                                <td style={tdStyle}>{item.current_stock}</td>
                                                <td style={tdStyle}>{item.low_stock_threshold}</td>
                                                <td style={tdStyle}>{item.avg_daily_sales_7d}</td>
                                                <td style={tdStyle}>{item.forecast_units_next_days}</td>
                                                <td style={{ ...tdStyle, color: item.expected_stock_after_horizon <= item.low_stock_threshold ? '#fb7185' : '#cbd5e1', fontWeight: 700 }}>
                                                    {item.expected_stock_after_horizon}
                                                </td>
                                                <td style={tdStyle}>{item.days_until_low_stock ?? 'N/A'}</td>
                                                <td style={{ ...tdStyle }}>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: 999,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: item.will_run_low_within_horizon ? '#fb7185' : '#4ade80',
                                                        background: item.will_run_low_within_horizon ? '#fb718522' : '#4ade8022',
                                                    }}>
                                                        {item.will_run_low_within_horizon ? 'AT RISK' : 'OK'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 14 }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>Top At-Risk Products</h3>
                            {topAtRisk.length === 0 ? (
                                <div style={{ color: '#94a3b8', fontSize: 13 }}>No products are projected to hit low stock in this horizon.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {topAtRisk.map((item) => (
                                        <div key={item.product_id} style={{ border: '1px solid #3f3f5f', borderRadius: 10, padding: '8px 10px' }}>
                                            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{item.name}</div>
                                            <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                                Low in about {item.days_until_low_stock ?? 'N/A'} days • stock {item.current_stock}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                <h3 style={{ margin: 0, fontSize: 14, color: '#e2e8f0' }}>Gemini Insights</h3>
                                <span style={{
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: gemini.enabled ? '#4ade80' : '#f59e0b',
                                    background: gemini.enabled ? '#4ade8022' : '#f59e0b22',
                                }}>
                                    {gemini.enabled ? 'ACTIVE' : 'STATS ONLY'}
                                </span>
                            </div>

                            {gemini.error ? (
                                <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>{gemini.error}</div>
                            ) : null}

                            <pre style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: '#cbd5e1',
                                fontSize: 12,
                                lineHeight: 1.6,
                                maxHeight: shouldScrollInsights ? 320 : 'none',
                                overflowY: shouldScrollInsights ? 'auto' : 'visible',
                                overflowX: 'hidden',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            }}>
                                {insightsText}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ title, value, color }) {
    return (
        <div style={{
            background: '#1a1a2e',
            border: `1px solid ${color}44`,
            borderRadius: 12,
            padding: '13px 14px',
        }}>
            <div style={{ color, fontWeight: 800, fontSize: 24, lineHeight: 1.2 }}>{value}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{title}</div>
        </div>
    );
}

const tdStyle = {
    color: '#cbd5e1',
    fontSize: 13,
    padding: '12px 14px',
    borderBottom: '1px solid #2a2a4a',
};
