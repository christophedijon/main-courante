import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, Building2, MapPin, Layers, Flame, Users,
  FileText, User as UserIcon, Tag, Hash, Paperclip, Image, Music, Video,
  X, Upload, Loader2, Play, Pause, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type EventDetail = {
  id: string;
  numero: string;
  type: 'ssi' | 'securite_personnes';
  espace_nom: string;
  zone_nom: string;
  niveau_label: string;
  commentaire: string;
  date_evenement: string;
  created_by_email: string;
  user_fonction: string;
  etablissement_nom: string;
  created_by: string;
};

type Media = {
  id: string;
  storage_path: string;
  mime_type: string;
  original_name: string;
  created_at: string;
  url?: string;
};

const ACCEPT = 'image/*,audio/*,video/*';

function mediaIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (mime.startsWith('audio/')) return <Music className="w-4 h-4" />;
  if (mime.startsWith('video/')) return <Video className="w-4 h-4" />;
  return <Paperclip className="w-4 h-4" />;
}

function MediaItem({ media, onDelete, canDelete }: { media: Media; onDelete: () => void; canDelete: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isImage = media.mime_type.startsWith('image/');
  const isAudio = media.mime_type.startsWith('audio/');
  const isVideo = media.mime_type.startsWith('video/');

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
      {isImage && media.url && (
        <img src={media.url} alt={media.original_name}
          className="w-full h-32 object-cover" />
      )}
      {isAudio && (
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center shrink-0">
            {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-medium truncate">{media.original_name}</p>
            <p className="text-slate-500 text-[11px]">Audio</p>
          </div>
          <audio ref={audioRef} src={media.url} onEnded={() => setPlaying(false)} />
        </div>
      )}
      {isVideo && (
        <video src={media.url} controls className="w-full max-h-48 object-cover" />
      )}
      {!isImage && !isAudio && !isVideo && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-slate-400">
            <Paperclip className="w-4 h-4" />
          </div>
          <p className="text-white text-[13px] font-medium truncate flex-1">{media.original_name}</p>
        </div>
      )}
      {/* Label overlay for images */}
      {isImage && (
        <div className="px-3 py-1.5 bg-slate-900/80 flex items-center gap-2">
          <Image className="w-3 h-3 text-slate-400" />
          <p className="text-slate-300 text-[11px] truncate flex-1">{media.original_name}</p>
        </div>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [motifs, setMotifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [medias, setMedias] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [evRes, motifsRes, mediasRes] = await Promise.all([
        supabase.from('evenements').select('*').eq('id', id).maybeSingle(),
        supabase.from('evenement_motifs').select('motif_nom').eq('evenement_id', id),
        supabase.from('evenement_medias').select('*').eq('evenement_id', id).order('created_at'),
      ]);
      setEvent(evRes.data as EventDetail | null);
      setMotifs((motifsRes.data ?? []).map((m) => m.motif_nom).filter(Boolean));

      const rawMedias: Media[] = (mediasRes.data ?? []) as Media[];
      const withUrls = rawMedias.map((m) => {
        const { data } = supabase.storage.from('media-evenements').getPublicUrl(m.storage_path);
        return { ...m, url: data.publicUrl };
      });
      setMedias(withUrls);
      setLoading(false);
    })();
  }, [id]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id || !session?.user) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/${id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('media-evenements')
      .upload(path, file, { contentType: file.type });

    if (upErr) { setUploading(false); return; }

    const { error: dbErr, data: inserted } = await supabase
      .from('evenement_medias')
      .insert({
        evenement_id: id,
        storage_path: path,
        mime_type: file.type,
        original_name: file.name,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (!dbErr && inserted) {
      const { data } = supabase.storage.from('media-evenements').getPublicUrl(path);
      setMedias((prev) => [...prev, { ...(inserted as Media), url: data.publicUrl }]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deleteMedia(media: Media) {
    await supabase.storage.from('media-evenements').remove([media.storage_path]);
    await supabase.from('evenement_medias').delete().eq('id', media.id);
    setMedias((prev) => prev.filter((m) => m.id !== media.id));
  }

  if (loading) {
    return <p className="text-center text-slate-500 text-sm py-10">Chargement…</p>;
  }
  if (!event) {
    return (
      <div className="px-5 py-10">
        <p className="text-slate-400 text-center">Événement introuvable.</p>
        <button
          onClick={() => navigate('/mobile/historique')}
          className="mt-4 mx-auto block text-blue-400 text-sm font-semibold"
        >
          Retour à l'historique
        </button>
      </div>
    );
  }

  const d = new Date(event.date_evenement);
  const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const ssi = event.type === 'ssi';
  const isOwner = session?.user?.id === event.created_by;

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] truncate">Événement</p>
          <p className="text-slate-500 text-xs">#{event.numero}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Type banner */}
        <div className={`rounded-2xl p-4 border-2 flex items-center gap-3
          ${ssi ? 'bg-red-950/40 border-red-700/60' : 'bg-sky-950/40 border-sky-700/60'}`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center
            ${ssi ? 'bg-red-600' : 'bg-sky-500/30 border border-sky-500/40'}`}>
            {ssi
              ? <Flame className="w-5 h-5 text-amber-300" strokeWidth={2.4} />
              : <Users className="w-5 h-5 text-sky-300" strokeWidth={2.4} />}
          </div>
          <div>
            <p className="text-white font-bold text-[15px]">
              {ssi ? 'SSI – Sécurité Incendie' : 'Personnes – Sécurité des personnes'}
            </p>
            <p className="text-slate-400 text-xs">Type d'événement</p>
          </div>
        </div>

        {/* Detail rows */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/40 transition-colors"
          >
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Détails</span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${detailOpen ? 'rotate-180' : ''}`} />
          </button>
          {detailOpen && (
            <div className="px-4 divide-y divide-slate-800 border-t border-slate-800">
              <Row icon={Hash} label="Numéro" value={event.numero} />
              <Row icon={Calendar} label="Date" value={dateStr} />
              <Row icon={Clock} label="Heure" value={timeStr} />
              <Row icon={UserIcon} label="Utilisateur" value={`${event.created_by_email}${event.user_fonction ? ` · ${event.user_fonction}` : ''}`} />
              <Row icon={Building2} label="Établissement" value={event.etablissement_nom || '—'} />
              {!ssi && <Row icon={MapPin} label="Espace" value={event.espace_nom || '—'} />}
              <Row icon={MapPin} label="Zone" value={event.zone_nom || '—'} />
              {!ssi && <Row icon={Layers} label="Niveau" value={event.niveau_label || '—'} valueClass="text-amber-300" />}
              <Row icon={Tag} label="Motifs" value={motifs.join(', ') || '—'} />
              <Row icon={FileText} label="Commentaire" value={event.commentaire || '—'} />
            </div>
          )}
        </div>

        {/* Médias section */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <button
              type="button"
              onClick={() => setMediaOpen((v) => !v)}
              className="flex items-center gap-2 flex-1"
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Médias ({medias.length})
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${mediaOpen ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500
                disabled:bg-slate-700 disabled:text-slate-500 text-white text-[12px] font-semibold transition-colors ml-2"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Upload…' : 'Importer'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {mediaOpen && (
            <div className="px-4 pb-4 border-t border-slate-800">
              {medias.length === 0 ? (
                <div className="border border-slate-700 border-dashed rounded-xl px-4 py-8 text-center mt-3">
                  <Paperclip className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Aucun média joint</p>
                  <p className="text-slate-600 text-xs mt-0.5">Photo, audio ou vidéo</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {medias.map((m) => (
                    <MediaItem
                      key={m.id}
                      media={m}
                      canDelete={isOwner}
                      onDelete={() => deleteMedia(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, valueClass = 'text-white' }:
  { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-[14px] font-medium leading-snug break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
