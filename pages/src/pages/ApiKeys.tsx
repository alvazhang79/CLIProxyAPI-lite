import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type APIKey, type CreateKeyBody } from '../lib/api';

export default function ApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<CreateKeyBody>({
    name: '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_secret: '',
    embeddings_provider: '',
    embeddings_model: '',
    excluded_models: '',
    rate_limit: 60,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadKeys = () => {
    adminApi.listKeys()
      .then(res => setKeys(res.keys))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await adminApi.createKey({
        ...form,
        embeddings_model: form.embeddings_model || undefined,
        excluded_models: form.excluded_models ? form.excluded_models.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      setNewKeyValue(result.key_value ?? result.key_prefix);
      loadKeys();
      setShowCreate(false);
      setForm({ name: '', provider: 'openai', model: 'gpt-4o-mini', api_secret: '', embeddings_provider: '', embeddings_model: '', excluded_models: '', rate_limit: 60 });
      setShowAdvanced(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('keys.confirm_delete'))) return;
    await adminApi.deleteKey(id);
    loadKeys();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await adminApi.toggleKey(id, !enabled);
    loadKeys();
  };

  const copyKey = () => {
    if (!newKeyValue) return;
    navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group keys by provider
  const groupedKeys = keys.reduce<Record<string, APIKey[]>>((acc, k) => {
    const p = k.provider || 'other';
    if (!acc[p]) acc[p] = [];
    acc[p].push(k);
    return acc;
  }, {});

  const providerLabels: Record<string, string> = {
    openai: '🟢 OpenAI',
    gemini: '🟡 Google Gemini',
    claude: '🟣 Anthropic Claude',
    qwen: '🔵 Alibaba Qwen',
    cohere: '🔷 Cohere',
    other: '⚪ Other',
  };

  const providers = ['openai', 'gemini', 'claude', 'qwen', 'cohere', 'other'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t('keys.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{keys.length} key(s) total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + {t('keys.create')}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : keys.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          {t('common.no_results')}
        </div>
      ) : (
        <div className="space-y-6">
          {providers.map(p => {
            if (!groupedKeys[p]?.length) return null;
            return (
              <div key={p} className="card">
                <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  {providerLabels[p] || p}
                  <span className="text-xs font-normal text-gray-400">({groupedKeys[p].length})</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-2 text-xs table-header">Name</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Model</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Embedding</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Excluded</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Rate</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Status</th>
                        <th className="text-left px-4 py-2 text-xs table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedKeys[p].map(key => (
                        <tr key={key.id} className="table-row border-b last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-sm text-gray-800">{key.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{key.key_prefix}***</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{key.model}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            {key.embeddings_model || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {key.excluded_models?.length ? `${key.excluded_models.length} models` : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{key.rate_limit}/m</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleToggle(key.id, key.enabled)} className={`text-xs px-2 py-1 rounded font-medium ${key.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {key.enabled ? 'ON' : 'OFF'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDelete(key.id)} className="text-red-500 text-xs hover:underline">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show new key modal */}
      {newKeyValue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-navy mb-2">{t('keys.key_value')}</h3>
            <p className="text-sm text-gray-500 mb-4">⚠️ Save this key — it won't be shown again</p>
            <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm break-all text-gray-700 mb-4">
              {newKeyValue}
            </div>
            <div className="flex gap-3">
              <button onClick={copyKey} className="btn-primary flex-1">
                {copied ? '✅ ' + t('keys.copied') : t('keys.copy')}
              </button>
              <button onClick={() => setNewKeyValue(null)} className="btn-secondary flex-1">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('keys.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.name')}</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="My API Key" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.provider')}</label>
                  <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                    {providers.filter(p => p !== 'other').map(p => <option key={p} value={p}>{providerLabels[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.model')}</label>
                  <input type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="gpt-4o-mini" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Secret *</label>
                <input type="password" value={form.api_secret} onChange={e => setForm({ ...form, api_secret: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="sk-..." required />
              </div>

              {/* Advanced options */}
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-gray-500 border px-3 py-1 rounded hover:bg-gray-50">
                {showAdvanced ? '▲ 收起高级选项' : '▼ 高级选项'}
              </button>

              {showAdvanced && (
                <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.emb_model')}</label>
                      <input type="text" value={form.embeddings_model} onChange={e => setForm({ ...form, embeddings_model: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="text-embedding-3-small" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.rate_limit')}</label>
                      <input type="number" value={form.rate_limit} onChange={e => setForm({ ...form, rate_limit: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" min={1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Excluded Models <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                    <input type="text" value={form.excluded_models} onChange={e => setForm({ ...form, excluded_models: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="gpt-4,gpt-4-turbo" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('common.create')}</button>
                <button type="button" onClick={() => { setShowCreate(false); setShowAdvanced(false); }} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
