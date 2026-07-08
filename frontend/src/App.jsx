import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { setNavigateToLogin } from './services/api';
import {
  LayoutDashboard,
  Smartphone,
  Users,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import UsersPage from './pages/UsersPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.profile !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AdminProtectedRoute({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.profile !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/lines', icon: Smartphone, label: 'Linhas SIP' },
  ];

  if (user?.profile === 'admin') {
    navItems.push({ path: '/admin', icon: Shield, label: 'Administração' });
  }

  const handleNavigation = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      <button className="menu-toggle" onClick={() => setOpen(!open)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>JCopSIP</h1>
          <span>Painel de Gerenciamento SIP</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigation(item.path)}
            >
              <span className="nav-item-icon">
                <item.icon size={18} />
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.username || 'Usuário'}</div>
              <div className="user-role">
                <span className={`profile-badge ${user?.profile || ''}`}>
                  {user?.profile === 'admin' ? 'Admin' : 'Operador'}
                </span>
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={logout} style={{ color: 'var(--accent-danger)' }}>
            <span className="nav-item-icon">
              <LogOut size={18} />
            </span>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function AppContent() {
  const { loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setNavigateToLogin(() => navigate('/login', { replace: true }));
    return () => setNavigateToLogin(null);
  }, [navigate]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Iniciando JCopSIP...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/lines"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard initialTab="lines" />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AdminDashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <UsersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return <AppContent />;
}

export default App;
