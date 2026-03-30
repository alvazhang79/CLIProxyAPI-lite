import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type CustomModel, type CustomProvider } from '../lib/api';

// Preset quick-import lists
const PRESET_MODELS: Record<string, { model: string; alias: string; display_name: string; context_window?: number }[]> = {
  openai: [
    { model: 'gpt-4o', alias: 'gpt-4o', display_name: 'GPT-4o', context_window: 128000 },
    { model: 'gpt-4o-mini', alias: 'gpt-4o-mini', display_name: 'GPT-4o Mini', context_window: 128000 },
    { model: 'gpt-4-turbo', alias: 'gpt-4-turbo', display_name: 'GPT-4 Turbo', context_window: 128000 },
    { model: 'gpt-3.5-turbo', alias: 'gpt-3.5-turbo', display_name: 'GPT-3.5 Turbo', context_window: 16385 },
  ],
  gemini: [
    { model: 'gemini-2.0-flash', alias: 'gemini-2.0-flash', display_name: 'Gemini 2.0 Flash', context_window: 1048576 },
    { model: 'gemini-1.5-flash', alias: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', context_window: 1048576 },
    { model: 'gemini-1.5-pro', alias: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', context_window: 1048576 },
  ],
  claude: [
    { model: 'claude-sonnet-4-20250514', alias: 'claude-sonnet-4', display_name: 'Claude Sonnet 4', context_window: 200000 },
    { model: 'claude-3-5-sonnet-20241022', alias: 'claude-3.5-sonnet', display_name: 'Claude 3.5 Sonnet', context_window: 200000 },
    { model: 'claude-3-5-haiku-20241022', alias: 'claude-3.5-haiku', display_name: 'Claude 3.5 Haiku', context_window: 200000 },
  ],
};

export default function Models() {
  const { t } = useTranslation();
  const [models, setModels] = useState<CustomModel[]>([]);
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [error, setError] = useState('');
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

  // Bulk import state
  const [bulkProviderId, setBulkProviderId] = useState('');
  const [fetchedModels, setFetchedModels] = useState<{ id: string; display_name: string; created?: number }[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkImportMode, setBulkImportMode] = useState<'preset' | 'fetch'>('preset');
  const [bulkPreset, setBulkPreset] = useState('');
  const [bulkApiKey, setBulkApiKey] = useState('');

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

  // Fetch models from upstream provider API via Workers proxy
  const fetchProviderModels = async (providerId: string) => {
    setFetchingModels(true);
    setFetchedModels([]);
    setBulkSelected(new Set());
    setError('');

    const provider = providers.find(p => p.id === providerId);
    if (!provider) { setFetchingModels(false); return; }

    try {
      // Call Workers API via adminApi which handles URL fallback
      const res = await adminApi.fetchProviderModels(providerId, bulkApiKey || undefined);
      setFetchedModels((res.models || []).sort((a, b) => a.id.localeCompare(b.id)));
    } catch (err) {
      setError((err as Error).message || '获取模型列表失败');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleBulkImport = async () => {
    setImporting(true);
    setError('');

    const provider = providers.find(p => p.id === (bulkProviderId || form.provider_id));
    if (!provider) { setImporting(false); return; }

    let toImport: { model: string; alias: string; display_name: string }[] = [];

    if (bulkImportMode === 'preset') {
      const preset = PRESET_MODELS[bulkPreset] || [];
      toImport = preset;
    } else {
      // Import selected from fetched
      toImport = fetchedModels
        .filter(m => bulkSelected.has(m.id))
        .map(m => ({ model: m.id, alias: m.id, display_name: m.display_name }));
    }

    let imported = 0;
    for (const item of toImport) {
      try {
        await adminApi.createModel({
          provider_id: provider.id,
          model: item.model,
          alias: item.alias,
          display_name: item.display_name,
          api_format: provider.name === 'gemini' ? 'gemini' : 'openai',
          supports_streaming: true,
          supports_functions: false,
        });
        imported++;
      } catch {}
    }

    setImporting(false);
    if (imported > 0) {
      setShowBulkImport(false);
      setBulkSelected(new Set());
      setFetchedModels([]);
      loadData();
    } else {
      setError('导入失败，请检查模型是否已存在');
    }
  };

  const toggleBulkModel = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFetched = () => {
    if (bulkSelected.size === fetchedModels.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(fetchedModels.map(m => m.id)));
    }
  };

  const getProviderName = (providerId: string) =>
    providers.find(p => p.id === providerId)?.display_name || providers.find(p => p.id === providerId)?.name || providerId;

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
          <button
            onClick={() => { setBulkImportMode('fetch'); setShowBulkImport(true); }}
            className="btn-secondary border-coral text-coral hover:bg-coral hover:text-white"
          >
            🔍 从 Provider 获取模型列表
          </button>
          <div className="relative">
            <select
              onChange={e => {
                const v = e.target.value;
                if (!v) return;
                setBulkImportMode('preset');
                setBulkPreset(v);
              }}
              className="px-3 py-2 border rounded-lg text-sm bg-white appearance-none pr-8"
            >
              <option value="">📥 导入预设模型...</option>
              {Object.keys(PRESET_MODELS).map(k => <option key={k} value={k}>{k.toUpperCase()} 预设</option>)}
            </select>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ {t('models.create')}</button>
        </div>
      </div>

      {/* Bulk preset import */}
      {bulkPreset && bulkImportMode === 'preset' && (
        <div className="mb-4 p-4 bg-coral/5 border border-coral/20 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-navy">📥 即将导入: {PRESET_MODELS[bulkPreset]?.length} 个模型</h3>
              <p className="text-xs text-gray-500 mt-1">{PRESET_MODELS[bulkPreset]?.map(m => m.alias).join(', ')}</p>
            </div>
            <button
              onClick={async () => {
                const p = providers.find(pr => pr.name === bulkPreset);
                if (!p) return;
                setImporting(true);
                for (const m of PRESET_MODELS[bulkPreset] || []) {
                  try {
                    await adminApi.createModel({
                      provider_id: p.id, model: m.model, alias: m.alias,
                      display_name: m.display_name, api_format: bulkPreset === 'gemini' ? 'gemini' : 'openai',
                      context_window: m.context_window, supports_streaming: true, supports_functions: false,
                    });
                  } catch {}
                }
                setImporting(false);
                setBulkPreset('');
                loadData();
              }}
              disabled={importing}
              className="btn-primary text-sm"
            >
              {importing ? '导入中...' : `✅ 确认导入到 ${bulkPreset.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}

      {loading ? <div className="text-gray-400">{t('common.loading')}</div>
      : models.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          {t('common.no_results')}<br />
          <span className="text-sm">Use "从 Provider 获取模型列表" for bulk import</span>
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
                  <td className="px-6 py-4"><span className="badge-blue text-xs">{getProviderName(m.provider_id)}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.api_format}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.context_window ? (m.context_window >= 1000000 ? `${(m.context_window/1000000).toFixed(1)}M` : m.context_window.toLocaleString()) : '-'}
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

      {/* Bulk import modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-navy">🔍 批量导入模型</h3>
              <button onClick={() => setShowBulkImport(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setBulkImportMode('fetch'); setBulkProviderId(''); setFetchedModels([]); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bulkImportMode === 'fetch' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🔍 从 API 获取（推荐）
              </button>
              <button
                onClick={() => setBulkImportMode('preset')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bulkImportMode === 'preset' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                📋 预设列表
              </button>
            </div>

            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            {bulkImportMode === 'fetch' ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择 Provider（将调用其 /models 接口）</label>
                  <select
                    value={bulkProviderId}
                    onChange={e => { setBulkProviderId(e.target.value); setFetchedModels([]); setBulkSelected(new Set()); }}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">选择 Provider...</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name} ({p.base_url})</option>)}
                  </select>
                  {bulkProviderId && (
                    <>
                      <input
                        type="password"
                        value={bulkApiKey}
                        onChange={e => setBulkApiKey(e.target.value)}
                        placeholder="Provider API Key（可选，如已在设置中存储则留空）"
                        className="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                      />
                      <button
                        onClick={() => fetchProviderModels(bulkProviderId)}
                        disabled={fetchingModels}
                        className="mt-2 btn-secondary text-sm"
                      >
                        {fetchingModels ? '获取中...' : '📡 获取模型列表'}
                      </button>
                    </>
                  )}
                </div>

                {fetchedModels.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">共 {fetchedModels.length} 个模型，已选择 {bulkSelected.size} 个</span>
                      <button onClick={toggleAllFetched} className="text-sm text-coral hover:underline">
                        {bulkSelected.size === fetchedModels.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto border rounded-lg p-3 space-y-1 max-h-80">
                      {fetchedModels.map(m => (
                        <label key={m.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${bulkSelected.has(m.id) ? 'bg-coral/5' : ''}`}>
                          <input
                            type="checkbox"
                            checked={bulkSelected.has(m.id)}
                            onChange={() => toggleBulkModel(m.id)}
                            className="w-4 h-4 rounded accent-coral"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-800 truncate">{m.display_name}</div>
                            <div className="text-xs text-gray-400 font-mono truncate">{m.id}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={handleBulkImport}
                        disabled={bulkSelected.size === 0 || importing}
                        className="btn-primary flex-1 disabled:opacity-50"
                      >
                        {importing ? '导入中...' : `✅ 导入选中的 ${bulkSelected.size} 个模型`}
                      </button>
                      <button onClick={() => setShowBulkImport(false)} className="btn-secondary">取消</button>
                    </div>
                  </>
                )}

                {!fetchingModels && fetchedModels.length === 0 && !bulkProviderId && (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-4">🔍</div>
                    <p>选择一个 Provider 后，点击「获取模型列表」</p>
                    <p className="text-xs mt-2">系统会调用 Provider 的 /models 接口获取所有可用模型</p>
                  </div>
                )}

                {fetchingModels && (
                  <div className="text-center py-12 text-gray-400">
                    <div className="animate-spin text-3xl mb-4">⏳</div>
                    <p>正在获取模型列表...</p>
                  </div>
                )}
              </>
            ) : (
              /* Preset mode in modal */
              <div className="space-y-4">
                <p className="text-sm text-gray-500">从预设列表中选择要导入的模型：</p>
                {Object.entries(PRESET_MODELS).map(([key, list]) => {
                  const p = providers.find(pr => pr.name === key);
                  if (!p) return null;
                  return (
                    <div key={key} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-navy uppercase">{key}</h4>
                        <button
                          onClick={async () => {
                            setImporting(true);
                            for (const m of list) {
                              try {
                                await adminApi.createModel({
                                  provider_id: p.id, model: m.model, alias: m.alias,
                                  display_name: m.display_name, api_format: key === 'gemini' ? 'gemini' : 'openai',
                                  context_window: m.context_window, supports_streaming: true, supports_functions: false,
                                });
                              } catch {}
                            }
                            setImporting(false);
                            setShowBulkImport(false);
                            loadData();
                          }}
                          disabled={importing}
                          className="btn-primary text-xs"
                        >
                          {importing ? '导入中...' : `✅ 全部导入 ${list.length} 个`}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {list.map(m => (
                          <span key={m.alias} className="text-xs bg-gray-100 rounded px-2 py-1 text-gray-600">{m.alias}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create single model modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('models.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                <select value={form.provider_id} onChange={e => setForm({ ...form, provider_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" required>
                  <option value="">选择 Provider...</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.upstream')} *</label>
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.alias')} *</label>
                  <input type="text" value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" required />
                </div>
              </div>

              <details className="border rounded-lg p-3 bg-gray-50">
                <summary className="text-sm font-medium text-gray-600 cursor-pointer select-none">⚙️ 高级选项</summary>
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.display_name')}</label>
                    <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.format')}</label>
                    <select value={form.api_format} onChange={e => setForm({ ...form, api_format: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                      {formatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('models.context_window')} (tokens)</label>
                    <input type="number" value={form.context_window} onChange={e => setForm({ ...form, context_window: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" />
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
