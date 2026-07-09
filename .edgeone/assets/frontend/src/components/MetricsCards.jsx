import React from 'react';
import { Smartphone, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

function MetricsCards({ stats }) {
  const metrics = [
    {
      label: 'Total de Linhas',
      value: stats?.totalLines ?? '...',
      icon: <Smartphone size={22} />,
      type: 'primary',
    },
    {
      label: 'Linhas Ativas',
      value: stats?.activeLines ?? '...',
      icon: <CheckCircle size={22} />,
      type: 'success',
    },
    {
      label: 'Linhas Inativas',
      value: stats?.inactiveLines ?? '...',
      icon: <AlertTriangle size={22} />,
      type: 'warning',
    },
    {
      label: 'Linhas SIP',
      value: stats?.sipLines ?? '...',
      icon: <Activity size={22} />,
      type: 'info',
    },
  ];

  return (
    <div className="metrics-grid">
      {metrics.map((metric, idx) => (
        <div key={idx} className={`metric-card ${metric.type}`}>
          <div className="metric-header">
            <div>
              <div className="metric-value">{metric.value}</div>
              <div className="metric-label">{metric.label}</div>
            </div>
            <div className={`metric-icon ${metric.type}`}>{metric.icon}</div>
          </div>
          {stats?.lastSync && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '12px',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '12px',
              }}
            >
              Última sincronização:{' '}
              {new Date(stats.lastSync).toLocaleTimeString('pt-BR')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MetricsCards;
