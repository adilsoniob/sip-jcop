import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Activity,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi, linesApi } from '../services/api';
import SipListView from '../components/SipListView';
import MetricsCards from '../components/MetricsCards';

function Dashboard({ initialTab = 'dashboard' }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'lines' ? 'lines' : 'overview');
  const [stats, setStats] = useState(null);
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, linesRes] = await Promise.allSettled([
        dashboardApi.stats(),
        linesApi.list(search),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (linesRes.status === 'fulfilled') {
        const linesData = linesRes.value.data.lines || [];
        // Auto-fetch real passwords in background (up to 5 at a time)
        const linesToFetch = linesData.filter(
          (l) => l.sipPassword === '****' || !l.sipPassword
        );
        if (linesToFetch.length > 0) {
          const chunkSize = 5;
          for (let i = 0; i < linesToFetch.length; i += chunkSize) {
            const chunk = linesToFetch.slice(i, i + chunkSize);
            const results = await Promise.allSettled(
              chunk.map((l) => linesApi.get(l.id))
            );
            const passwordMap = {};
            results.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value.data?.sipPassword) {
                passwordMap[chunk[idx].id] = res.value.data.sipPassword;
              }
            });
            if (Object.keys(passwordMap).length > 0) {
              linesData.forEach((l) => {
                if (passwordMap[l.id]) l.sipPassword = passwordMap[l.id];
              });
            }
          }
        }
        setLines(linesData);
      }
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (initialTab === 'lines') setActiveTab('lines');
  }, [initialTab]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await linesApi.sync();
      toast.success('Sincronização concluída');
      await fetchData();
    } catch (err) {
      toast.error('Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {activeTab === 'overview' ? 'Dashboard' : 'Minhas SIPs'}
          </h1>
          <p className="page-subtitle">
            {activeTab === 'overview'
              ? 'Visão geral do sistema'
              : 'Gerencie suas SIPs'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'overview' && (
            <button
              className={`btn btn-secondary sync-btn ${syncing ? 'spinning' : ''}`}
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw size={16} />
              Sincronizar
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Visão Geral
        </button>
        <button
          className={`tab ${activeTab === 'lines' ? 'active' : ''}`}
          onClick={() => setActiveTab('lines')}
        >
          <Smartphone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Minhas SIPs
        </button>
      </div>

      {loading && !stats ? (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Carregando dados...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <MetricsCards stats={stats} />
              
              <div className="card">
                <div className="card-header">
                  <h3>Linhas Recentes</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Número</th>
                          <th>Usuário SIP</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.length === 0 ? (
                          <tr>
                            <td colSpan={4}>
                              <div className="empty-state" style={{ padding: '32px' }}>
                                <Smartphone size={40} />
                                <h3>Nenhuma linha encontrada</h3>
                                <p>As linhas aparecerão aqui após a sincronização</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          lines.slice(0, 5).map((line, idx) => (
                            <tr key={line.id || idx}>
                              <td style={{ fontWeight: 500 }}>{line.name}</td>
                              <td>{line.number || '-'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{line.sipUser}</td>
                              <td>
                                <span className={`status-badge ${line.status}`}>
                                  <span className="status-dot" />
                                  {line.status === 'active' || line.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'lines' && (
            <SipListView
              lines={lines}
              onRefresh={fetchData}
              onQuickCreate={async () => {
                setCreating(true);
                try {
                  const res = await linesApi.quickCreate();
                  toast.success(
                    `Usuário ${res.data.sipUser} criado! Senha: ${res.data.sipPassword}`,
                    { duration: 6000 }
                  );
                  await fetchData();
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Erro ao criar usuário');
                } finally {
                  setCreating(false);
                }
              }}
              creating={creating}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
