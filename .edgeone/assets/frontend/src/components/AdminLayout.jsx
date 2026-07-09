import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, Shield, BarChart3 } from 'lucide-react';

function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="jc-app">
      <header className="jc-topbar">
        <div className="jc-topbar-left">
          <div className="jc-logo">
            <img src="/logo-jcop.png" alt="JCOP" className="jc-logo-img" />
            <span className="jc-logo-text">
              JCOP<span className="jc-logo-sip">SIP</span>
              <span className="jc-admin-badge">Admin</span>
            </span>
          </div>
          <span className="jc-logo-sub">Área Administrativa</span>
        </div>
        <div className="jc-topbar-right">
          <div className="jc-user-badge">
            <span className="jc-user-avatar" style={{ background: 'var(--gradient-warning)', color: '#0a0a1a' }}>
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </span>
            <div className="jc-user-info">
              <span className="jc-user-name">{user?.username || 'Admin'}</span>
              <span className="jc-user-role">Administrador</span>
            </div>
          </div>
          <button className="jc-btn-logout" onClick={handleLogout} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <nav style={{
          width: '220px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flexShrink: 0,
        }}>
          <button
            className={`nav-item ${isActive('/admin') ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            <BarChart3 size={18} />
            Dashboard
          </button>
          <button
            className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}
            onClick={() => navigate('/admin/users')}
          >
            <Users size={18} />
            Usuários
          </button>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button
              className="nav-item"
              onClick={() => navigate('/dashboard')}
              style={{ color: 'var(--text-muted)', fontSize: '13px' }}
            >
              <Shield size={16} />
              Voltar ao Painel SIP
            </button>
          </div>
        </nav>

        <main className="jc-main" style={{ overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
