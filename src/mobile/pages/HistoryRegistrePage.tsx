import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EmptyState from '../components/EmptyState';

type RegistreHistoriqueEntry = {
  id: string;
  registre_id: string;
  date_verification: string;
  nom_verificateur: string;
  rapport_url: string;
  observations: string;
  observations_levees: string;
  created_at: string;
  registre_securite?: { installation: string };
};

export default function HistoryRegistrePage() {
  const navigate = useNavigate();
  const [registreHistory, setRegistreHistory] = useState<RegistreHistoriqueEntry[]>([]);
  const [registreLoading, setRegistreLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setRegistreLoading(true);
      const { data } = await supabase
        .from('registre_historique')
        .select('*, registre_securite(installation)')
        .order('date_verification', { ascending: false })
        .limit(100);
      setRegistreHistory((data ?? []) as RegistreHistoriqueEntry[]);
      setRegistreLoading(false);
    })();
  }, []);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/mobile/historique')} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Registre</p>
          <p className="text-slate-500 text-xs">Historique des vérifications</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {registreLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!registreLoading && registreHistory.length === 0 && <EmptyState text="Aucun historique de registre" hint="Les vérifications archivées apparaîtront ici" />}
        {!registreLoading && registreHistory.map((entry) => (
          <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-snug">{entry.registre_securite?.installation ?? '—'}</p>
                <p className="text-slate-500 text-xs mt-0.5">{new Date(entry.date_verification + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </div>
              {entry.rapport_url && (
                <a href={entry.rapport_url} target="_blank" rel="noreferrer" className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg"><FileText className="w-3 h-3" />Voir</a>
              )}
            </div>
            {entry.nom_verificateur && <p className="text-slate-400 text-xs">Vérificateur : <span className="text-slate-300">{entry.nom_verificateur}</span></p>}
            {entry.observations && <p className="text-slate-400 text-xs">Observations : <span className="text-slate-300">{entry.observations}</span></p>}
            {entry.observations_levees && <p className="text-xs text-emerald-400">Levée : {entry.observations_levees}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
