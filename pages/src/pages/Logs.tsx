import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type LogEntry } from '../lib/api';
import { formatTimestamp } from '../lib/utils';

export default function Logs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ provider: '', endpoint: '', status: '' });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const data = await adminApi.getLogs({
        provider: filter.provider || undefined,
        endpoint: filter.endpoint || undefined,
        status: filter.status || undefined,
        page: reset ? 0 : page,
        limit: PAGE_SIZE,
      });
      if (reset) {
        setLogs(data.logs as LogEntry[]);
      } else {
        setLogs(prev => [...prev, ...(data.logs as LogEntry[])]);
      }
      setHasMore(data.has_more);
      if (reset) setPage(0);
    } catch {
      // ignore — show empty state
    } finally {
      setLoading(false);
    }
  }, [filter.provider, filter.endpoint, filter.status, page]);

  useEffect(() => { load(true); }, [filter.provider, filter.endpoint, filter.status]);

  const filtered = logs.filter(log => {
    if (filter.provider && log.provider !== filter.provider) return false;
    if (filter.endpoint && !log.endpoint.includes(filter.endpoint)) return false;
    if (filter.status) {
      const code = log.status_code ?? 0;
      if (filter.status === 'error' && code < 400) return false;
      if (filter.status === 'success' && code >= 400) return false;
    }
    return true;
  });

  const providers = [...new Set(logs.map(l => l.provider))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('logs.title')}</h1>
        <div className="flex gap-3 items-center">
          <select value={filter.provider} onChange={e => setFilter(f => ({ ...f, provider: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral">
            <option value="">All Providers</option>
            {providers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral">
            <option value="">All Status</option>
            <option value="success">2xx</option>
            <option value="error">4xx/5xx</option>
          </select>
          <button onClick={() => load(true)} className="btn-secondary text-sm">↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="mb-2">📋 {t('logs.title')}</p>
          <p className="text-sm">Request logs will appear here after the first API calls.</p>
          <p className="text-xs text-gray-300 mt-2">Logs are stored in D1 · request_logs table</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 table-header">{t('logs.time')}</th>
                <th className="text-left px-4 py-3 table-header">{t('logs.endpoint')}</th>
                <th className="text-left px-4 py-3 table-header">{t('logs.provider')}</th>
                <th className="text-left px-4 py-3 table-header">{t('logs.model')}</th>
                <th className="text-left px-4 py-3 table-header">{t('logs.latency')}</th>
                <th className="text-left px-4 py-3 table-header">{t('logs.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="table-row">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[200px] truncate">{log.endpoint}</td>
                  <td className="px-4 py-3 capitalize text-sm text-gray-600">{log.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[150px] truncate" title={log.model}>{log.model}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.latency_ms !== null ? (
                      <span className={log.latency_ms > 5000 ? 'text-red-500' : log.latency_ms > 2000 ? 'text-yellow-500' : 'text-green-500'}>
                        {log.latency_ms}ms
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {log.status_code ? (
                      log.status_code >= 500 ? <span className="badge-red">{log.status_code}</span> :
                      log.status_code >= 400 ? <span className="badge-red">{log.status_code}</span> :
                      <span className="badge-green">{log.status_code}</span>
                    ) : <span className="badge bg-gray-100 text-gray-500">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="p-4 text-center border-t">
              <button onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm">
                Load More ({page + 2})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Latency Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span>Latency:</span>
        <span className="text-green-500">■ &lt;2s</span>
        <span className="text-yellow-500">■ 2-5s</span>
        <span className="text-red-500">■ &gt;5s</span>
      </div>
    </div>
  );
}
