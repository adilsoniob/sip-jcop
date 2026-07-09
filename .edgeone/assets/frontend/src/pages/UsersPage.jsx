import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  ArrowLeft,
  Edit,
  Trash2,
  Lock,
  X,
  Save,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    profile: 'operator',
    status: 'active',
  });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
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

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ username: '', email: '', password: '', profile: 'operator', status: 'active' });
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email || '',
      password: '',
      profile: user.profile,
      status: user.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.username.trim()) {
      toast.error('Usuário é obrigatório');
      return;
    }
    if (!editingUser && !form.password) {
      toast.error('Senha é obrigatória');
      return;
    }
    if (form.password && form.password.length < 4) {
      toast.error('Senha deve ter no mínimo 4 caracteres');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const data = { username: form.username, email: form.email || undefined };
        if (form.profile) data.profile = form.profile;
        if (form.status) data.status = form.status;
        await adminApi.updateUser(editingUser.id, data);

        if (form.password) {
          await adminApi.changePassword(editingUser.id, form.password);
        }

        toast.success('Usuário atualizado com sucesso!');
      } else {
        await adminApi.createUser({
          username: form.username,
          email: form.email || undefined,
          password: form.password,
          profile: form.profile,
        });
        toast.success('Usuário criado com sucesso!');
      }
      setModalOpen(false);
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${user.username}"?`)) return;
    try {
      await adminApi.deleteUser(user.id);
      toast.success('Usuário excluído com sucesso!');
      await fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir usuário');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast.error('Senha deve ter no mínimo 4 caracteres');
      return;
    }
    setSaving(true);
    try {
      await adminApi.changePassword(passwordUserId, newPassword);
      toast.success('Senha alterada com sucesso!');
      setPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error('Erro ao alterar senha');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
            <div>
              <h1 className="page-title">Gerenciar Usuários</h1>
              <p className="page-subtitle">
                Crie, edite e gerencie usuários do sistema
              </p>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <UserPlus size={16} />
          Novo Usuário
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar usuários..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {filteredUsers.length} usuário(s)
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <p>Carregando...</p>
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
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <Users size={48} />
                          <h3>Nenhum usuário encontrado</h3>
                          <p>
                            {search
                              ? 'Nenhum usuário corresponde à sua busca'
                              : 'Clique em "Novo Usuário" para adicionar'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
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
                              className="action-btn"
                              onClick={() => {
                                setPasswordUserId(user.id);
                                setNewPassword('');
                                setPasswordModalOpen(true);
                              }}
                              title="Alterar Senha"
                            >
                              <Lock size={14} />
                            </button>
                            <button
                              className="action-btn edit"
                              onClick={() => openEditModal(user)}
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => handleDelete(user)}
                              title="Excluir"
                            >
                              <Trash2 size={14} />
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Usuário *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nome de usuário"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    autoFocus
                    disabled={!!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="email@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Senha {editingUser ? '(deixe em branco para manter)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={editingUser ? 'Nova senha' : 'Senha'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Perfil</label>
                  <select
                    className="form-select"
                    value={form.profile}
                    onChange={(e) => setForm({ ...form, profile: e.target.value })}
                  >
                    <option value="operator">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {editingUser && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <div className="loading-spinner loading-sm" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingUser ? 'Atualizar' : 'Criar Usuário'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {passwordModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Alterar Senha</h2>
              <button className="modal-close" onClick={() => setPasswordModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nova Senha *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Mínimo 4 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <div className="loading-spinner loading-sm" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      Alterar Senha
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;
