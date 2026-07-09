import React, { useState } from 'react';
import { User, Key, Phone, Trash2, Save, X, Search, Smartphone, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { linesApi } from '../services/api';

function SipActionModal({ title, fields, line, onClose, onSave }) {
  const [form, setForm] = useState(
    fields.reduce((acc, f) => { acc[f.key] = line[f.key] || ''; return acc; }, {})
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
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : <><Save size={14} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SipTable({ lines, onRefresh, onSync, onQuickCreate, creating }) {
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState(null);

  const filtered = lines.filter((l) =>
    l.sipUser?.toLowerCase().includes(search.toLowerCase()) ||
    l.callerId?.includes(search) ||
    l.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getCallerId = (line) => line.callerId || line.callerIdName || '—';

  const handleAction = async (id, data) => {
    await linesApi.update(id, data);
    await onRefresh();
  };

  const handleDelete = async (line) => {
    if (!window.confirm(`Excluir "${line.sipUser}"?`)) return;
    try {
      await linesApi.delete(line.id);
      toast.success('Usuário SIP excluído com sucesso!');
      await onRefresh();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="sip-page">
      {/* Search + Actions bar */}
      <div className="sip-bar">
        <div className="sip-bar-search">
          <Search size={16} className="sip-search-ico" />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou BINA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sip-bar-input"
          />
        </div>
        <div className="sip-bar-actions">
          <button className="sip-btn-green" onClick={onQuickCreate} disabled={creating}>
            <User size={16} />
            <span>{creating ? 'Criando...' : 'Criar Usuário SIP'}</span>
          </button>
          <button className="sip-btn-sync" onClick={onSync} title="Sincronizar com painel mestre">
            <RefreshCw size={16} />
            <span>Sincronizar</span>
          </button>
          <span className="sip-total">{filtered.length} SIP{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="sip-empty-state">
          <Smartphone size={40} />
          <h3>{search ? 'Nenhuma SIP encontrada' : 'Nenhuma SIP cadastrada'}</h3>
          <p>{search ? 'Tente alterar sua busca' : 'Clique em "Criar Usuário SIP" para começar'}</p>
        </div>
      ) : (
        <div className="sip-table-wrap">
          <table className="sip-table">
            <thead>
              <tr>
                <th>Servidor Proxy</th>
                <th>Usuário SIP</th>
                <th>Senha SIP</th>
                <th>BINA</th>
                <th className="sip-th-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((line) => (
                <tr key={line.id}>
                  <td className="sip-cell-name">sip.avoip.com.br</td>
                  <td className="sip-cell-mono">{line.sipUser}</td>
                  <td className="sip-cell-pass">
                    {line.sipPassword && line.sipPassword !== '****'
                      ? line.sipPassword
                      : '—'}
                  </td>
                  <td className="sip-cell-mono">{getCallerId(line)}</td>
                  <td className="sip-cell-actions">
                    <button className="sip-act sip-act-user" onClick={() => setActionModal({ type: 'sipUser', line })} title="Alterar Usuário">
                      <User size={13} /> Usuário
                    </button>
                    <button className="sip-act sip-act-pass" onClick={() => setActionModal({ type: 'sipPassword', line })} title="Alterar Senha">
                      <Key size={13} /> Senha
                    </button>
                    <button className="sip-act sip-act-bina" onClick={() => setActionModal({ type: 'bina', line })} title="Alterar BINA">
                      <Phone size={13} /> BINA
                    </button>
                    <button className="sip-act sip-act-del" onClick={() => handleDelete(line)} title="Excluir">
                      <Trash2 size={13} /> Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Modals */}
      {actionModal?.type === 'sipUser' && (
        <SipActionModal title="Alterar Usuário SIP"
          fields={[{ key: 'sipUser', label: 'Novo Usuário SIP', placeholder: 'Ex: meu_sip' }]}
          line={actionModal.line} onClose={() => setActionModal(null)} onSave={handleAction} />
      )}
      {actionModal?.type === 'sipPassword' && (
        <SipActionModal title="Alterar Senha SIP"
          fields={[{ key: 'sipPassword', label: 'Nova Senha SIP', type: 'text', placeholder: 'Nova senha' }]}
          line={actionModal.line} onClose={() => setActionModal(null)} onSave={handleAction} />
      )}
      {actionModal?.type === 'bina' && (
        <SipActionModal title="Alterar BINA (Caller ID)"
          fields={[
            { key: 'callerId', label: 'Número da BINA', placeholder: 'Ex: 114000111' },
            { key: 'callerIdName', label: 'Nome da BINA', placeholder: 'Ex: Empresa' },
          ]}
          line={actionModal.line} onClose={() => setActionModal(null)} onSave={handleAction} />
      )}
    </div>
  );
}
