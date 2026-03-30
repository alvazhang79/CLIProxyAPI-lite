import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Provider } from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Providers() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [error, setError] = useState('');
  const [advancedProvider, setAdvancedProvider] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    base_url: '',
    auth_type: 'bearer' as 'bearer' | 'api_key' | 'custom',
    auth_header: 'Authorization',
    headers: '',
    proxy_url: '',
    api_key: '',
  });

  const loadProviders = () => {
    adminApi.listProviders()
      .then(res => setProviders(res.providers))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProviders(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let headers: Record<string, string> = {};
    if (form.headers.trim()) {
      try { headers = JSON.parse(form.headers); }
      catch { setError('Headers must be valid JSON'); return; }
    }
    try {
      await adminApi.createProvider({
        name: form.name,
        display_name: form.display_name || form.name,
        base_url: form.base_url,
        auth_type: form.auth_type,
        auth_header: form.auth_header,
        headers,
        proxy_url: form.proxy_url,
        api_key: form.api_key || undefined,
      } as Parameters<typeof adminApi.createProvider>[0]);
      loadProviders();
      setShowCreate(false);
      setForm({ name: '', display_name: '', base_url: '', auth_type: 'bearer', auth_header: 'Authorization', headers: '', proxy_url: '', api_key: '' });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('common.confirm_delete') || '确认删除',
      message: '确定要删除这个 Provider 吗？此操作无法撤销。',
      onConfirm: async () => {
        try {
          await adminApi.deleteProvider(id);
          loadProviders();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Delete failed:', err);
          setError((err as Error).message);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
      danger: true,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('providers.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + {t('providers.create')}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : providers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">{t('common.no_results')}</div>
      ) : (
        <div className="space-y-4">
          {providers.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-navy">{p.display_name || p.name}</h3>
                    <span className="badge-blue capitalize">{p.name}</span>
                    <span className={`badge-sm ${p.enabled ? 'badge-green' : 'badge-red'}`}>
                      {p.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 font-mono mb-1">{p.base_url}</div>
                  <div className="text-xs text-gray-400">
                    {p.auth_type} · {p.auth_header}
                    {p.proxy_url ? ` · proxy: ${p.proxy_url}` : ''}
                    {Object.keys(p.headers || {}).length > 0 ? ` · ${Object.keys(p.headers).length} custom header(s)` : ''}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setAdvancedProvider(advancedProvider === p.id ? null : p.id)}
                    className="text-sm text-gray-500 hover:text-coral px-2 py-1 border rounded"
                  >
                    {advancedProvider === p.id ? '▲收起' : '▼高级'}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 text-sm hover:underline">
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              {/* Advanced settings */}
              {advancedProvider === p.id && (
                <div className="mt-4 pt-4 border-t space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500">Auth Type:</span>
                      <span className="ml-2 font-mono">{p.auth_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Auth Header:</span>
                      <span className="ml-2 font-mono">{p.auth_header}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Proxy URL:</span>
                      <span className="ml-2 font-mono text-xs">{p.proxy_url || '(none)'}</span>
                    </div>
                  </div>
                  {Object.keys(p.headers || {}).length > 0 && (
                    <div>
                      <span className="text-gray-500">Custom Headers:</span>
                      <pre className="mt-1 bg-gray-50 rounded p-2 text-xs font-mono overflow-x-auto">
                        {JSON.stringify(p.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('providers.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.name')}</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="openrouter" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.display_name')}</label>
                  <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="OpenRouter" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.base_url')}</label>
                <input type="url" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="https://openrouter.ai/api/v1" required />
              </div>

              {/* Advanced section */}
              <details className="border rounded-lg p-3 bg-gray-50">
                <summary className="text-sm font-medium text-gray-600 cursor-pointer select-none">⚙️ 高级选项</summary>
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.auth_type')}</label>
                      <select value={form.auth_type} onChange={e => setForm({ ...form, auth_type: e.target.value as 'bearer' | 'api_key' | 'custom' })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                        <option value="bearer">Bearer Token</option>
                        <option value="api_key">API Key (X-API-Key)</option>
                        <option value="custom">Custom Header</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auth Header</label>
                      <input type="text" value={form.auth_header} onChange={e => setForm({ ...form, auth_header: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="Authorization" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.headers')} <span className="text-gray-400 font-normal">(JSON)</span></label>
                    <textarea value={form.headers} onChange={e => setForm({ ...form, headers: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-xs" rows={3} placeholder={'{"X-Custom-Header": "value"}'} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('providers.proxy')}</label>
                    <input type="text" value={form.proxy_url} onChange={e => setForm({ ...form, proxy_url: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="http://proxy:8080" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider API Key <span className="text-gray-400 font-normal">(可选，用于获取模型列表)</span></label>
                    <input type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="sk-..." />
                  </div>
                </div>
              </details>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('common.create')}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="确认"
        cancelText="取消"
        danger={confirmDialog.danger}
      />
    </div>
  );
}
