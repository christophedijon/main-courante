import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, ChevronDown, ChevronUp as ChevronUpIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EmptyState from '../components/EmptyState';

type Rapport = {
  id: string;
  date_soiree: string;
  debut_soiree: string;
  fin_soiree: string;
  nb_evenements: number;
  nb_agents: number;
  contenu_html: string | null;
  created_at: string;
};

export default function HistoryRapportsPage() {
  const navigate = useNavigate();
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [rapportsLoading, setRapportsLoading] = useState(false);
  const [openRapportId, setOpenRapportId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setRapportsLoading(true);
      const { data } = await supabase
        .from('rapports_soiree')
        .select('id, date_soiree, debut_soiree, fin_soiree, nb_evenements, nb_agents, contenu_html, created_at')
        .order('date_soiree', { ascending: false })
        .limit(30);
      setRapports((data ?? []) as Rapport[]);
      setRapportsLoading(false);
    })();
  }, []);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/mobile/historique')} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Rapports</p>
          <p className="text-slate-500 text-xs">Rapports de soirée</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {rapportsLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!rapportsLoading && rapports.length === 0 && <EmptyState text="Aucun rapport disponible" hint="Les rapports sont générés automatiquement chaque matin à 8h00" />}
        {!rapportsLoading && rapports.map((rapport) => {
          const isOpen = openRapportId === rapport.id;
          const dateSoiree = new Date(rapport.date_soiree + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
          const heureDebut = new Date(rapport.debut_soiree).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const heureFin = new Date(rapport.fin_soiree).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={rapport.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button type="button" onClick={() => setOpenRapportId(isOpen ? null : rapport.id)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-slate-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-[14px] capitalize truncate">{dateSoiree}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{heureDebut} → {heureFin}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right"><p className="text-white font-bold text-base leading-none">{rapport.nb_evenements}</p><p className="text-slate-500 text-[10px] mt-0.5">évén.</p></div>
                  <div className="text-right"><p className="text-emerald-400 font-bold text-base leading-none">{rapport.nb_agents}</p><p className="text-slate-500 text-[10px] mt-0.5">agents</p></div>
                  {isOpen ? <ChevronUpIcon className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>
              {isOpen && rapport.contenu_html && (
                <div className="border-t border-slate-800 overflow-auto bg-white rounded-b-2xl" style={{ maxHeight: '75vh' }} dangerouslySetInnerHTML={{ __html: rapport.contenu_html }} />
              )}
              {isOpen && !rapport.contenu_html && (
                <div className="border-t border-slate-800 px-4 py-4 flex items-center gap-3 text-slate-500"><FileText className="w-4 h-4 shrink-0" /><span className="text-sm">Aucun contenu disponible.</span></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
