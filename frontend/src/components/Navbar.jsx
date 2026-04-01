import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { user, logout, can } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Debug: Log trash access
    console.log('Navbar - User:', user?.username, 'Is Superuser:', user?.is_superuser, 'Can trash.access:', can('trash.access'));

    return (
        <nav style={styles.nav}>
            <div style={styles.brand}>📦 Inventory System</div>
            <div style={styles.links}>
                <Link to='/dashboard' style={styles.link}>Dashboard</Link>
                <Link to='/products' style={styles.link}>Products</Link>
                <Link to='/purchases' style={styles.link}>Purchases</Link>
                <Link to='/sales' style={styles.link}>Sales</Link>
                <Link to='/trash' style={styles.link}>🗑️ Trash</Link>
            </div>
            <div style={styles.user}>
                <span style={{ color: '#ccc', marginRight: 12 }}>👤 {user?.username}</span>
                <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
            </div>
        </nav>
    );
}

const styles = {
    nav: { display:'flex', alignItems:'center', justifyContent:'space-between',
           backgroundColor:'#1F3864', padding:'12px 24px', position:'sticky', top:0, zIndex:100 },
    brand: { color:'white', fontWeight:'bold', fontSize:18 },
    links: { display:'flex', gap:24 },
    link: { color:'#AED6F1', textDecoration:'none', fontSize:15, fontWeight:500 },
    user: { display:'flex', alignItems:'center' },
    logoutBtn: { backgroundColor:'#E74C3C', color:'white', border:'none',
                 padding:'6px 14px', borderRadius:6, cursor:'pointer' }
};
