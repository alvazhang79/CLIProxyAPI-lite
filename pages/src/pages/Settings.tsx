import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type Settings } from '../lib/api';
import { setLanguage } from '../i18n';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Token change
  const [currentToken, setCurrentToken] = useState('');
  const [newToken, setNewToken] = useState('');
  const [tokenMsg, setTokenMsg] = useState('');

  useEffect(() => {
    adminApi.getSettings()
      .then(s => setSettings(s))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setError('');
    setSaved(false);
    try {
      await adminApi.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleChangeToken = async () => {
    setTokenMsg('');
    if (!currentToken || !newToken) return;
    if (newToken.length < 8) { setTokenMsg('Token must be at least 8 characters'); return; }
    try {
      // Verify current token first
      await fetch(import.meta.env.VITE_WORKERS_API_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: currentToken }),
      }).then(r => r.json()).then(async (res) => {
        if (!res.ok) { setTokenMsg('Current token is incorrect'); return; }
        // Update token via a dedicated endpoint
        await fetch(import.meta.env.VITE_WORKERS_API_URL + '/api/admin/settings', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('session_token'),
          },
          body: JSON.stringify({ admin_token: newToken }),
        });
        setTokenMsg('✅ Token updated! Save settings to apply.');
        setCurrentToken('');
        setNewToken('');
      });
    } catch {
      setTokenMsg('Failed to update token');
    }
  };

  const currentLang = i18n.language as 'en' | 'zh';

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy mb-6">{t('settings.title')}</h1>

      {/* Language */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{t('settings.lang')}</h2>
        <div className="flex gap-3">
          <button
            onClick={() => { setLanguage('en'); setSettings({ ...settings, language: 'en' }); }}
            className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
              currentLang === 'en' ? 'bg-coral text-white border-coral' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            🇺🇸  {t('settings.lang_en')}
          </button>
          <button
            onClick={() => { setLanguage('zh'); setSettings({ ...settings, language: 'zh' }); }}
            className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
              currentLang === 'zh' ? 'bg-coral text-white border-coral' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            🇨🇳  {t('settings.lang_zh')}
          </button>
        </div>
      </div>

      {/* Default Rate Limit */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Defaults</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.default_rate_limit')}</label>
          <input
            type="number"
            value={settings.default_rate_limit ?? 60}
            onChange={e => setSettings({ ...settings, default_rate_limit: parseInt(e.target.value) || 60 })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral"
            min={1}
          />
        </div>
      </div>

      {/* Admin Token Change */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">🔐 Admin Token</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current Token</label>
            <input
              type={showToken ? 'text' : 'password'}
              value={currentToken}
              onChange={e => setCurrentToken(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm"
              placeholder="Enter current admin token"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">New Token</label>
            <input
              type={showToken ? 'text' : 'password'}
              value={newToken}
              onChange={e => setNewToken(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral font-mono text-sm"
              placeholder="Enter new token (min 8 chars)"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input type="checkbox" checked={showToken} onChange={e => setShowToken(e.target.checked)} className="rounded" />
              Show passwords
            </label>
          </div>
          <button onClick={handleChangeToken} className="btn-secondary text-sm">
            Update Token
          </button>
          {tokenMsg && (
            <p className={`text-sm ${tokenMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{tokenMsg}</p>
          )}
          <p className="text-xs text-gray-400">
            ⚠️ After changing the token, update your <code className="bg-gray-100 px-1 rounded">ADMIN_TOKEN</code> secret in Workers via <code className="bg-gray-100 px-1 rounded">wrangler secret put ADMIN_TOKEN</code>
          </p>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</div>}
      {saved && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg mb-4">✅ {t('settings.saved')}</div>}

      <button onClick={handleSave} className="btn-primary w-full">
        {t('settings.save')}
      </button>
    </div>
  );
}
