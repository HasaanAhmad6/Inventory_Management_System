import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser]       = useState(null);
    const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('access')));

    useEffect(() => {
        const token = localStorage.getItem('access');
        if (token) {
            API.get('auth/me/')
                .then(res => setUser(res.data))
                .catch(() => {
                    localStorage.removeItem('access');
                    localStorage.removeItem('refresh');
                })
                .finally(() => setLoading(false));
        }
    }, []);

    const login = async (username, password) => {
        const res = await API.post('auth/login/', { username, password });
        localStorage.setItem('access',  res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        const meRes = await API.get('auth/me/');
        setUser(meRes.data);
    };

    const logout = () => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        setUser(null);
    };

    const isAdmin = () => user?.role === 'admin' || user?.is_superuser;
    const isSuperUser = () => !!user?.is_superuser;
    const isStaff = () => user?.role === 'staff';
    const canManageUsers = () => !!user?.can_manage_users;
    const can = (permission) => {
        if (!user) return false;
        if (isSuperUser()) return true;
        return Array.isArray(user.permissions) && user.permissions.includes(permission);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isSuperUser, isStaff, can, canManageUsers }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
