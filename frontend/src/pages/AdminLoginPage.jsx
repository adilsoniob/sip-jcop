import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.profile === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Informe seu usuário');
      return;
    }
    if (!password) {
      setError('Informe sua senha');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(username.trim(), password);
      if (userData.profile !== 'admin') {
        toast.error('Este acesso é restrito a administradores');
        setError('Acesso restrito a administradores');
        setLoading(false);
        return;
      }
      toast.success('Bem-vindo, Administrador!');
      navigate('/admin', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao fazer login. Verifique suas credenciais.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes" />
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo" style={{ background: 'var(--gradient-warning)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Admin
          </div>
          <div className="login-subtitle">Área Administrativa JCopSIP</div>
        </div>

        <div className="login-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: 'var(--accent-warning)' }} />
            Acesso Administrativo
          </h2>
          <p>Apenas administradores podem acessar esta área</p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent-danger)',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Usuário Admin</label>
              <input
                type="text"
                className="form-input"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? (
                <>
                  <div className="loading-spinner loading-sm" />
                  Autenticando...
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Acessar Admin
                </>
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)',
              }}
              onMouseOver={(e) => (e.target.style.color = 'var(--accent-primary)')}
              onMouseOut={(e) => (e.target.style.color = 'var(--text-muted)')}
            >
              <ArrowLeft size={14} />
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
