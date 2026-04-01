import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function EyeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M9.9 4.24A10.81 10.81 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.12 4.17" />
            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
            <path d="M1 1l22 22" />
        </svg>
    );
}

export default function Login() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(form.username, form.password);
            navigate('/dashboard');
        } catch (err) {
            if (!err.response) setError('Cannot connect to server. Is Django running?');
            else if (err.response.status === 401) {
                setError(err.response?.data?.detail || 'Incorrect username or password.');
                setForm(prev => ({ ...prev, password: '' }));
                setShowPassword(false);
            }
            else setError(`Error: ${JSON.stringify(err.response?.data)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            {/* Left Panel */}
            <div style={styles.leftPanel}>
                <div style={styles.leftContent}>
                    <div style={styles.brandIcon}>📦</div>
                    <h1 style={styles.brandTitle}>Inventory<br />Management<br />System</h1>
                    <p style={styles.brandDesc}>
                        Track products, manage stock levels, record purchases and sales — all in one place.
                    </p>
                    <div style={styles.featureList}>
                        {['Real-time stock tracking', 'Low stock alerts', 'Sales & purchase history', 'Analytics dashboard'].map(f => (
                            <div key={f} style={styles.featureItem}>
                                <span style={styles.featureCheck}>✓</span>
                                {f}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div style={styles.rightPanel}>
                <div style={styles.formCard}>
                    <h2 style={styles.formTitle}>Welcome back</h2>
                    <p style={styles.formSubtitle}>Sign in to your account to continue</p>

                    {error && (
                        <div style={styles.errorBox}>
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={styles.field}>
                            <label style={styles.label}>Username</label>
                            <input
                                style={styles.input}
                                value={form.username}
                                onChange={e => setForm({ ...form, username: e.target.value })}
                                placeholder="Enter your username"
                                required
                                autoFocus
                            />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Password</label>
                            <div style={styles.passwordWrap}>
                                <input
                                    style={styles.passwordInput}
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    style={styles.passwordToggle}
                                    onClick={() => setShowPassword(prev => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" style={loading ? styles.btnLoading : styles.btn} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In →'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#0f0f23',
    },
    leftPanel: {
        flex: 1,
        backgroundColor: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
    },
    leftContent: {
        maxWidth: 400,
    },
    brandIcon: {
        fontSize: 48,
        marginBottom: 24,
    },
    brandTitle: {
        color: 'white',
        fontSize: 42,
        fontWeight: 800,
        lineHeight: 1.15,
        margin: '0 0 20px 0',
    },
    brandDesc: {
        color: '#94A3B8',
        fontSize: 16,
        lineHeight: 1.7,
        margin: '0 0 32px 0',
    },
    featureList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    featureItem: {
        color: '#CBD5E1',
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    featureCheck: {
        color: '#22C55E',
        fontWeight: 700,
        fontSize: 16,
    },
    rightPanel: {
        width: 480,
        backgroundColor: '#0f0f23',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    formCard: {
        backgroundColor: '#1a1a2e',
        border: '1px solid #2a2a4a',
        borderRadius: 16,
        padding: 40,
        width: '100%',
        boxShadow: '0 12px 28px rgba(2, 6, 23, 0.45)',
    },
    formTitle: {
        margin: '0 0 6px',
        fontSize: 26,
        fontWeight: 700,
        color: '#fff',
    },
    formSubtitle: {
        margin: '0 0 28px',
        color: '#94A3B8',
        fontSize: 14,
    },
    errorBox: {
        backgroundColor: '#450a0a22',
        color: '#f87171',
        padding: '12px 16px',
        borderRadius: 10,
        marginBottom: 20,
        fontSize: 14,
        border: '1px solid #dc262644',
    },
    field: {
        marginBottom: 20,
    },
    label: {
        display: 'block',
        marginBottom: 7,
        fontWeight: 600,
        fontSize: 14,
        color: '#cbd5e1',
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #2a2a4a',
        fontSize: 15,
        boxSizing: 'border-box',
        outline: 'none',
        backgroundColor: '#0f0f23',
        color: '#fff',
        transition: 'border-color 0.2s',
    },
    passwordWrap: {
        position: 'relative',
    },
    passwordInput: {
        width: '100%',
        padding: '12px 44px 12px 14px',
        borderRadius: 10,
        border: '1px solid #2a2a4a',
        fontSize: 15,
        boxSizing: 'border-box',
        outline: 'none',
        backgroundColor: '#0f0f23',
        color: '#fff',
        transition: 'border-color 0.2s',
    },
    passwordToggle: {
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        border: 'none',
        background: 'transparent',
        color: '#94A3B8',
        fontSize: 18,
        cursor: 'pointer',
        padding: '4px 6px',
        lineHeight: 1,
    },
    btn: {
        width: '100%',
        padding: '13px',
        backgroundColor: '#6c63ff',
        color: 'white',
        border: 'none',
        borderRadius: 10,
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: 8,
        boxShadow: '0 4px 14px rgba(108,99,255,0.35)',
    },
    btnLoading: {
        width: '100%',
        padding: '13px',
        backgroundColor: '#94A3B8',
        color: 'white',
        border: 'none',
        borderRadius: 10,
        fontSize: 16,
        fontWeight: 600,
        cursor: 'not-allowed',
        marginTop: 8,
    },
};
