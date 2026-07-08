import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { linesApi } from '../services/api';
import SipTable from '../components/SipTable';

export default function Dashboard() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await linesApi.list();
      const linesData = res.data.lines || [];

      // Auto-fetch real passwords in background
      const linesToFetch = linesData.filter((l) => l.sipPassword === '****' || !l.sipPassword);
      if (linesToFetch.length > 0) {
        const results = await Promise.allSettled(
          linesToFetch.slice(0, 10).map((l) => linesApi.get(l.id))
        );
        const passwordMap = {};
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data?.sipPassword) {
            passwordMap[linesToFetch[i].id] = r.value.data.sipPassword;
          }
        });
        linesData.forEach((l) => {
          if (passwordMap[l.id]) l.sipPassword = passwordMap[l.id];
        });
      }

      setLines(linesData);
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSync = async () => {
    try {
      await linesApi.sync();
      toast.success('Sincronização concluída');
      await fetchData();
    } catch (err) {
      toast.error('Erro ao sincronizar');
    }
  };

  if (loading && lines.length === 0) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p>Carregando SIPs...</p>
      </div>
    );
  }

  return (
    <div className="jc-dash">
      <SipTable
        lines={lines}
        onRefresh={fetchData}
        onSync={handleSync}
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
    </div>
  );
}
