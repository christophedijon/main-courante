import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EmptyState from '../components/EmptyState';

type IaRecord = {
  id: string;
  question: string;
  sections: { title: string; content: string }[];
  created_at: string;
  agent_nom: string;
};

function IaRecordSections({ sections }: { sections: { title: string; content: string }[] }) {
  const [open, setOpen] = useState(false);
  const COLORS = ['text-blue-400', 'text-red-400', 'text-amber-400', 'text-cyan-400'];
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-slate-400 text-xs font-semibold py-1">
        <span>Voir la réponse IA ({sections.length} sections)</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 mt-2">
          {sections.map((s, i) => (
            <div key={i} className="bg-slate-950 rounded-xl p-3">
              <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${COLORS[i % COLORS.length]}`}>{i + 1}. {s.title}</p>
              <p className="text-slate-400 text-[12px] leading-relaxed whitespace-pre-line">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryIaPage() {
  const navigate = useNavigate();
  const [iaHistory, setIaHistory] = useState<IaRecord[]>([]);
  const [iaLoading, setIaLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setIaLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIaLoading(false); return; }
      const { data } = await supabase
        .from('ia_historique')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setIaHistory((data ?? []) as IaRecord[]);
      setIaLoading(false);
    })();
  }, []);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/mobile/historique')} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Historique IA</p>
          <p className="text-slate-500 text-xs">Conversations avec l'assistant</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {iaLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!iaLoading && iaHistory.length === 0 && <EmptyState text="Aucune consultation IA" hint="Vos questions à l'assistant apparaîtront ici" />}
        {!iaLoading && iaHistory.map((record) => (
          <div key={record.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">{new Date(record.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg">IA</span>
            </div>
            <div className="bg-slate-950 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Question</p>
              <p className="text-slate-300 text-sm leading-relaxed">{record.question}</p>
            </div>
            <IaRecordSections sections={record.sections} />
          </div>
        ))}
      </div>
    </div>
  );
}
