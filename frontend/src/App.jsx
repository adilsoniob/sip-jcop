import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { setNavigateToLogin } from './services/api';
import { LogOut } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function TopBar({ user, onLogout }) {
  return (
    <header className="jc-topbar">
      <div className="jc-topbar-left">
        <div className="jc-logo">
          <span className="jc-logo-icon">J</span>
          <span className="jc-logo-text">JCopSIP</span>
        </div>
        <span className="jc-logo-sub">Painel de Gerenciamento SIP</span>
      </div>
      <div className="jc-topbar-right">
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return <AppContent />;
}

export default App;
