import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, Plus, RefreshCw, Trash2, 
  Search, Clock, User, LogOut, AlertCircle, 
  CheckCircle2, ExternalLink 
} from 'lucide-react';
import { documentApi } from '../api/axiosConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const ownerId = localStorage.getItem('ownerId') || '1';
  const ownerUsername = localStorage.getItem('ownerUsername') || `User #${ownerId}`;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await documentApi.getAll();
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Could not connect to backend at http://localhost:8080/api. Make sure Spring Boot is running.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    try {
      setCreating(true);
      const res = await documentApi.create(title, Number(ownerId));
      setNewTitle('');
      setSuccessMsg(`Document "${title}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      navigate(`/editor/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create document.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, id, title) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm(`Are you sure you want to delete "${title || 'Untitled Document'}"?`)) {
      return;
    }

    try {
      setDeletingId(id);
      await documentApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSuccessMsg(`Document deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('ownerId');
    localStorage.removeItem('ownerUsername');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const matchTitle = (doc.title || '').toLowerCase().includes(q);
    const matchOwner = (doc.ownerUsername || '').toLowerCase().includes(q);
    return matchTitle || matchOwner;
  });

  return (
    <div className="min-h-screen bg-[#e6f7f2] flex flex-col text-slate-800">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-teal-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-md shadow-teal-600/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                Collab<span className="text-teal-600">Editor</span>
              </span>
              <span className="ml-2.5 px-2 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-md">
                Live Docs
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                {ownerId}
              </div>
              <span className="text-slate-700 font-semibold hidden sm:inline">{ownerUsername}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-rose-800 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Notice</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchDocuments}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2.5 text-teal-800 text-sm">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <section className="bg-white border border-teal-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-medium text-teal-800 mb-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                Live Collaboration Workspace
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
                Collaborative Documents
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Create, write, and collaborate on shared documents in real-time with team permissions and autosave.
              </p>
            </div>

            <form onSubmit={handleCreateDocument} className="w-full md:w-auto md:min-w-[380px] flex flex-col gap-2">
              <label htmlFor="documentTitle" className="text-xs font-semibold text-slate-700">
                Create New Document
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="documentTitle"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Project Plan, Meeting Notes..."
                  disabled={creating}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition"
                />
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                Created with Owner: {ownerUsername} (ID #{ownerId})
              </span>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by title or owner..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition shadow-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-slate-500 font-medium">
                {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
              </span>
              <button
                onClick={fetchDocuments}
                disabled={loading}
                className="p-2 text-slate-600 hover:text-teal-700 hover:bg-white rounded-xl border border-slate-200/80 transition flex items-center gap-1 text-xs cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {loading && documents.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-white/70 border border-slate-200/60 animate-pulse p-5" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-teal-100 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-700">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No documents found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No documents match "${searchQuery}". Clear your search query to see all docs.`
                  : 'Start collaborating by creating your first document above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDocs.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/editor/${doc.id}`}
                  className="group relative flex flex-col justify-between bg-white border border-slate-200/80 hover:border-teal-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition line-clamp-1">
                        {doc.title || 'Untitled Document'}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, doc.id, doc.title)}
                          disabled={deletingId === doc.id}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="h-16 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 overflow-hidden select-none font-mono leading-relaxed line-clamp-3">
                      {doc.content ? doc.content : <span className="text-slate-400 italic">Empty document</span>}
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{doc.ownerUsername || `Owner #${doc.ownerId || 1}`}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold text-[11px] border border-teal-200/60">
                        v{doc.currentRevision ?? 0}
                      </span>
                      <span className="text-teal-700 group-hover:translate-x-0.5 transition-transform font-medium flex items-center gap-0.5">
                        Open <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
