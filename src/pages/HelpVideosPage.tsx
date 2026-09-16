import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, X, Clapperboard, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type HelpVideo = {
  id: string;
  page_key: string;
  video_id: string;
  titre: string | null;
  created_at: string;
  updated_at: string;
};

export default function HelpVideosPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<HelpVideo | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ page_key: '', video_id: '', titre: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('help_videos')
      .select('*')
      .order('page_key');
    if (err) {
      setError(err.message);
    } else {
      setVideos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  function openCreate() {
    setForm({ page_key: '', video_id: '', titre: '' });
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(v: HelpVideo) {
    setForm({ page_key: v.page_key, video_id: v.video_id, titre: v.titre ?? '' });
    setEditing(v);
    setCreating(false);
    setError(null);
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  async function handleSave() {
    if (!form.page_key.trim() || !form.video_id.trim()) {
      setError('La clé de page et l\'ID vidéo sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);

    if (editing) {
      const { error: err } = await supabase
        .from('help_videos')
        .update({
          page_key: form.page_key.trim(),
          video_id: form.video_id.trim(),
          titre: form.titre.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase
        .from('help_videos')
        .insert({
          page_key: form.page_key.trim(),
          video_id: form.video_id.trim(),
          titre: form.titre.trim() || null,
        });
      if (err) setError(err.message);
    }

    setSaving(false);
    if (!error) {
      closeModal();
      fetchVideos();
    }
  }

  async function handleDelete(v: HelpVideo) {
    if (!confirm(`Supprimer la vidéo pour « ${v.page_key} » ?`)) return;
    const { error: err } = await supabase.from('help_videos').delete().eq('id', v.id);
    if (err) {
      setError(err.message);
    } else {
      fetchVideos();
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AppHeader onSignOut={async () => { await supabase.auth.signOut(); navigate('/'); }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/clients')}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white text-2xl font-bold">Vidéos d'aide</h1>
              <p className="text-slate-500 text-sm">Gestion des vidéos Loom par page</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-amber-400 animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <Clapperboard className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucune vidéo d'aide configurée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Clapperboard className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm">{v.page_key}</span>
                    {v.titre && (
                      <span className="text-slate-500 text-xs">— {v.titre}</span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs font-mono truncate">{v.video_id}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(v)}
                    className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-bold text-lg">
                {editing ? 'Modifier la vidéo' : 'Nouvelle vidéo'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Clé de page
                </label>
                <input
                  type="text"
                  value={form.page_key}
                  onChange={(e) => setForm({ ...form, page_key: e.target.value })}
                  placeholder="ex: toolbox, postes, inscription"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <p className="text-slate-600 text-[11px] mt-1">
                  Identifiant unique de la page/section où la vidéo apparaît.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  ID vidéo Loom
                </label>
                <input
                  type="text"
                  value={form.video_id}
                  onChange={(e) => setForm({ ...form, video_id: e.target.value })}
                  placeholder="ex: 7baa2bdc5f5c4bb0964f5595e79177c4"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                />
                <p className="text-slate-600 text-[11px] mt-1">
                  L'identifiant dans l'URL Loom (https://www.loom.com/embed/...).
                </p>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Titre (optionnel)
                </label>
                <input
                  type="text"
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  placeholder="Description pour référence admin"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
