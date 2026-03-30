import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type CustomModel, type CustomProvider } from '../lib/api';

// Preset model lists for quick import
const PRESET_MODELS: Record<string, { model: string; alias: string; display_name: string; context_window?: number }[]> = {
  openai: [
    { model: 'gpt-4o', alias: 'gpt-4o', display_name: 'GPT-4o', context_window: 128000 },
    { model: 'gpt-4o-mini', alias: 'gpt-4o-mini', display_name: 'GPT-4o Mini', context_window: 128000 },
    { model: 'gpt-4-turbo', alias: 'gpt-4-turbo', display_name: 'GPT-4 Turbo', context_window: 128000 },
    { model: 'gpt-3.5-turbo', alias: 'gpt-3.5-turbo', display_name: 'GPT-3.5 Turbo', context_window: 16385 },
  ],
  gemini: [
    { model: 'gemini-2.5-pro-preview-06-05', alias: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', context_window: 1048576 },
    { model: 'gemini-2.0-flash', alias: 'gemini-2.0-flash', display_name: 'Gemini 2.0 Flash', context_window: 1048576 },
    { model: 'gemini-1.5-flash', alias: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', context_window: 1048576 },
    { model: 'gemini-1.5-pro', alias: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', context_window: 1048576 },
  ],
  claude: [
    { model: 'claude-sonnet-4-20250514', alias: 'claude-sonnet-4', display_name: 'Claude Sonnet 4', context_window: 200000 },
    { model: 'claude-3-5-sonnet-20241022', alias: 'claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet', context_window: 200000 },
    { model: 'claude-3-5-haiku-20241022', alias: 'claude-3.5-haiku', display_name: 'Claude 3.5 Haiku', context_window: 200000 },
    { model: 'claude-3-opus-20240229', alias: 'claude-3-opus', display_name: 'Claude 3 Opus', context_window: 200000 },
  ],
  openrouter: [
    { model: 'anthropic/claude-3.5-sonnet', alias: 'claude-3.5-sonnet-or', display_name: 'Claude 3.5 Sonnet (OpenRouter)', context_window: 200000 },
    { model: 'google/gemini-2.0-flash', alias: 'gemini-2.0-flash-or', display_name: 'Gemini 2.0 Flash (OpenRouter)', context_window: 1048576 },
    { model: 'openai/gpt-4o-mini', alias: 'gpt-4o-mini-or', display_name: 'GPT-4o Mini (OpenRouter)', context_window: 128000 },
  ],
};

export default function Models() {
  const { t } = useTranslation();
  const [models, setModels] = useState<CustomModel[]>([]);
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [advancedModel, setAdvancedModel] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    provider_id: '',
    model: '',
    alias: '',
    display_name: '',
    api_format: 'openai' as 'openai' | 'gemini' | 'claude' | 'cohere',
    context_window: '',
    supports_streaming: true,
    supports_functions: false,
  });

  const loadData = () => {
    Promise.all([adminApi.listModels(), adminApi.listProviders()])
      .then(([mRes, pRes]) => { setModels(mRes.models); setProviders(pRes.providers); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminApi.createModel({
        provider_id: form.provider_id,
        model: form.model,
        alias: form.alias,
        display_name: form.display_name || form.alias,
        api_format: form.api_format,
        context_window: form.context_window ? parseInt(form.context_window) : undefined,
        supports_streaming: form.supports_streaming,
        supports_functions: form.supports_functions,
      });
      loadData();
      setShowCreate(false);
      setForm({ provider_id: '', model: '', alias: '', display_name: '', api_format: 'openai', context_window: '', supports_streaming: true, supports_functions: false });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    await adminApi.deleteModel(id);
    loadData();
  };

  const handleImportPreset = async (providerName: string) => {
    const presets = PRESET_MODELS[providerName];
    if (!presets) return;
    const provider = providers.find(p => p.name === providerName);
    if (!provider) { setError(`Provider "${providerName}" not found`); return; }

    setImporting(true);
    setError('');
    let created = 0;
    for (const p of presets) {
      try {
        await adminApi.createModel({
          provider_id: provider.id,
          model: p.model,
          alias: p.alias,
          display_name: p.display_name,
          api_format: (providerName === 'gemini' ? 'gemini' : 'openai') as 'openai' | 'gemini' | 'claude' | 'cohere',
          context_window: p.context_window,
          supports_streaming: true,
          supports_functions: false,
        });
        created++;
      } catch {}
    }
    setImporting(false);
    if (created > 0) loadData();
    else setError('Failed to import some models');
  };

  const getProviderName = (providerId: string) => {
    return providers.find(p => p.id === providerId)?.display_name || providers.find(p => p.id === providerId)?.name || providerId;
  };

  const formatOptions = [
    { value: 'openai', label: 'OpenAI (chat/completions)' },
    { value: 'gemini', label: 'Google Gemini (generateContent)' },
    { value: 'claude', label: 'Anthropic Claude (messages)' },
    { value: 'cohere', label: 'Cohere (chat)' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('models.title')}</h1>
        <div className="flex gap-3">
          <select
            onChange={e => { if (e.target.value) handleImportPreset(e.target.value); e.target.value = ''; }}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
            disabled={importing}
          >
            <option value="">📥 导入预设模型...</option>
            {Object.keys(PRESET_MODELS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ {t('models.create')}</button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : models.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          {t('common.no_results')}<br />
          <span className="text-sm">Use "导入预设模型" above for quick setup</span>
        </div>
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
                <th className="text-left px-6 py-3 table-header">{t('models.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{m.display_name || m.alias}</div>
                    <div className="text-xs text-gray-400 font-mono">{m.alias}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{m.model}</td>
                  <td className="px-6 py-4">
                    <span className="badge-blue text-xs">{getProviderName(m.provider_id)}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.api_format}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.context_window ? (m.context_window >= 1000000 ? `${(m.context_window/1000000).toFixed(1)}M` : m.context_window.toLocaleString()) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <button
                        onClick={() => setAdvancedModel(advancedModel === m.id ? null : m.id)}
                        className="text-xs text-gray-400 hover:text-coral"
                      >
                        {advancedModel === m.id ? '收起' : '高级'}
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="text-red-500 text-sm hover:underline">
                        {t('common.delete')}
                      </button>
                    </div>
                    {advancedModel === m.id && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        <div>Streaming: {m.supports_streaming ? '✅' : '❌'}</div>
                        <div>Functions: {m.supports_functions ? '✅' : '❌'}</div>
                        <div>Enabled: {m.enabled ? '✅' : '❌'}</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('models.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                <select value={form.provider_id} onChange={e => setForm({ ...form, provider_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" required>
                  <option value="">Select a provider...</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.upstream')} *</label>
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="gpt-4o-mini" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.alias')} *</label>
                  <input type="text" value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="my-gpt-4o" required />
                </div>
              </div>

              {/* Advanced */}
              <details className="border rounded-lg p-3 bg-gray-50">
                <summary className="text-sm font-medium text-gray-600 cursor-pointer select-none">⚙️ 高级选项</summary>
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.display_name')}</label>
                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="GPT-4o Mini (Custom)" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.format')}</label>
                    <select value={form.api_format} onChange={e => setForm({ ...form, api_format: e.target.value as 'openai' | 'gemini' | 'claude' | 'cohere' })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                      {formatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.context_window')} (tokens)</label>
                    <input type="number" value={form.context_window} onChange={e => setForm({ ...form, context_window: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="128000" />
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
    </div>
  );
}
