import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type APIKey } from '../lib/api';

export default function ApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Create form state
  const [form, setForm] = useState({
    name: '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_secret: '',
    embeddings_model: '',
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
      const result = await adminApi.createKey({
        name: form.name,
        provider: form.provider,
        model: form.model,
        api_secret: form.api_secret || 'dummy', // backend generates real key
        embeddings_model: form.embeddings_model || undefined,
        rate_limit: form.rate_limit,
      });
      // Show the generated key
      setShowCreate(false);
      setShowKeyModal({ key: result.key_value, name: form.name });
      setForm({ name: '', provider: 'openai', model: 'gpt-4o-mini', api_secret: '', embeddings_model: '', rate_limit: 60 });
      loadKeys();
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

  const handleRegenerate = async (id: string, name: string) => {
    if (!confirm('重新生成此 Key？旧 Key 将立即失效！')) return;
    setError('');
    try {
      const result = await adminApi.createKey({
        name: `${name} (new)`,
        provider: keys.find(k => k.id === id)?.provider || 'openai',
        model: keys.find(k => k.id === id)?.model || 'gpt-4o-mini',
        api_secret: 'regenerate',
        rate_limit: keys.find(k => k.id === id)?.rate_limit || 60,
      });
      // Show the NEW key
      setShowKeyModal({ key: result.key_value, name: `${name} (已重新生成)` });
      loadKeys();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t('keys.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">创建后密钥只显示一次，请妥善保存</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + {t('keys.create')}
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : keys.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-4xl mb-4">🔑</div>
          <div>{t('common.no_results')}</div>
          <div className="text-sm mt-2">点击右上角「{t('keys.create')}」创建第一个 Key</div>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <div key={key.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-navy">{key.name}</h3>
                    <span className="badge-blue capitalize text-xs">{key.provider}</span>
                    <span className={`badge-sm ${key.enabled ? 'badge-green' : 'badge-red'}`}>
                      {key.enabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block mb-1">
                    {key.key_prefix}••••••••••
                  </div>
                  <div className="text-xs text-gray-400">
                    模型: {key.model} · 限速: {key.rate_limit}/min
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => copyKey(key.key_prefix + 'xxxxxxxxxxxxxxxxxxxxxxxx')}
                    className="btn-secondary text-xs py-1 px-3"
                    title="复制 Key 前缀"
                  >
                    📋 复制
                  </button>
                  <button
                    onClick={() => handleRegenerate(key.id, key.name)}
                    className="btn-secondary text-xs py-1 px-3"
                    title="重新生成新 Key"
                  >
                    🔄 重新生成
                  </button>
                  <button
                    onClick={() => handleToggle(key.id, key.enabled)}
                    className={`text-xs py-1 px-3 rounded border ${
                      key.enabled ? 'border-orange-300 text-orange-500 hover:bg-orange-50' : 'border-green-300 text-green-500 hover:bg-green-50'
                    }`}
                  >
                    {key.enabled ? '⏸ 禁用' : '▶ 启用'}
                  </button>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="text-red-500 text-xs hover:underline py-1 px-3"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 密钥显示弹窗 - 只显示一次 */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg mx-4 text-center">
            <div className="text-5xl mb-4">🔑</div>
            <h3 className="text-xl font-bold text-navy mb-2">API Key 已创建</h3>
            <p className="text-sm text-gray-500 mb-4">⚠️ 密钥仅显示这一次，请立即复制保存！</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-600">丢失将无法恢复，只能重新生成</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm break-all text-left text-gray-700 mb-4 max-h-24 overflow-y-auto">
              {showKeyModal.key}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { copyKey(showKeyModal.key); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="btn-primary flex-1"
              >
                {copied ? '✅ 已复制' : '📋 复制 Key'}
              </button>
              <button onClick={() => setShowKeyModal(null)} className="btn-secondary flex-1">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建 Key 弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('keys.create')}</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
              💡 填写你的上游 API Key（系统会为你生成一个对外使用的代理 Key）
            </div>
            {error && <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key 名称</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  placeholder="我的 Gemini Key"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">提供商</label>
                  <select
                    value={form.provider}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                    <option value="qwen">Qwen</option>
                    <option value="cohere">Cohere</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                  <input
                    type="text" value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    placeholder="gpt-4o-mini"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  上游 API Key <span className="text-gray-400 text-xs">（系统替你生成代理 Key）</span>
                </label>
                <input
                  type="password" value={form.api_secret}
                  onChange={e => setForm({ ...form, api_secret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm"
                  placeholder="sk-..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Embedding 模型</label>
                  <input
                    type="text" value={form.embeddings_model}
                    onChange={e => setForm({ ...form, embeddings_model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    placeholder="可选"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('keys.rate_limit')}</label>
                  <input
                    type="number" value={form.rate_limit}
                    onChange={e => setForm({ ...form, rate_limit: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    min={1}
                  />
                </div>
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
