import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Stats } from '../lib/api';

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">{t('common.loading')}</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!stats) return null;

  const statCards = [
    { label: t('dashboard.total_keys'), value: stats.total_keys, emoji: '🔑' },
    { label: t('dashboard.requests_today'), value: stats.requests_today.toLocaleString(), emoji: '📡' },
    { label: t('dashboard.error_rate'), value: (stats.error_rate * 100).toFixed(1) + '%', emoji: '⚠️', warn: stats.error_rate > 0.05 },
    { label: t('dashboard.avg_latency'), value: Math.round(stats.avg_latency_ms) + ' ' + t('dashboard.ms'), emoji: '⚡' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">{t('dashboard.title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="card">
            <div className="text-3xl mb-2">{card.emoji}</div>
            <div className={`text-3xl font-bold ${card.warn ? 'text-red-500' : 'text-navy'}`}>
              {card.value}
            </div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Requests by Provider */}
      <div className="card">
        <h2 className="text-lg font-semibold text-navy mb-4">{t('dashboard.requests_by_provider')}</h2>
        {Object.keys(stats.requests_by_provider).length === 0 ? (
          <p className="text-gray-400">{t('dashboard.no_data')}</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(stats.requests_by_provider).map(([provider, count]) => {
              const max = Math.max(...Object.values(stats.requests_by_provider));
              const pct = max > 0 ? (count / max) * 100 : 0;
              return (
                <div key={provider}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize text-navy">{provider}</span>
                    <span className="text-gray-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-teal h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
