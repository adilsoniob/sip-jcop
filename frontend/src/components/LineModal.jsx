import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Save, Phone } from 'lucide-react';

function LineModal({ line, onClose, onSave }) {
  const isEditing = !!line;
  const [form, setForm] = useState({
    name: '',
    number: '',
    sipUser: '',
    sipPassword: '',
    callerId: '',
    callerIdName: '',
  });
  const [showPassword, setShowPassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (line) {
      setForm({
        name: line.name || '',
        number: line.number || '',
        sipUser: line.sipUser || '',
        sipPassword: line.sipPassword || '',
        callerId: line.callerId || line.number || '',
        callerIdName: line.callerIdName || line.name || '',
      });
      // Show loading state when password is being fetched
      if (line.loadingPassword) {
        setLoadingDetails(true);
      } else {
        setLoadingDetails(false);
      }
    }
  }, [line]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim() && !isEditing) errs.name = 'Nome é obrigatório';
    if (!form.sipUser.trim()) errs.sipUser = 'Usuário SIP é obrigatório';
    if (!isEditing && !form.sipPassword.trim()) errs.sipPassword = 'Senha SIP é obrigatória';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      name: form.name || form.sipUser,
      number: form.number,
      sipUser: form.sipUser,
      sipPassword: form.sipPassword,
      callerId: form.callerId || form.number,
      callerIdName: form.callerIdName || form.name,
    };

    if (isEditing && !data.sipPassword) {
      delete data.sipPassword;
    }

    setSaving(true);
    try {
      await onSave(data);
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Editar Linha' : 'Nova Linha SIP'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nome da Linha</label>
              <input
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Ex: Ramal Comercial 1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Número da Linha</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 1680276"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Usuário SIP *</label>
              <input
                type="text"
                className={`form-input ${errors.sipUser ? 'error' : ''}`}
                placeholder="Ex: sip1001"
                value={form.sipUser}
                onChange={(e) => setForm({ ...form, sipUser: e.target.value })}
              />
              {errors.sipUser && <div className="form-error">{errors.sipUser}</div>}
            </div>              <div className="form-group">
              <label className="form-label">
                Senha SIP {isEditing ? '(deixe em branco para manter)' : '*'}
              </label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.sipPassword ? 'error' : ''}`}
                  placeholder={isEditing ? 'Nova senha (opcional)' : 'Senha SIP'}
                  value={form.sipPassword}
                  onChange={(e) => setForm({ ...form, sipPassword: e.target.value })}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.sipPassword && <div className="form-error">{errors.sipPassword}</div>}
              {loadingDetails && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Buscando senha real do painel mestre...
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '16px 0', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} style={{ color: 'var(--accent-primary)' }} />
                BINA / Caller ID
              </h4>

              <div className="form-group">
                <label className="form-label">Número da BINA</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 55114000222"
                  value={form.callerId}
                  onChange={(e) => setForm({ ...form, callerId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nome da BINA</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Empresa XYZ"
                  value={form.callerIdName}
                  onChange={(e) => setForm({ ...form, callerIdName: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <div className="loading-spinner loading-sm" />
                  Salvando no painel mestre...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {isEditing ? 'Atualizar' : 'Criar Linha'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LineModal;
