import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useBreakpoint from "../hooks/useBreakpoint";
import NotificationBell from "./NotificationBell";

const SIDEBAR_SCROLL_KEY = "sidebar-scroll-top";

export default function Sidebar() {
    const location    = useLocation();
    const navigate    = useNavigate();
    const { isMobile, isTablet } = useBreakpoint();
    const { user, logout, isAdmin, isSuperUser, can, canManageUsers } = useAuth();
    const scrollAreaRef = useRef(null);

    const menuItems = [
        { path: "/dashboard",  icon: "🏠", label: "Dashboard"  },
        ...(can('products.read') || can('products.create') || can('products.update') || can('products.delete') || can('stock.view') || can('sales.create') || can('purchases.manage') ? [{ path: "/products", icon: "📦", label: "Products" }] : []),
        ...(can('sales.create') ? [{ path: "/sales", icon: "💰", label: "Sales" }] : []),
        ...(can('stock.view') ? [{ path: "/low-stock", icon: "⚠️", label: "Low Stock" }] : []),
        ...(can('forecast.view') ? [{ path: "/demand-forecast", icon: "🔮", label: "Forecast" }] : []),
        ...(can('purchases.manage') ? [
            { path: "/purchases", icon: "🛒", label: "Purchases" },
        ] : []),
        ...(isSuperUser() ? [
            { path: "/profits",   icon: "📈", label: "Profits"   },
        ] : []),
    ];

const manageItems = [
    { path: "/settings", icon: "⚙️", label: "Settings" },
    ...(can('categories.manage') ? [{ path: "/categories",  icon: "🏷️", label: "Categories" }] : []),
    ...(can('suppliers.manage') ? [{ path: "/suppliers", icon: "🏭", label: "Suppliers" }] : []),
    ...(can('vouchers.manage') ? [{ path: "/vouchers", icon: "🎟️", label: "Vouchers" }] : []),
    ...(can('sales.history.view') ? [{ path: "/sales-history", icon: "📜", label: "Sales History" }] : []),
    ...(canManageUsers() ? [{ path: "/users", icon: "👥", label: "Users" }] : []),
    ...(can('audit.view') ? [{ path: "/audit-log", icon: "🕵️", label: "Audit Log" }] : []),
    ...(can('trash.access') ? [{ path: "/trash", icon: "🗑️", label: "Trash" }] : []),
];

    const handleLogout = () => { logout(); navigate("/login"); };
    const isActive = (path) => location.pathname === path;

    useEffect(() => {
        if (isMobile || isTablet) return;
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;
        const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
        if (saved !== null) {
            scrollArea.scrollTop = Number(saved) || 0;
        }
    }, [isMobile, isTablet, location.pathname]);

    const handleScroll = () => {
        if (isMobile || isTablet) return;
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(scrollArea.scrollTop));
    };

    // ── MOBILE ────────────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <>
                {/* Top bar */}
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, height: 56,
                    background: "#1a1a2e", display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "0 16px", zIndex: 1000,
                    borderBottom: "1px solid #2a2a4a"
                }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>InvMS</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <NotificationBell />
                        <span style={{ color: "#aaa", fontSize: 13 }}>{user?.username}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            background: isAdmin() ? "#6c63ff33" : "#ffffff15",
                            color: isAdmin() ? "#a89cff" : "#888",
                        }}>
                            {user?.role?.toUpperCase()}
                        </span>
                        <button onClick={handleLogout} style={{
                            background: "#e74c3c22", border: "1px solid #e74c3c55",
                            color: "#e74c3c", borderRadius: 8, padding: "4px 10px",
                            cursor: "pointer", fontSize: 12
                        }}>Logout</button>
                    </div>
                </div>

                {/* Bottom tab bar */}
                <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
                    background: "#1a1a2e", display: "flex", alignItems: "center",
                    justifyContent: "space-around", zIndex: 1000,
                    borderTop: "1px solid #2a2a4a"
                }}>
                    {[...menuItems.slice(0, 4), ...(manageItems.length ? [{ path: manageItems[0].path, icon: "⚙️", label: "More" }] : [])].map((item) => {
                        const active = item.label === "More"
                            ? manageItems.map(x => x.path).includes(location.pathname)
                            : isActive(item.path);
                        return (
                            <Link key={item.path} to={item.path} style={{
                                display: "flex", flexDirection: "column", alignItems: "center",
                                gap: 2, textDecoration: "none", padding: "8px 12px",
                                borderRadius: 10, background: active ? "#6c63ff22" : "transparent",
                                minWidth: 52
                            }}>
                                <span style={{ fontSize: 20 }}>{item.icon}</span>
                                <span style={{ color: active ? "#6c63ff" : "#888", fontSize: 10, fontWeight: active ? 700 : 400 }}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </>
        );
    }

    // ── TABLET ────────────────────────────────────────────────────────────────
    if (isTablet) {
        return (
            <div style={{
                position: "fixed", top: 0, left: 0, bottom: 0, width: 68,
                background: "#1a1a2e", display: "flex", flexDirection: "column",
                alignItems: "center", paddingTop: 16, zIndex: 1000,
                borderRight: "1px solid #2a2a4a"
            }}>
                <div style={{ marginBottom: 24, color: "#6c63ff", fontSize: 24, lineHeight: 1 }} aria-label="Inventory logo">📦</div>
                {[...menuItems, ...manageItems].map((item) => (
                    <Link key={item.path} to={item.path} title={item.label} style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 44, height: 44, borderRadius: 12, marginBottom: 6,
                        background: isActive(item.path) ? "#6c63ff33" : "transparent",
                        border: isActive(item.path) ? "1px solid #6c63ff66" : "1px solid transparent",
                        textDecoration: "none", fontSize: 20, transition: "all 0.2s"
                    }}>
                        {item.icon}
                    </Link>
                ))}
                <div style={{ marginTop: "auto", marginBottom: 16 }}>
                    <button onClick={handleLogout} title="Logout" style={{
                        background: "#e74c3c22",
                        border: "1px solid #e74c3c55",
                        color: "#f87171",
                        borderRadius: 10,
                        cursor: "pointer",
                        width: 40,
                        height: 40,
                        fontSize: 16,
                        fontWeight: 700
                    }}>↩</button>
                </div>
            </div>
        );
    }

    // ── DESKTOP ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: 240,
            background: "#1a1a2e", display: "flex", flexDirection: "column",
            padding: "20px 0", zIndex: 1000, borderRight: "1px solid #2a2a4a"
        }}>
            {/* Logo */}
            <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #2a2a4a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18, color: "#6c63ff", lineHeight: 1 }} aria-hidden="true">📦</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>InvMS</div>
                        <div style={{ color: "#666", fontSize: 11 }}>Inventory System</div>
                    </div>
                    <NotificationBell />
                </div>
            </div>

            {/* Scrollable menu area */}
            <div
                ref={scrollAreaRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#2a2a4a #1a1a2e" }}
            >

            {/* Main menu */}
            <div style={{ padding: "16px 12px 8px" }}>
                <div style={{ color: "#555", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: "0 8px 8px", textTransform: "uppercase" }}>
                    Main Menu
                </div>
                {menuItems.map((item) => (
                    <Link key={item.path} to={item.path} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                        borderRadius: 10, marginBottom: 2, textDecoration: "none",
                        background: isActive(item.path) ? "#6c63ff22" : "transparent",
                        borderLeft: isActive(item.path) ? "3px solid #6c63ff" : "3px solid transparent",
                        transition: "all 0.2s"
                    }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span style={{ color: isActive(item.path) ? "#fff" : "#aaa", fontSize: 14, fontWeight: isActive(item.path) ? 600 : 400 }}>
                            {item.label}
                        </span>
                    </Link>
                ))}
            </div>

            {/* Manage section — admin only */}
            {manageItems.length > 0 && (
                <div style={{ padding: "8px 12px" }}>
                    <div style={{ color: "#555", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, padding: "0 8px 8px", textTransform: "uppercase" }}>
                        Manage
                    </div>
                    {manageItems.map((item) => (
                        <Link key={item.path} to={item.path} style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                            borderRadius: 10, marginBottom: 2, textDecoration: "none",
                            background: isActive(item.path) ? "#6c63ff22" : "transparent",
                            borderLeft: isActive(item.path) ? "3px solid #6c63ff" : "3px solid transparent",
                            transition: "all 0.2s"
                        }}>
                            <span style={{ fontSize: 18 }}>{item.icon}</span>
                            <span style={{ color: isActive(item.path) ? "#fff" : "#aaa", fontSize: 14, fontWeight: isActive(item.path) ? 600 : 400 }}>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </div>
            )}

            </div>{/* end scrollable menu area */}

            {/* User card */}
            <div style={{ marginTop: "auto", padding: "16px 12px 0", borderTop: "1px solid #2a2a4a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#ffffff08" }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: "#6c63ff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0
                    }}>
                        {(user?.username || "U")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {user?.username}
                        </div>
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                            display: "inline-block", marginTop: 2,
                            background: isAdmin() ? "#6c63ff33" : "#ffffff15",
                            color: isAdmin() ? "#a89cff" : "#888",
                        }}>
                            {user?.role?.toUpperCase()}
                        </span>
                    </div>
                    <button onClick={handleLogout} title="Logout" style={{
                        background: "#e74c3c22",
                        border: "1px solid #e74c3c55",
                        color: "#f87171",
                        borderRadius: 8,
                        cursor: "pointer",
                        width: 32,
                        height: 32,
                        fontSize: 14,
                        fontWeight: 700
                    }}>↩</button>
                </div>
            </div>
        </div>
    );
}

