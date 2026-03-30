import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Embedding } from '../lib/api';
import { formatTimestamp } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Embeddings() {
  const { t } = useTranslation();
  const [results, setResults] = useState<Embedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const load = (query = '') => {
    setLoading(true);
    adminApi.listEmbeddings({ q: query, limit: 100 })
      .then(res => setResults(res.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '确认删除',
      message: '确定要删除这个 Embedding 记录吗？',
      onConfirm: async () => {
        await adminApi.deleteEmbedding(id);
        load(q);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      danger: true,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">{t('embeddings.title')}</h1>

      <div className="mb-4">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(q)}
          placeholder={t('embeddings.search')}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
        />
      </div>

      {loading ? (
        <div className="text-gray-400">{t('common.loading')}</div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">{t('embeddings.no_data')}</div>
      ) : (
        <div className="space-y-3">
          {results.map(e => (
            <div key={e.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{e.text}</p>
                <div className="flex gap-2 mt-1">
                  <span className="badge text-xs bg-gray-100">{e.model}</span>
                  <span className="text-xs text-gray-400">{formatTimestamp(e.created_at)}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(e.id)} className="text-red-500 text-sm shrink-0 hover:underline">
                {t('common.delete')}
              </button>
            </div>
          ))}
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
