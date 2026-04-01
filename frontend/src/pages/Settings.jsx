import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const navigate = useNavigate();
    const { can } = useAuth();
    const canManageThreshold = can('products.update');

    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [globalThreshold, setGlobalThreshold] = useState('10');
    const [savingThreshold, setSavingThreshold] = useState(false);
    const [thresholdMessage, setThresholdMessage] = useState('');
    const [thresholdError, setThresholdError] = useState('');

    const applyThresholdToAll = async () => {
        setThresholdMessage('');
        setThresholdError('');
        const value = Number(globalThreshold);
        if (!Number.isInteger(value) || value < 0) {
            setThresholdError('Threshold must be a non-negative integer.');
            return;
        }

        setSavingThreshold(true);
        try {
            const res = await API.post('low-stock/set-threshold-all/', { threshold: value });
            const updated = Number(res.data?.updated_count || 0);
            setThresholdMessage(`Updated threshold to ${value} for ${updated} product(s).`);
        } catch (err) {
            setThresholdError(err.response?.data?.detail || 'Failed to update thresholds.');
        } finally {
            setSavingThreshold(false);
        }
    };

    const onPasswordFieldChange = (e) => {
        const { name, value } = e.target;
        setPasswordForm(prev => ({ ...prev, [name]: value }));
    };

    const submitPasswordChange = async (e) => {
        e.preventDefault();
        setPasswordMessage('');
        setPasswordError('');

        if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
            setPasswordError('All password fields are required.');
            return;
        }
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPasswordError('New password and confirm password do not match.');
            return;
        }

        setChangingPassword(true);
        try {
            const res = await API.post('auth/change-password/', passwordForm);
            setPasswordMessage(res.data?.detail || 'Password changed successfully. Please log in again.');
            setPasswordForm({
                current_password: '',
                new_password: '',
                confirm_password: '',
            });
        } catch (err) {
            setPasswordError(err.response?.data?.detail || 'Failed to change password.');
        } finally {
            setChangingPassword(false);
        }
    };

    return (
        <Layout>
            <div style={{ padding: '28px 24px' }}>
                <div style={{ marginBottom: 20 }}>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 700 }}>App Settings</h2>
                    <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: 14 }}>
                        Central place for system-level configuration. More settings will be added here as the project grows.
                    </p>
                </div>

                <div style={{
                    background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12,
                    padding: 18, marginBottom: 14,
                }}>
                    <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 15 }}>
                        Account Security
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                        Change your login password.
                    </div>

                    <form onSubmit={submitPasswordChange}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                            <input
                                type="password"
                                name="current_password"
                                value={passwordForm.current_password}
                                onChange={onPasswordFieldChange}
                                placeholder="Current password"
                                style={{
                                    padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a',
                                    background: '#0f0f23', color: '#fff', outline: 'none',
                                }}
                            />
                            <input
                                type="password"
                                name="new_password"
                                value={passwordForm.new_password}
                                onChange={onPasswordFieldChange}
                                placeholder="New password"
                                style={{
                                    padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a',
                                    background: '#0f0f23', color: '#fff', outline: 'none',
                                }}
                            />
                            <input
                                type="password"
                                name="confirm_password"
                                value={passwordForm.confirm_password}
                                onChange={onPasswordFieldChange}
                                placeholder="Confirm new password"
                                style={{
                                    padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a',
                                    background: '#0f0f23', color: '#fff', outline: 'none',
                                }}
                            />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <button
                                type="submit"
                                disabled={changingPassword}
                                style={{
                                    background: changingPassword ? '#64748b' : '#2563eb',
                                    border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8,
                                    padding: '9px 14px', cursor: changingPassword ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                }}
                            >
                                {changingPassword ? 'Updating Password...' : 'Change Password'}
                            </button>
                        </div>
                    </form>

                    {passwordError && <div style={{ color: '#fca5a5', marginTop: 10, fontSize: 12 }}>{passwordError}</div>}
                    {passwordMessage && <div style={{ color: '#86efac', marginTop: 10, fontSize: 12 }}>{passwordMessage}</div>}
                </div>

                {canManageThreshold && (
                    <div style={{
                        background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12,
                        padding: 18, marginBottom: 14,
                    }}>
                        <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 15 }}>
                            Inventory Threshold Settings
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                            Set one low-stock threshold for all products.
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="number"
                                min="0"
                                value={globalThreshold}
                                onChange={e => setGlobalThreshold(e.target.value)}
                                style={{
                                    width: 180, padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2a4a',
                                    background: '#0f0f23', color: '#fff', outline: 'none',
                                }}
                                placeholder="e.g. 10"
                            />
                            <button
                                type="button"
                                onClick={applyThresholdToAll}
                                disabled={savingThreshold}
                                style={{
                                    background: savingThreshold ? '#64748b' : '#2563eb',
                                    border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8,
                                    padding: '9px 14px', cursor: savingThreshold ? 'not-allowed' : 'pointer',
                                    fontWeight: 700,
                                }}
                            >
                                {savingThreshold ? 'Applying...' : 'Apply To All Products'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/low-stock')}
                                style={{
                                    background: '#0f0f23', border: '1px solid #2a2a4a', color: '#cbd5e1', borderRadius: 8,
                                    padding: '9px 14px', cursor: 'pointer', fontWeight: 600,
                                }}
                            >
                                View Low Stock
                            </button>
                        </div>

                        {thresholdError && <div style={{ color: '#fca5a5', marginTop: 10, fontSize: 12 }}>{thresholdError}</div>}
                        {thresholdMessage && <div style={{ color: '#86efac', marginTop: 10, fontSize: 12 }}>{thresholdMessage}</div>}
                    </div>
                )}

                <div style={{
                    background: '#1a1a2e', border: '1px dashed #334155', borderRadius: 12,
                    padding: 18,
                }}>
                    <div style={{ color: '#cbd5e1', fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>
                        This section is reserved for future settings like invoice preferences, notification rules, and role-based defaults.
                    </div>
                </div>
            </div>
        </Layout>
    );
}
