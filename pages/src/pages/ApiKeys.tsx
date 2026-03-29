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

  // Create form state
  const [form, setForm] = useState<CreateKeyBody>({
    name: '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_secret: '',
    rate_limit: 60,
  });

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
      const result = await adminApi.createKey(form);
      // Show the raw key once
      setNewKeyValue(result.key_value ?? result.key_prefix);
      // Reload keys
      loadKeys();
      setShowCreate(false);
      setForm({ name: '', provider: 'openai', model: 'gpt-4o-mini', api_secret: '', rate_limit: 60 });
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

  const providers = ['openai', 'gemini', 'claude', 'qwen', 'cohere'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('keys.title')}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
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
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 table-header">{t('keys.name')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.provider')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.model')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.rate_limit')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.status')}</th>
                <th className="text-left px-6 py-3 table-header">{t('keys.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(key => (
                <tr key={key.id} className="table-row">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-gray-700">{key.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{key.key_prefix}***</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge-blue capitalize">{key.provider}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">{key.model}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{key.rate_limit}/min</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(key.id, key.enabled)}
                      className={key.enabled ? 'badge-green' : 'badge-red'}
                    >
                      {key.enabled ? t('keys.enabled') : t('keys.disabled')}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      {t('keys.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show new key once */}
      {newKeyValue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-navy mb-2">{t('keys.key_value')}</h3>
            <p className="text-sm text-gray-500 mb-4">⚠️ {t('keys.key_value')} — {t('keys.copied')}</p>
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold text-navy mb-4">{t('keys.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  placeholder="My Gemini Key"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.provider')}</label>
                  <select
                    value={form.provider}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  >
                    {providers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.model')}</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    placeholder="gemini-2.5-pro"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                <input
                  type="password"
                  value={form.api_secret}
                  onChange={e => setForm({ ...form, api_secret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm"
                  placeholder="Your upstream API key"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.rate_limit')}</label>
                <input
                  type="number"
                  value={form.rate_limit}
                  onChange={e => setForm({ ...form, rate_limit: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  min={1}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{t('common.create')}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
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
