import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { setNavigateToLogin } from './services/api';
import { LogOut, Settings } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import UsersPage from './pages/UsersPage';
import AdminLayout from './components/AdminLayout';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function TopBar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="jc-topbar">
      <div className="jc-topbar-left">
        <div className="jc-logo">
          <img src="/logo-jcop.png" alt="JCOP" className="jc-logo-img" />
          <span className="jc-logo-text">JCOP<span className="jc-logo-sip">SIP</span></span>
        </div>
        <span className="jc-logo-sub">Painel de Gerenciamento SIP</span>
      </div>
      <div className="jc-topbar-right">
        {user?.profile === 'admin' && (
          <button
            className="jc-btn-logout"
            onClick={() => navigate('/admin')}
            title="Administração"
            style={{ color: 'var(--accent-warning)' }}
          >
            <Settings size={16} />
          </button>
        )}
        <div className="jc-user-badge">
          <span className="jc-user-avatar">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
          <div className="jc-user-info">
            <span className="jc-user-name">{user?.username || 'Usuário'}</span>
            <span className="jc-user-role">{user?.profile === 'admin' ? 'Admin' : 'Operador'}</span>
          </div>
        </div>
        <button className="jc-btn-logout" onClick={onLogout} title="Sair">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.profile !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading, logout } = useAuth();
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
            <div className="jc-app">
              <TopBar user={user} onLogout={logout} />
              <main className="jc-main">
                <Dashboard />
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminLayout>
              <UsersPage />
            </AdminLayout>
          </AdminRoute>
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
