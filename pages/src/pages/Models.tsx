import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Model, type Provider } from '../lib/api';

export default function Models() {
  const { t } = useTranslation();
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filterProvider, setFilterProvider] = useState('');

  const [form, setForm] = useState({
    provider_id: '', model: '', alias: '', display_name: '',
    api_format: 'openai', context_window: '', supports_streaming: true, supports_functions: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsData, providersData] = await Promise.all([
        adminApi.listModels(),
        adminApi.listProviders(),
      ]);
      setModels((modelsData.models ?? []) as Model[]);
      setProviders((providersData.providers ?? []) as Provider[]);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminApi.createModel({
        provider_id: form.provider_id,
        model: form.model,
        alias: form.alias,
        display_name: form.display_name || form.alias,
        api_format: form.api_format as 'openai' | 'gemini' | 'claude' | 'cohere',
        context_window: form.context_window ? parseInt(form.context_window) : undefined,
        supports_streaming: form.supports_streaming,
        supports_functions: form.supports_functions,
      });
      setShowCreate(false);
      setForm({ provider_id: '', model: '', alias: '', display_name: '', api_format: 'openai', context_window: '', supports_streaming: true, supports_functions: false });
      load();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this model alias?')) return;
    await adminApi.deleteModel(id);
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const filtered = filterProvider
    ? models.filter(m => m.provider_id === filterProvider)
    : models;

  const providerMap = Object.fromEntries(providers.map(p => [p.id, p]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('models.title')}</h1>
        <div className="flex gap-3 items-center">
          <select
            value={filterProvider}
            onChange={e => setFilterProvider(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral"
          >
            <option value="">All Providers</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Add Model</button>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</div>}

      {loading ? <div className="text-gray-400">{t('common.loading')}</div>
       : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">{t('common.no_results')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 table-header">{t('models.alias')}</th>
                <th className="text-left px-6 py-3 table-header">{t('models.upstream')}</th>
                <th className="text-left px-6 py-3 table-header">Provider</th>
                <th className="text-left px-6 py-3 table-header">{t('models.format')}</th>
                <th className="text-left px-6 py-3 table-header">{t('models.context_window')}</th>
                <th className="text-left px-6 py-3 table-header">{t('models.streaming')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-coral font-medium">{m.alias}</span>
                    {m.display_name && m.display_name !== m.alias && (
                      <span className="ml-2 text-xs text-gray-400">({m.display_name})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 max-w-[200px] truncate" title={m.model}>{m.model}</td>
                  <td className="px-6 py-4">
                    <span className="badge-blue text-xs">{providerMap[m.provider_id]?.display_name ?? m.provider_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-6 py-4"><span className="badge text-xs bg-teal/10 text-teal">{m.api_format}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.context_window ? m.context_window.toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-center">
                    {m.supports_streaming
                      ? <span className="text-green-500 text-sm">✓</span>
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(m.id)} className="text-red-500 text-sm hover:underline">{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold text-navy mb-4">Add Model Alias</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Provider <span className="text-red-500">*</span></label>
                  <select value={form.provider_id} onChange={e => setForm({ ...form, provider_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" required>
                    <option value="">Select...</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('models.format')}</label>
                  <select value={form.api_format} onChange={e => setForm({ ...form, api_format: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                    <option value="cohere">Cohere</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Upstream Model <span className="text-red-500">*</span></label>
                  <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="moonshotai/kimi-k2:free" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Alias <span className="text-red-500">*</span></label>
                  <input value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="kimi-k2" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="Kimi K2 (Free)" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('models.context_window')}</label>
                  <input type="number" value={form.context_window} onChange={e => setForm({ ...form, context_window: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="32768" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.supports_streaming} onChange={e => setForm({ ...form, supports_streaming: e.target.checked })} className="rounded" />
                  {t('models.streaming')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.supports_functions} onChange={e => setForm({ ...form, supports_functions: e.target.checked })} className="rounded" />
                  {t('models.functions')}
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('common.create')}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
