import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, FileText, User, 
  Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2,
  Users, Copy, Shield, Eye, UserPlus, Trash2, Check, Lock
} from 'lucide-react';
import axios from 'axios';
import { documentApi } from '../api/axiosConfig';
import { useDocumentCollaboration } from '../hooks/useDocumentCollaboration';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [currentUserId] = useState(() => localStorage.getItem('ownerId') || '1');
  const [currentUsername] = useState(() => localStorage.getItem('ownerUsername') || 'developer_nishant');
  const [userRole, setUserRole] = useState(null);

  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remoteEditNotice, setRemoteEditNotice] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('EDITOR');
  const [statusMessage, setStatusMessage] = useState(null);

  const textareaRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const handleRemoteContentSync = useCallback((newContent) => {
    const textarea = textareaRef.current;
    let prevCursorStart = null;
    let prevCursorEnd = null;
    if (textarea && window.document.activeElement === textarea) {
      prevCursorStart = textarea.selectionStart;
      prevCursorEnd = textarea.selectionEnd;
    }

    setContent(newContent ?? '');

    if (textarea && prevCursorStart !== null) {
      requestAnimationFrame(() => {
        try {
          textarea.setSelectionRange(prevCursorStart, prevCursorEnd);
        } catch (_) {}
      });
    }

    setRemoteEditNotice({ time: new Date().toLocaleTimeString() });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setRemoteEditNotice(null), 3000);
  }, []);

  const {
    isConnected,
    isConnecting,
    currentRevision,
    syncStatus,
    submitLocalEdit,
    updateLocalContentRef,
    updateCursorPresence,
    reconnect,
    activeCollaborators
  } = useDocumentCollaboration({
    documentId: id,
    currentUserId,
    username: currentUsername,
    initialRevision: document?.currentRevision || 0,
    initialContent: content,
    onRemoteContentSync: handleRemoteContentSync
  });

  const loadMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/documents/${id}/members`);
      setMembers(res.data);
      const found = res.data.find((m) => Number(m.userId) === Number(currentUserId));
      if (found) {
        setUserRole(found.role);
      } else {
        setUserRole('NONE');
      }
    } catch (_) {
      setUserRole('NONE');
    }
  }, [id, currentUserId]);

  const loadAllUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/auth/users`);
      setAllUsers(res.data);
    } catch (_) {}
  };

  const loadDocument = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await documentApi.getById(id);
      const doc = res.data;
      setDocument(doc);
      const initialContent = doc.content ?? '';
      setContent(initialContent);
      updateLocalContentRef(initialContent);

      if (doc.ownerId && Number(doc.ownerId) === Number(currentUserId)) {
        setUserRole('OWNER');
      } else {
        await loadMembers();
      }
    } catch (err) {
      setError(
        err.response?.status === 404
          ? `Document with ID "${id}" was not found.`
          : 'Failed to load document from backend. Please verify your connection.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId, updateLocalContentRef, loadMembers]);

  useEffect(() => {
    loadDocument();
    loadAllUsers();
  }, [loadDocument]);

  const handleContentChange = (e) => {
    if (userRole === 'VIEWER' || userRole === 'BLOCKED' || userRole === 'NONE') return;

    const val = e.target.value;
    setContent(val);
    submitLocalEdit(val);

    if (textareaRef.current) {
      updateCursorPresence(textareaRef.current.selectionStart);
    }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const isNum = !isNaN(selectedUser);
      const payload = isNum 
        ? { userId: Number(selectedUser), role: selectedRole }
        : { username: selectedUser, role: selectedRole };

      await axios.post(`${API_BASE}/api/documents/${id}/members?ownerId=${currentUserId}`, payload);
      await loadMembers();
      setSelectedUser('');
      setStatusMessage(`Updated permission for user.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      alert('Failed to update permission: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleChangeMemberRole = async (userId, newRole) => {
    try {
      await axios.post(`${API_BASE}/api/documents/${id}/members?ownerId=${currentUserId}`, {
        userId: Number(userId),
        role: newRole
      });
      await loadMembers();
    } catch (err) {
      alert('Failed to change role: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await axios.delete(`${API_BASE}/api/documents/${id}/members/${userId}?ownerId=${currentUserId}`);
      await loadMembers();
    } catch (err) {
      alert('Failed to remove member: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const lines = content ? content.split('\n').length : 1;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#e6f7f2] flex flex-col items-center justify-center text-slate-700">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mb-4" />
        <p className="text-sm font-semibold">Loading document...</p>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-[#e6f7f2] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-teal-100 rounded-2xl p-6 text-center space-y-4 shadow-lg shadow-teal-900/5">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Document Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={loadDocument}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'BLOCKED') {
    return (
      <div className="min-h-screen bg-[#e6f7f2] flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 text-center space-y-4 shadow-xl shadow-rose-950/5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You have been blocked from viewing or editing this document by the document owner.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'NONE' && document?.ownerId && Number(document.ownerId) !== Number(currentUserId)) {
    return (
      <div className="min-h-screen bg-[#e6f7f2] flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="max-w-md w-full bg-white border border-teal-100 rounded-3xl p-8 text-center space-y-4 shadow-xl shadow-teal-950/5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Permission Required</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You do not currently have access to this document. Please contact the owner ({document?.ownerUsername || 'Document Owner'}) to grant you view or edit permissions.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e6f7f2] text-slate-800 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-teal-100 px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-slate-200"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate max-w-xs sm:max-w-md">
                  {document?.title || 'Untitled Document'}
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                  {id ? id.substring(0, 8) : ''}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>Owner: {document?.ownerUsername || `User #${document?.ownerId}`}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-teal-700">
                  <Shield className="w-3 h-3" />
                  {userRole === 'OWNER' ? 'Owner' : userRole === 'EDITOR' ? 'Can Edit' : 'Can View'}
                </span>
                <span>•</span>
                <span className="text-slate-600">Signed in as: <strong>{currentUsername}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              <span>v{currentRevision}</span>
            </div>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              syncStatus === 'SYNCED' 
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${syncStatus === 'SYNCED' ? 'bg-teal-600' : 'bg-amber-500 animate-ping'}`} />
              <span>{syncStatus === 'SYNCED' ? 'Synced' : 'Syncing'}</span>
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                isConnected
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : isConnecting
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  <span>Live</span>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-600" />
                  <button onClick={reconnect} className="underline cursor-pointer">
                    Reconnect
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>{1 + activeCollaborators.length} active</span>
            </div>

            {userRole === 'OWNER' && (
              <button
                onClick={() => { setShowMemberModal(true); loadMembers(); }}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-teal-600/20 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Share & Permissions</span>
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
            </button>
          </div>
        </div>
      </header>

      {userRole === 'VIEWER' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-center gap-2">
          <Eye className="w-4 h-4 text-amber-600" />
          <span>
            <strong>View-Only Mode:</strong> You can read live updates in real-time. Only the document owner can grant editing permission.
          </span>
        </div>
      )}

      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col">
        <div className="flex-1 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden min-h-[550px]">
          {activeCollaborators.length > 0 && (
            <div className="px-6 py-2.5 bg-teal-50/50 border-b border-teal-100 flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">Currently Active:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeCollaborators.map((user, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100/80 text-teal-800 border border-teal-200 font-semibold text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                    {user}
                  </span>
                ))}
              </div>
            </div>
          )}

          {remoteEditNotice && (
            <div className="px-6 py-2 bg-teal-50 border-b border-teal-200/60 text-xs text-teal-800 flex items-center justify-between">
              <span>Updated in real-time at <strong>{remoteEditNotice.time}</strong></span>
              <span className="text-[11px] font-semibold text-teal-700">Autosaved</span>
            </div>
          )}

          <div className="flex-1 p-6 sm:p-8 flex flex-col">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              readOnly={userRole === 'VIEWER'}
              placeholder={userRole === 'VIEWER' ? 'You have view-only access to this document.' : 'Type to collaborate in real-time...'}
              className="w-full flex-1 bg-transparent border-0 outline-none resize-none font-mono text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:ring-0"
              spellCheck="false"
            />

            <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
              <div className="flex items-center gap-4">
                <span>{lines} {lines === 1 ? 'line' : 'lines'}</span>
                <span>•</span>
                <span>{words} {words === 1 ? 'word' : 'words'}</span>
                <span>•</span>
                <span>{chars} characters</span>
              </div>
              <div className="text-teal-700 font-medium">
                All changes saved automatically
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-teal-100 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" /> Manage Document Permissions
              </h3>
              <button
                onClick={() => setShowMemberModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {statusMessage && (
              <div className="p-2.5 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-2.5">
                Who has access:
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {members.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{m.username || `User #${m.userId}`}</div>
                      <div className="text-[10px] text-slate-500">ID #{m.userId}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {m.role === 'OWNER' ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                          Owner
                        </span>
                      ) : (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => handleChangeMemberRole(m.userId, e.target.value)}
                            className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-teal-600"
                          >
                            <option value="EDITOR">Can Edit (Write)</option>
                            <option value="VIEWER">Can View (Read-Only)</option>
                            <option value="BLOCKED">Blocked</option>
                          </select>

                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            title="Remove access"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAssignRole} className="space-y-3 pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Allow Someone / Add Collaborator:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-semibold">User</label>
                  {allUsers.length > 0 ? (
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-teal-600 outline-none"
                    >
                      <option value="">Select a user...</option>
                      {allUsers
                        .filter((u) => Number(u.id) !== Number(document?.ownerId))
                        .map((u) => (
                          <option key={u.id} value={u.username}>
                            {u.username} (ID #{u.id})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Username or ID"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-teal-600 outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1 font-semibold">Permission</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-teal-600 outline-none"
                  >
                    <option value="EDITOR">Can Edit (Write)</option>
                    <option value="VIEWER">Can View (Read-Only)</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!selectedUser}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-teal-600/20"
              >
                Grant / Update Permission
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
