import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApiKeys from './pages/ApiKeys';
import Models from './pages/Models';
import Providers from './pages/Providers';
import Embeddings from './pages/Embeddings';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Navbar from './components/Navbar';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('session_token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path="/keys"
          element={<ProtectedRoute><ApiKeys /></ProtectedRoute>}
        />
        <Route
          path="/models"
          element={<ProtectedRoute><Models /></ProtectedRoute>}
        />
        <Route
          path="/providers"
          element={<ProtectedRoute><Providers /></ProtectedRoute>}
        />
        <Route
          path="/embeddings"
          element={<ProtectedRoute><Embeddings /></ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute><Settings /></ProtectedRoute>}
        />
        <Route
          path="/logs"
          element={<ProtectedRoute><Logs /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
