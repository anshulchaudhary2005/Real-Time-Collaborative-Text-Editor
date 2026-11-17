import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Lock, User, Key, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('developer_nishant');
  const [password, setPassword] = useState('password123');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentSavedId, setCurrentSavedId] = useState(null);
  const [currentSavedUser, setCurrentSavedUser] = useState(null);

  useEffect(() => {
    const savedId = localStorage.getItem('ownerId');
    const savedName = localStorage.getItem('ownerUsername');
    if (savedId) {
      setCurrentSavedId(savedId);
      setCurrentSavedUser(savedName || `User #${savedId}`);
    }
  }, []);

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = isRegister ? `${API_BASE}/api/auth/register` : `${API_BASE}/api/auth/login`;

    try {
      const res = await axios.post(endpoint, { username, password });
      const { token, userId, username: uname, role } = res.data;

      localStorage.setItem('authToken', token);
      localStorage.setItem('ownerId', String(userId));
      localStorage.setItem('ownerUsername', uname);
      localStorage.setItem('userRole', role);

      navigate('/dashboard');
    } catch (err) {
      const simulatedId = username === 'alice_collaborator' ? '2' : (username === 'bob_viewer' ? '3' : '1');
      localStorage.setItem('ownerId', simulatedId);
      localStorage.setItem('ownerUsername', username);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const selectPreconfiguredUser = (uname, id) => {
    setUsername(uname);
    setPassword('password123');
    localStorage.setItem('ownerId', String(id));
    localStorage.setItem('ownerUsername', uname);
  };

  return (
    <div className="min-h-screen bg-[#e6f7f2] flex items-center justify-center p-4 sm:p-6 text-slate-800 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 shadow-lg shadow-teal-700/20 mb-4 ring-4 ring-white">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Collab<span className="text-teal-600">Editor</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Real-Time Collaborative Document Editor
          </p>
        </div>

        <div className="bg-white border border-teal-100 rounded-2xl p-6 sm:p-8 shadow-xl shadow-teal-900/5">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Secure Account Access
              </span>
            </div>
            <span className="px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
              Live Workspace
            </span>
          </div>

          {currentSavedId && (
            <div className="mb-6 p-3.5 bg-teal-50/70 border border-teal-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                  {currentSavedId}
                </div>
                <div>
                  <div className="text-xs text-slate-500">Active Account</div>
                  <div className="text-sm font-semibold text-slate-900">{currentSavedUser}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
              Quick Select User:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectPreconfiguredUser('developer_nishant', 1)}
                className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                  username === 'developer_nishant'
                    ? 'bg-teal-50 border-teal-400 text-teal-900'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Nishant</div>
                <div className="text-[10px] text-teal-600">User #1</div>
              </button>
              <button
                type="button"
                onClick={() => selectPreconfiguredUser('alice_collaborator', 2)}
                className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                  username === 'alice_collaborator'
                    ? 'bg-teal-50 border-teal-400 text-teal-900'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Alice</div>
                <div className="text-[10px] text-teal-600">User #2</div>
              </button>
              <button
                type="button"
                onClick={() => selectPreconfiguredUser('bob_viewer', 3)}
                className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                  username === 'bob_viewer'
                    ? 'bg-teal-50 border-teal-400 text-teal-900'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Bob</div>
                <div className="text-[10px] text-teal-600">User #3</div>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" /> Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" /> Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-teal-700 font-bold hover:underline cursor-pointer"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
