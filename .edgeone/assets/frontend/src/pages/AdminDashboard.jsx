import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, Activity, UserPlus, Search, Edit, Trash2, X, Check, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminApi.listUsers();
      setUsers(res.data.users || []);
    } catch (err) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.profile === 'admin').length,
    operators: users.filter((u) => u.profile === 'operator').length,
    active: users.filter((u) => u.status === 'active').length,
    inactive: users.filter((u) => u.status !== 'active').length,
  };

  const metricCards = [
    { label: 'Total de Usuários', value: stats.total, icon: Users, color: 'primary' },
    { label: 'Administradores', value: stats.admins, icon: Shield, color: 'warning' },
    { label: 'Operadores', value: stats.operators, icon: Activity, color: 'success' },
    { label: 'Ativos', value: stats.active, icon: Check, color: 'success' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administração</h1>
          <p className="page-subtitle">Gerencie usuários e configurações do sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/users')}>
          <UserPlus size={16} />
          Gerenciar Usuários
        </button>
      </div>

      <div className="metrics-grid">
        {metricCards.map((m, idx) => (
          <div key={idx} className={`metric-card ${m.color}`}>
            <div className="metric-header">
              <div>
                <div className="metric-value">{m.value}</div>
                <div className="metric-label">{m.label}</div>
              </div>
              <div className={`metric-icon ${m.color}`}>
                <m.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Usuários do Sistema</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <p>Carregando usuários...</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Criação</th>
                    <th>Último Acesso</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <Users size={48} />
                          <h3>Nenhum usuário encontrado</h3>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td style={{ fontWeight: 500 }}>{user.username}</td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {user.email || '-'}
                        </td>
                        <td>
                          <span className={`profile-badge ${user.profile}`}>
                            {user.profile === 'admin' ? 'Admin' : 'Operador'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${user.status}`}>
                            <span className="status-dot" />
                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          {user.last_access
                            ? new Date(user.last_access).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </td>
                        <td>
                          <div
                            className="inline-actions"
                            style={{ justifyContent: 'flex-end' }}
                          >
                            <button
                              className="action-btn edit"
                              onClick={() => navigate('/admin/users')}
                              title="Gerenciar"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
