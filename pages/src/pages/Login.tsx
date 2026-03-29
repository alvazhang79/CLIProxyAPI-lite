import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../lib/api';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await adminApi.login(token);
      if (res.ok && res.token) {
        localStorage.setItem('session_token', res.token);
        navigate('/');
      }
    } catch (err) {
      setError(t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="CLIProxyAPI Lite" className="h-12 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">{t('login.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="card">
          <h1 className="text-xl font-bold text-navy mb-6">{t('login.title')}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={t('login.token_placeholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent font-mono text-sm"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : t('login.btn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
