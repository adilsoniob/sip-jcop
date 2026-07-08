import React, { useState } from 'react';
import {
  Smartphone,
  User,
  Key,
  Phone,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  Zap,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { linesApi } from '../services/api';

function SipActionModal({ title, fields, line, onClose, onSave }) {
  const [form, setForm] = useState(
    fields.reduce((acc, f) => {
      acc[f.key] = line[f.key] || '';
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(line.id, form);
      toast.success(`${title} atualizado com sucesso!`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sip-action-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sip-action-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sip-action-body">
            {fields.map((f) => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  className="form-input"
                  placeholder={f.placeholder || f.label}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  autoFocus
                />
              </div>
            ))}
          </div>
          <div className="sip-action-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : <><Save size={14} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SipListView({ lines, onRefresh, onQuickCreate, creating }) {
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState(null);

  const filtered = lines.filter(
    (l) =>
      l.sipUser?.toLowerCase().includes(search.toLowerCase()) ||
      l.callerId?.includes(search) ||
      l.number?.includes(search)
  );

  const getCallerId = (line) => {
    return line.callerId || line.callerIdName || line.number || '—';
  };

  const handleAction = async (id, data) => {
    await linesApi.update(id, data);
    await onRefresh();
  };

  const handleDelete = async (line) => {
    if (!window.confirm(`Excluir usuário SIP "${line.sipUser}"?`)) return;
    try {
      await linesApi.delete(line.id);
      toast.success('Usuário SIP excluído com sucesso!');
      await onRefresh();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="sip-toolbar">
        <div className="sip-toolbar-search">
          <Search size={16} className="sip-search-icon" />
          <input
            type="text"
            className="sip-search-input"
            placeholder="Buscar SIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sip-toolbar-actions">
          <button className="sip-btn-create" onClick={onQuickCreate} disabled={creating}>
            <Zap size={16} />
            <span>{creating ? 'Criando...' : 'Nova SIP'}</span>
          </button>
          <button className="sip-btn-refresh" onClick={onRefresh} title="Sincronizar">
            <RefreshCw size={16} />
          </button>
          <span className="sip-count">{filtered.length} SIP{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="sip-empty">
          <div className="sip-empty-icon">
            <Smartphone size={48} />
          </div>
          <h3>Nenhuma SIP encontrada</h3>
          <p>{search ? 'Tente alterar sua busca' : 'Clique em "Nova SIP" para começar'}</p>
        </div>
      ) : (
        <div className="sip-grid">
          {filtered.map((line, index) => (
            <div key={line.id} className="sip-card" style={{ animationDelay: `${index * 0.05}s` }}>
              {/* Card Accent Bar */}
              <div className="sip-card-accent" />

              {/* Card Header */}
              <div className="sip-card-header">
                <div className="sip-card-avatar">
                  {line.sipUser?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="sip-card-title">
                  <span className="sip-card-name">{line.sipUser}</span>
                  <span className="sip-card-badge">SIP</span>
                </div>
              </div>

              {/* Card Fields */}
              <div className="sip-card-body">
                <div className="sip-info-row">
                  <div className="sip-info-icon sip-icon-user">
                    <User size={13} />
                  </div>
                  <div className="sip-info-content">
                    <span className="sip-info-label">Usuário</span>
                    <span className="sip-info-value">{line.sipUser}</span>
                  </div>
                </div>

                <div className="sip-info-row">
                  <div className="sip-info-icon sip-icon-key">
                    <Key size={13} />
                  </div>
                  <div className="sip-info-content">
                    <span className="sip-info-label">Senha</span>
                    <span className="sip-info-value sip-info-password">
                      {line.sipPassword && line.sipPassword !== '****'
                        ? line.sipPassword
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="sip-info-row">
                  <div className="sip-info-icon sip-icon-phone">
                    <Phone size={13} />
                  </div>
                  <div className="sip-info-content">
                    <span className="sip-info-label">BINA</span>
                    <span className="sip-info-value">{getCallerId(line)}</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="sip-card-actions">
                <button
                  className="sip-act-btn sip-act-user"
                  onClick={() => setActionModal({ type: 'sipUser', line })}
                  title="Alterar Usuário"
                >
                  <User size={13} />
                  <span>Usuário</span>
                </button>
                <button
                  className="sip-act-btn sip-act-pass"
                  onClick={() => setActionModal({ type: 'sipPassword', line })}
                  title="Alterar Senha"
                >
                  <Key size={13} />
                  <span>Senha</span>
                </button>
                <button
                  className="sip-act-btn sip-act-bina"
                  onClick={() => setActionModal({ type: 'bina', line })}
                  title="Alterar BINA"
                >
                  <Phone size={13} />
                  <span>BINA</span>
                </button>
                <button
                  className="sip-act-btn sip-act-del"
                  onClick={() => handleDelete(line)}
                  title="Excluir"
                >
                  <Trash2 size={13} />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modals */}
      {actionModal?.type === 'sipUser' && (
        <SipActionModal
          title="Alterar Usuário SIP"
          fields={[{ key: 'sipUser', label: 'Novo Usuário SIP', placeholder: 'Ex: meu_sip' }]}
          line={actionModal.line}
          onClose={() => setActionModal(null)}
          onSave={handleAction}
        />
      )}
      {actionModal?.type === 'sipPassword' && (
        <SipActionModal
          title="Alterar Senha SIP"
          fields={[{ key: 'sipPassword', label: 'Nova Senha SIP', type: 'text', placeholder: 'Nova senha' }]}
          line={actionModal.line}
          onClose={() => setActionModal(null)}
          onSave={handleAction}
        />
      )}
      {actionModal?.type === 'bina' && (
        <SipActionModal
          title="Alterar BINA (Caller ID)"
          fields={[
            { key: 'callerId', label: 'Número da BINA', placeholder: 'Ex: 114000111' },
            { key: 'callerIdName', label: 'Nome da BINA', placeholder: 'Ex: Empresa' },
          ]}
          line={actionModal.line}
          onClose={() => setActionModal(null)}
          onSave={handleAction}
        />
      )}
    </div>
  );
}

export default SipListView;
