import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute, { PermissionRoute, SuperUserRoute } from './routes/PrivateRoute';

import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Products    from './pages/Products';
import AddProduct  from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import Purchases   from './pages/Purchases';
import Sales       from './pages/Sales';
import SalesHistory from './pages/SalesHistory';
import Profits     from './pages/Profits';
import Categories  from './pages/Categories';
import Suppliers   from './pages/Suppliers';
import UserManagement from './pages/UserManagement';
import AuditLog    from './pages/AuditLog';
import LowStock    from './pages/LowStock';
import Trash       from './pages/Trash';
import Vouchers    from './pages/Vouchers';
import Settings    from './pages/Settings';


export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public */}
                    <Route path="/login" element={<Login />} />

                    {/* Admin + Staff */}
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/products"  element={<PrivateRoute><Products  /></PrivateRoute>} />
                    <Route path="/sales"     element={<PrivateRoute><Sales     /></PrivateRoute>} />
                    <Route path="/low-stock" element={<PrivateRoute><LowStock  /></PrivateRoute>} />
                    <Route path="/settings"  element={<PrivateRoute><Settings  /></PrivateRoute>} />

                    {/* Admin only */}
                    <Route path="/products/add"      element={<PermissionRoute permission="products.create"><AddProduct  /></PermissionRoute>} />
                    <Route path="/products/edit/:id" element={<PermissionRoute permission="products.update"><EditProduct /></PermissionRoute>} />
                    <Route path="/purchases"         element={<PermissionRoute permission="purchases.manage"><Purchases   /></PermissionRoute>} />
                    <Route path="/profits"           element={<SuperUserRoute><Profits     /></SuperUserRoute>} />
                    <Route path="/categories"        element={<PermissionRoute permission="categories.manage"><Categories  /></PermissionRoute>} />
                    <Route path="/vouchers" element={<PermissionRoute permission="vouchers.manage"><Vouchers /></PermissionRoute>} />
                    <Route path="/suppliers"         element={<PermissionRoute permission="suppliers.manage"><Suppliers   /></PermissionRoute>} />
                    <Route path="/users"             element={<SuperUserRoute><UserManagement /></SuperUserRoute>} />
                    <Route path="/audit-log"         element={<PermissionRoute permission="audit.view"><AuditLog    /></PermissionRoute>} />
                    <Route path="/sales-history"     element={<PermissionRoute permission="sales.history.view"><SalesHistory /></PermissionRoute>} />
                    <Route path="/trash"             element={<PermissionRoute permission="trash.access"><Trash /></PermissionRoute>} />
                    <Route path="/"                  element={<Navigate to="/dashboard" replace />} />
                    <Route path="*"                  element={<Navigate to="/login"     replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
