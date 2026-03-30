import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type APIKey, type CustomModel, type CustomProvider } from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ApiKeys() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [copyTooltip, setCopyTooltip] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Model selection state: map of model alias -> selected
  const [selectedModels, setSelectedModels] = useState<Record<string, boolean>>({});
  const [selectAllModels, setSelectAllModels] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    provider: 'openai',
    api_secret: '',
    embeddings_model: '',
    rate_limit: 60,
  });

  // Generate random API key
  const generateApiKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const key = 'sk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => chars[b % chars.length])
      .join('');
    setForm({ ...form, api_secret: key });
  };

  const loadData = () => {
    Promise.all([adminApi.listKeys(), adminApi.listModels(), adminApi.listProviders()])
      .then(([kRes, mRes, pRes]) => {
        setKeys(kRes.keys);
        setModels(mRes.models);
        setProviders(pRes.providers);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Determine allowed_models
    const allowedModels: string[] = selectAllModels
      ? []
      : Object.entries(selectedModels)
          .filter(([, v]) => v)
          .map(([k]) => k);

    try {
      const result = await adminApi.createKey({
        name: form.name,
        provider: form.provider,
        model: '*', // wildcard when allowed_models is set
        allowed_models: allowedModels,
        api_secret: form.api_secret || 'placeholder',
        embeddings_model: form.embeddings_model || undefined,
        rate_limit: form.rate_limit,
      });
      setShowCreate(false);
      setShowKeyModal({ key: result.key_value, name: form.name });
      setSelectedModels({});
      setSelectAllModels(false);
      setForm({
        name: '',
        provider: 'openai',
        api_secret: '',
        embeddings_model: '',
        rate_limit: 60,
      });
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('keys.confirm_delete') || '确认删除',
      message: '确定要删除这个 API Key 吗？此操作无法撤销。',
      onConfirm: async () => {
        await adminApi.deleteKey(id);
        loadData();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
      danger: true,
    });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await adminApi.toggleKey(id, !enabled);
    loadData();
  };

  const handleRegenerate = async (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '重新生成 Key',
      message: '重新生成此 Key？旧 Key 将立即失效！',
      onConfirm: async () => {
        setError('');
        try {
          const result = await adminApi.regenerateKey(id);
          setShowKeyModal({ key: result.key_value, name: `${name} (已重新生成)` });
          loadData();
        } catch (err) {
          setError((err as Error).message);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
      danger: true,
    });
  };

  const handleUpdateModels = async (id: string, allowed_models: string[]) => {
    try {
      await (adminApi as any).updateKey(id, { allowed_models });
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getProviderName = (providerId: string) => {
    return (
      providers.find((p) => p.id === providerId)?.display_name ||
      providers.find((p) => p.id === providerId)?.name ||
      providerId
    );
  };

  // Get model display name
  const getModelDisplay = (alias: string) => {
    const m = models.find((m) => m.alias === alias);
    return m?.display_name || m?.alias || alias;
  };

  // Models grouped by provider
  const modelsByProvider = models.reduce(
    (acc, m) => {
      const pid = m.provider_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(m);
      return acc;
    },
    {} as Record<string, CustomModel[]>
  );

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

      {error && (
        <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</div>
      )}

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
          {keys.map((key) => {
            const allowed: string[] = (key as any).allowed_models || [];
            const isAll = allowed.length === 0;

            return (
              <div key={key.id} className="card">
                <div className="flex items-start justify-between">
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
                      限速: {key.rate_limit}/min ·{' '}
                      <span className={isAll ? 'text-green-600 font-medium' : 'text-gray-500'}>
                        {isAll ? '✅ 全部模型' : `${allowed.length} 个模型`}
                      </span>
                      {isAll
                        ? ''
                        : ` (${allowed
                            .slice(0, 3)
                            .map(getModelDisplay)
                            .join(', ')}${allowed.length > 3 ? '...' : ''})`}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4 flex-wrap justify-end">
                    <div className="relative">
                      <button
                        onMouseEnter={() => setCopyTooltip(key.id)}
                        onMouseLeave={() => setCopyTooltip(null)}
                        className="btn-secondary text-xs py-1 px-3 opacity-50"
                      >
                        📋 复制
                      </button>
                      {copyTooltip === key.id && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-10">
                          密钥已不可见，请点击「重新生成」
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRegenerate(key.id, key.name)}
                      className="btn-secondary text-xs py-1 px-3"
                      title="重新生成"
                    >
                      🔄 重新生成
                    </button>
                    <button
                      onClick={() => handleToggle(key.id, key.enabled)}
                      className={`text-xs py-1 px-3 rounded border ${
                        key.enabled
                          ? 'border-orange-300 text-orange-500 hover:bg-orange-50'
                          : 'border-green-300 text-green-500 hover:bg-green-50'
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

                {/* Model selection */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">允许的模型:</span>
                    <button
                      onClick={() => handleUpdateModels(key.id, isAll ? ['*'] : [])}
                      className="text-xs text-coral hover:underline"
                    >
                      {isAll ? '切换为选择特定模型' : '设为全部模型'}
                    </button>
                  </div>
                  {!isAll && (
                    <div className="flex flex-wrap gap-2">
                      {models.map((m) => {
                        const sel = allowed.includes(m.alias);
                        return (
                          <button
                            key={m.alias}
                            onClick={() => {
                              const newAllowed = sel
                                ? allowed.filter((a) => a !== m.alias)
                                : [...allowed, m.alias];
                              handleUpdateModels(key.id, newAllowed);
                            }}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              sel
                                ? 'bg-coral text-white border-coral'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-coral'
                            }`}
                          >
                            {m.display_name || m.alias}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 密钥显示弹窗 */}
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
                onClick={() => {
                  copyKey(showKeyModal.key);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
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
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-navy mb-4">{t('keys.create')}</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
              💡 填写你的上游 API Key（系统会为你生成一个对外使用的代理 Key），并选择此 Key 允许访问哪些模型
            </div>

            {error && (
              <div className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded">{error}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key 名称</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    placeholder="我的 Gemini Key"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">提供商</label>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.display_name || p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上游 API Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.api_secret}
                    onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm"
                    placeholder="sk-... 或点击生成按钮"
                    required
                  />
                  <button
                    type="button"
                    onClick={generateApiKey}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap"
                  >
                    🎲 生成
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Embedding 模型 <span className="text-gray-400 text-xs">（可选）</span>
                  </label>
                  <input
                    type="text"
                    value={form.embeddings_model}
                    onChange={(e) => setForm({ ...form, embeddings_model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    placeholder="可选"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('keys.rate_limit')}
                  </label>
                  <input
                    type="number"
                    value={form.rate_limit}
                    onChange={(e) => setForm({ ...form, rate_limit: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
                    min={1}
                  />
                </div>
              </div>

              {/* Model selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">允许访问的模型</label>
                  <button
                    type="button"
                    onClick={() => setSelectAllModels(!selectAllModels)}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${
                      selectAllModels
                        ? 'bg-green-500 text-white border-green-500'
                        : 'border-gray-300 text-gray-500 hover:border-coral'
                    }`}
                  >
                    {selectAllModels ? '✅ 全部模型（已选）' : '选择全部模型'}
                  </button>
                </div>

                {models.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
                    暂无自定义模型，请先在「Models」页面添加模型
                  </div>
                ) : (
                  <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                    {Object.entries(modelsByProvider).map(([providerId, mList]) => {
                      const pName = getProviderName(providerId);
                      return (
                        <div key={providerId}>
                          <div className="text-xs font-medium text-gray-400 mb-1 uppercase">
                            {pName}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {mList.map((m) => (
                              <button
                                type="button"
                                key={m.alias}
                                onClick={() => {
                                  if (selectAllModels) return;
                                  setSelectedModels((prev) => ({
                                    ...prev,
                                    [m.alias]: !prev[m.alias],
                                  }));
                                }}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${
                                  selectAllModels
                                    ? 'bg-green-500 text-white border-green-500'
                                    : selectedModels[m.alias]
                                      ? 'bg-coral text-white border-coral'
                                      : 'bg-white text-gray-600 border-gray-200 hover:border-coral'
                                }`}
                              >
                                {m.display_name || m.alias}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {Object.values(selectedModels).some(Boolean) && !selectAllModels && (
                  <div className="text-xs text-coral mt-1">
                    已选择 {Object.values(selectedModels).filter(Boolean).length} 个模型
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {t('common.create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setSelectedModels({});
                    setSelectAllModels(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  {t('common.cancel')}
                </button>
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
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        confirmText="确认"
        cancelText="取消"
        danger={confirmDialog.danger}
      />
    </div>
  );
}
