import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';

// Helper component to ensure an ownerId session is initialized
function ProtectedRoute({ children }) {
  const ownerId = localStorage.getItem('ownerId');
  if (!ownerId) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const hasSession = Boolean(localStorage.getItem('ownerId'));

  return (
    <Routes>
      {/* Root redirect */}
      <Route
        path="/"
        element={<Navigate to={hasSession ? "/dashboard" : "/login"} replace />}
      />

      {/* Mock Authentication Screen */}
      <Route path="/login" element={<Login />} />

      {/* Document Listing & Creation Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Single Document Plain Text Editor */}
      <Route
        path="/editor/:id"
        element={
          <ProtectedRoute>
            <Editor />
          </ProtectedRoute>
        }
      />

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
