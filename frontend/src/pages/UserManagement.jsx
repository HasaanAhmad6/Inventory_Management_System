import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import useBreakpoint from '../hooks/useBreakpoint';
import FormModal from '../components/FormModal';
import { modalActionStyles } from '../components/modalActionStyles';

export default function UserManagement() {
    const { user: currentUser, canManageUsers } = useAuth();
    const { isMobile, isTablet } = useBreakpoint();
    const [users, setUsers]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');

    // Add user modal
    const [showAddModal, setShowAddModal]   = useState(false);
    const [addForm, setAddForm]             = useState({ username: '', email: '', password: '', confirm_password: '', role: 'staff', staff_permissions: [] });
    const [addLoading, setAddLoading]       = useState(false);
    const [addError, setAddError]           = useState('');

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTarget, setEditTarget]       = useState(null);
    const [editForm, setEditForm]           = useState({ role: 'staff', is_active: true, password: '', staff_permissions: [] });
    const [editLoading, setEditLoading]     = useState(false);
    const [editError, setEditError]         = useState('');

    // Delete confirm
    const [deleteTarget, setDeleteTarget]   = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [staffPermissionOptions, setStaffPermissionOptions] = useState([]);
    const [staffDefaultPermissions, setStaffDefaultPermissions] = useState([]);
    const [adminPermissionOptions, setAdminPermissionOptions] = useState([]);
    const [adminDefaultPermissions, setAdminDefaultPermissions] = useState([]);

    const fetchUsers = () => {
        setLoading(true);
        API.get('auth/users/')
            .then(res => {
                setUsers(res.data);
                setError('');
            })
            .catch(err => setError(err.response?.data?.detail || 'Failed to load users.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        API.get('auth/me/')
            .then(res => {
                setStaffPermissionOptions(res.data.available_staff_permissions || []);
                setStaffDefaultPermissions(res.data.default_staff_permissions || []);
                setAdminPermissionOptions(res.data.available_admin_permissions || []);
                setAdminDefaultPermissions(res.data.default_admin_permissions || []);
            })
            .catch(() => {
                setStaffPermissionOptions([]);
                setStaffDefaultPermissions([]);
                setAdminPermissionOptions([]);
                setAdminDefaultPermissions([]);
            });
        fetchUsers();
    }, []);

    const flash = (msg) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(''), 3000);
    };

    // ── ADD USER ──────────────────────────────────────────────────────────────
    const handleAdd = async () => {
        setAddError('');
        if (!addForm.username || !addForm.email || !addForm.password) {
            setAddError('Username, email, and password are required.');
            return;
        }
        if (addForm.password !== addForm.confirm_password) {
            setAddError('Password and confirm password do not match.');
            return;
        }
        setAddLoading(true);
        try {
            const payload = {
                username: addForm.username,
                email: addForm.email,
                password: addForm.password,
                role: addForm.role,
                staff_permissions: addForm.staff_permissions,
            };
            await API.post('auth/register/', payload);
            setShowAddModal(false);
            setAddForm({ username: '', email: '', password: '', confirm_password: '', role: 'staff', staff_permissions: [] });
            fetchUsers();
            flash('User created successfully.');
        } catch (err) {
            const data = err.response?.data;
            setAddError(data?.username?.[0] || data?.email?.[0] || data?.password?.[0] || data?.detail || 'Failed to create user.');
        } finally {
            setAddLoading(false);
        }
    };

    // ── EDIT USER ─────────────────────────────────────────────────────────────
    const openEdit = (u) => {
        setEditTarget(u);
        setEditForm({ role: u.role, is_active: u.is_active, password: '', staff_permissions: u.staff_permissions || [] });
        setEditError('');
        setShowEditModal(true);
    };

    const handleEdit = async () => {
        setEditError('');
        setEditLoading(true);
        try {
            const payload = { role: editForm.role, is_active: editForm.is_active, staff_permissions: editForm.staff_permissions || [] };
            if (editForm.password) payload.password = editForm.password;
            await API.patch(`auth/users/${editTarget.id}/update/`, payload);
            setShowEditModal(false);
            fetchUsers();
            flash('User updated successfully.');
        } catch (err) {
            setEditError(err.response?.data?.detail || 'Failed to update user.');
        } finally {
            setEditLoading(false);
        }
    };

    // ── DELETE USER ───────────────────────────────────────────────────────────
    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            await API.delete(`auth/users/${deleteTarget.id}/delete/`);
            setDeleteTarget(null);
            fetchUsers();
            flash('User deleted successfully.');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete user.');
            setDeleteTarget(null);
        } finally {
            setDeleteLoading(false);
        }
    };

    // ── STYLES ────────────────────────────────────────────────────────────────
    const s = styles({ isMobile, isTablet });

    const togglePermission = (target, permission, setFn) => {
        const list = target.staff_permissions || [];
        if (list.includes(permission)) {
            setFn({ ...target, staff_permissions: list.filter(p => p !== permission) });
            return;
        }
        setFn({ ...target, staff_permissions: [...list, permission] });
    };

    const rolePermissionOptions = (role) => (role === 'admin' ? adminPermissionOptions : staffPermissionOptions);
    const roleDefaultPermissions = (role) => (role === 'admin' ? adminDefaultPermissions : staffDefaultPermissions);
    const permissionLabel = (permission) => {
        const labels = {
            'products.create': 'Products - Create',
            'products.read': 'Products - Read',
            'products.update': 'Products - Update',
            'products.delete': 'Products - Delete',
            'sales.create': 'Sales - Create',
            'sales.history.view': 'Sales - History View',
            'stock.view': 'Stock - View',
            'forecast.view': 'Forecast - View',
            'purchases.view': 'Purchases - View',
            'purchases.manage': 'Purchases - Manage',
            'categories.manage': 'Categories - Manage',
            'suppliers.manage': 'Suppliers - Manage',
            'audit.view': 'Audit Log - View',
            'trash.access': 'Trash - Access & Restore',
        };
        return labels[permission] || permission;
    };

    return (
        <Layout>
            <div style={s.page}>

                {/* Header */}
                <div style={s.header}>
                    <div>
                        <h2 style={s.title}>User Management</h2>
                        <p style={s.subtitle}>Add, edit, and manage user accounts and their roles.</p>
                    </div>
                    <button style={canManageUsers() ? s.addBtn : s.btnDisabled} disabled={!canManageUsers()} onClick={() => { setAddError(''); setShowAddModal(true); }}>
                        + Add User
                    </button>
                </div>
                {!canManageUsers() && (
                    <div style={s.errorBox}>⚠️ Only superuser can manage users and staff permissions.</div>
                )}

                {/* Flash messages */}
                {success && <div style={s.successBox}>✓ {success}</div>}
                {error   && <div style={s.errorBox}>⚠️ {error}</div>}

                {/* Table */}
                {loading ? (
                    <div style={s.center}>Loading users...</div>
                ) : (
                    <div style={s.tableWrap}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {['#', 'Username', 'Email', 'Role', 'Status', 'Joined', 'Last Login', 'Actions'].map(h => (
                                        <th key={h} style={s.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <tr key={u.id} style={s.tr}>
                                        <td style={s.td}>{i + 1}</td>
                                        <td style={s.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: '50%',
                                                    background: u.is_superuser ? '#f59e0b' : u.role === 'admin' ? '#6c63ff' : '#1e40af',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0
                                                }}>
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                                                        {u.username}
                                                        {u.id === currentUser?.id && (
                                                            <span style={{ marginLeft: 6, fontSize: 10, background: '#1e3a5f', color: '#60a5fa', padding: '1px 6px', borderRadius: 8 }}>you</span>
                                                        )}
                                                    </div>
                                                    {u.is_superuser && (
                                                        <div style={{ fontSize: 10, color: '#f59e0b' }}>superuser</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={s.td}><span style={{ color: '#94a3b8', fontSize: 13 }}>{u.email || '—'}</span></td>
                                        <td style={s.td}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                background: u.role === 'admin' ? '#6c63ff22' : '#1e40af22',
                                                color:      u.role === 'admin' ? '#a89cff'   : '#60a5fa',
                                                border: `1px solid ${u.role === 'admin' ? '#6c63ff44' : '#1e40af44'}`,
                                            }}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={s.td}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                background: u.is_active ? '#16a34a22' : '#dc262622',
                                                color:      u.is_active ? '#4ade80'   : '#f87171',
                                                border: `1px solid ${u.is_active ? '#16a34a44' : '#dc262644'}`,
                                            }}>
                                                {u.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={s.td}><span style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(u.date_joined).toLocaleDateString()}</span></td>
                                        <td style={s.td}><span style={{ color: '#94a3b8', fontSize: 12 }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</span></td>
                                        <td style={s.td}>
                                            {!u.is_superuser && u.id !== currentUser?.id && canManageUsers() ? (
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                        <button style={s.editBtn} onClick={() => openEdit(u)}>Edit</button>
                                                        <button style={s.deleteBtn} onClick={() => setDeleteTarget(u)}>Delete</button>
                                                    </div>
                                            ) : (
                                                <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── ADD USER MODAL ─────────────────────────────────────────── */}
            <FormModal
                open={showAddModal}
                title="Add New User"
                onClose={() => setShowAddModal(false)}
                error={addError}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
                        <button type="button" style={addLoading || !canManageUsers() ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={addLoading || !canManageUsers()} onClick={handleAdd}>
                            {addLoading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                )}
            >
                        <div style={s.field}>
                            <label style={s.label}>Username *</label>
                            <input style={s.input} placeholder="e.g. john_doe"
                                value={addForm.username}
                                onChange={e => setAddForm({ ...addForm, username: e.target.value })} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Email *</label>
                            <input style={s.input} placeholder="e.g. john@example.com" type="email"
                                value={addForm.email}
                                onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Password *</label>
                            <input style={s.input} placeholder="Min 8 characters" type="password"
                                value={addForm.password}
                                onChange={e => setAddForm({ ...addForm, password: e.target.value })} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Confirm Password *</label>
                            <input style={s.input} placeholder="Re-enter password" type="password"
                                value={addForm.confirm_password}
                                onChange={e => setAddForm({ ...addForm, confirm_password: e.target.value })} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Role</label>
                            <select style={s.input} value={addForm.role}
                                onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
                                <option value="staff">Staff — permissions controlled below</option>
                                <option value="admin">Admin — full access to everything</option>
                            </select>
                        </div>
                        {rolePermissionOptions(addForm.role).length > 0 && (
                            <div style={s.field}>
                                <label style={s.label}>{addForm.role === 'admin' ? 'Admin Permissions' : 'Staff Permissions'}</label>
                                <div style={s.permissionsGrid}>
                                    {rolePermissionOptions(addForm.role).map(p => {
                                        const enabled = (addForm.staff_permissions || []).includes(p);
                                        const always = (roleDefaultPermissions(addForm.role) || []).includes(p);
                                        return (
                                            <label key={p} style={{ ...s.permissionItem, opacity: always ? 0.7 : 1 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={enabled || always}
                                                    disabled={false}
                                                    onChange={() => togglePermission(addForm, p, setAddForm)}
                                                />
                                                <span>{permissionLabel(p)}{always ? ' (default)' : ''}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
            </FormModal>

            {/* ── EDIT USER MODAL ────────────────────────────────────────── */}
            <FormModal
                open={showEditModal && !!editTarget}
                title={editTarget ? `Edit User — ${editTarget.username}` : 'Edit User'}
                onClose={() => setShowEditModal(false)}
                error={editError}
                footer={(
                    <div style={modalActionStyles.row}>
                        <button type="button" style={modalActionStyles.cancelBtn} onClick={() => setShowEditModal(false)}>Cancel</button>
                        <button type="button" style={editLoading || !canManageUsers() ? modalActionStyles.primaryBtnDisabled : modalActionStyles.primaryBtn} disabled={editLoading || !canManageUsers()} onClick={handleEdit}>
                            {editLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            >
                        <div style={s.field}>
                            <label style={s.label}>Role</label>
                            <select style={s.input} value={editForm.role}
                                onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                <option value="staff">Staff — permissions controlled below</option>
                                <option value="admin">Admin — full access to everything</option>
                            </select>
                        </div>
                        {rolePermissionOptions(editForm.role).length > 0 && (
                            <div style={s.field}>
                                <label style={s.label}>{editForm.role === 'admin' ? 'Admin Permissions' : 'Staff Permissions'}</label>
                                <div style={s.permissionsGrid}>
                                    {rolePermissionOptions(editForm.role).map(p => {
                                        const enabled = (editForm.staff_permissions || []).includes(p);
                                        const always = (roleDefaultPermissions(editForm.role) || []).includes(p);
                                        return (
                                            <label key={p} style={{ ...s.permissionItem, opacity: always ? 0.7 : 1 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={enabled || always}
                                                    disabled={false}
                                                    onChange={() => togglePermission(editForm, p, setEditForm)}
                                                />
                                                <span>{permissionLabel(p)}{always ? ' (default)' : ''}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div style={s.field}>
                            <label style={s.label}>Account Status</label>
                            <select style={s.input} value={editForm.is_active}
                                onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}>
                                <option value="true">Active — user can log in</option>
                                <option value="false">Inactive — user is blocked from logging in</option>
                            </select>
                        </div>

                        <div style={s.field}>
                            <label style={s.label}>New Password <span style={{ color: '#64748b', fontWeight: 400 }}>(leave empty to keep current)</span></label>
                            <input style={s.input} placeholder="Enter new password to change it" type="password"
                                value={editForm.password}
                                onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
                        </div>
            </FormModal>

            {/* ── DELETE CONFIRM MODAL ───────────────────────────────────── */}
            {deleteTarget && (
                <div style={s.overlay}>
                    <div style={{ ...s.modal, maxWidth: 420 }}>
                        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                            <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: 20 }}>Delete User?</h3>
                            <p style={{ color: '#94a3b8', margin: '0 0 24px', fontSize: 14 }}>
                                You are about to permanently delete <strong style={{ color: '#fff' }}>{deleteTarget.username}</strong>.
                                This cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <button style={modalActionStyles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
                                <button style={deleteLoading || !canManageUsers() ? modalActionStyles.primaryBtnDisabled : s.dangerBtn} disabled={deleteLoading || !canManageUsers()} onClick={handleDelete}>
                                    {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

const styles = ({ isMobile, isTablet }) => {
    const isCompact = isMobile || isTablet;
    return ({
    page:       { padding: isMobile ? 16 : (isTablet ? 20 : 28), maxWidth: 1200, margin: '0 auto' },
    header:     { display: 'flex', justifyContent: 'space-between', alignItems: isCompact ? 'stretch' : 'flex-start', flexDirection: isCompact ? 'column' : 'row', gap: isCompact ? 10 : 0, marginBottom: 24 },
    title:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' },
    subtitle:   { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
    addBtn:     { padding: '10px 20px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    btnDisabled:{ padding: '10px 20px', background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'not-allowed' },
    successBox: { background: '#14532d22', border: '1px solid #16a34a44', color: '#4ade80', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
    errorBox:   { background: '#450a0a22', border: '1px solid #dc262644', color: '#f87171', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
    center:     { textAlign: 'center', color: '#94a3b8', padding: 60 },
    tableWrap:  { background: '#1a1a2e', borderRadius: 16, border: '1px solid #2a2a4a', overflowX: 'auto', overflowY: 'hidden' },
    table:      { width: '100%', minWidth: isCompact ? 980 : 0, borderCollapse: 'collapse' },
    th:         { padding: isCompact ? '12px 12px' : '14px 16px', textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap' },
    tr:         { borderBottom: '1px solid #1e1e3a' },
    td:         { padding: isCompact ? '12px 12px' : '14px 16px', verticalAlign: 'middle', whiteSpace: isCompact ? 'nowrap' : 'normal' },
    editBtn:    { padding: '5px 14px', background: '#1e40af22', color: '#60a5fa', border: '1px solid #1e40af44', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    deleteBtn:  { padding: '5px 14px', background: '#dc262622', color: '#f87171', border: '1px solid #dc262644', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    field:      { marginBottom: 18 },
    label:      { display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 600, marginBottom: 7 },
    input:      { width: '100%', padding: '10px 14px', background: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    permissionsGrid: { display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: 8, background: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: 10, padding: 10 },
    permissionItem: { display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: 12 },
    dangerBtn:  { flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, minHeight: 40 },
    overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 },
    modal:      { background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 16, padding: isMobile ? 16 : 24, width: '100%', maxHeight: 'min(88vh, 760px)', overflowY: 'auto' },
});
};

