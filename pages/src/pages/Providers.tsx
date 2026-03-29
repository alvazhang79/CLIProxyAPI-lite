import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Provider, type CreateProviderBody } from '../lib/api';

// Model preset options for quick-add
const PRESETS = [
  { id: 'openrouter-free', name: 'OpenRouter Free', description: 'moonshotai/kimi-k2, deepseek-v3.1, qwen-72b...' },
  { id: 'openrouter-popular', name: 'OpenRouter Popular', description: 'gpt-4o, claude-3.5-sonnet, gemini-2.5-pro...' },
  { id: 'gemini-free', name: 'Gemini Free', description: 'gemini-2.5-pro, gemini-2.5-flash, gemini-1.5-flash...' },
];

export default function Providers() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreset, setShowPreset] = useState(false);
  const [presetProviderId, setPresetProviderId] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState('');
  const [importResult, setImportResult] = useState('');
  const [form, setForm] = useState<CreateProviderBody>({
    name: '', display_name: '', base_url: '', auth_type: 'bearer', auth_header: 'Authorization',
  });

  const load = useCallback(async () => {
    try {
      const data = await adminApi.listProviders();
      setProviders(data.providers as Provider[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminApi.createProvider(form);
      setShowCreate(false);
      setForm({ name: '', display_name: '', base_url: '', auth_type: 'bearer', auth_header: 'Authorization' });
      load();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider and all its models?')) return;
    await adminApi.deleteProvider(id);
    load();
  };

  const handleImportPreset = async (presetId: string) => {
    if (!presetProviderId) { setError('Select a provider first'); return; }
    setImporting(presetId);
    setImportResult('');
    try {
      const res = await adminApi.importPreset(presetProviderId, presetId);
      setImportResult(`✅ Added ${res.added}, skipped ${res.skipped}`);
      setTimeout(() => setImportResult(''), 4000);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setImporting('');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">{t('providers.title')}</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowPreset(true)} className="btn-secondary text-sm">📦 Import Preset</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ {t('providers.create')}</button>
        </div>
      </div>

      {loading ? <div className="text-gray-400">{t('common.loading')}</div>
       : providers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">{t('common.no_results')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {providers.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-navy">{p.display_name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{p.name}</p>
                </div>
                <span className={p.enabled ? 'badge-green' : 'badge-red'}>{p.enabled ? 'Active' : 'Disabled'}</span>
              </div>
              <p className="text-sm text-gray-500 font-mono mb-2 truncate" title={p.base_url}>{p.base_url}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                <span className="badge text-xs bg-gray-100">{p.auth_type}</span>
                {p.proxy_url && <span className="badge text-xs bg-orange-100">⚙️ proxy</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(p.id)} className="text-red-500 text-sm hover:underline">{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importResult && (
        <div className="fixed bottom-6 right-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg shadow-lg text-sm z-50">
          {importResult}
        </div>
      )}

      {/* Import Preset Modal */}
      {showPreset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold text-navy mb-4">📦 Import Model Preset</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Provider</label>
              <select
                value={presetProviderId}
                onChange={e => setPresetProviderId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
              >
                <option value="">Select a provider...</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.name})</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Select the provider these models should route to</p>
            </div>

            <div className="space-y-3 mb-4">
              {PRESETS.map(preset => (
                <div key={preset.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-navy">{preset.name}</span>
                    <button
                      onClick={() => handleImportPreset(preset.id)}
                      disabled={!presetProviderId || importing === preset.id}
                      className="text-xs btn-primary px-3 py-1 disabled:opacity-50"
                    >
                      {importing === preset.id ? '...' : 'Import'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{preset.description}</p>
                </div>
              ))}
            </div>

            <button onClick={() => { setShowPreset(false); setImportResult(''); }} className="btn-secondary w-full">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold text-navy mb-4">{t('providers.create')}</h3>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('providers.name')} <span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono" placeholder="openrouter" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('providers.display_name')}</label>
                  <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral" placeholder="OpenRouter" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('providers.base_url')} <span className="text-red-500">*</span></label>
                <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="https://openrouter.ai/api/v1" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('providers.auth_type')}</label>
                  <select value={form.auth_type} onChange={e => setForm({ ...form, auth_type: e.target.value as 'bearer' | 'api_key' | 'custom' })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral">
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key Header</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Auth Header</label>
                  <input value={form.auth_header} onChange={e => setForm({ ...form, auth_header: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('providers.proxy')}</label>
                <input value={form.proxy_url ?? ''} onChange={e => setForm({ ...form, proxy_url: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm" placeholder="socks5://127.0.0.1:1080 (optional)" />
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
