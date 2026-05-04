import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSaisie } from './SaisieContext';

type ZoneRow = { id: string; nom: string; description: string | null; espace_nom: string };

export default function StepSsiZone() {
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('zones')
      .select('id, nom, description, espace_id, espaces(nom)')
      .eq('categorie', 'ssi')
      .order('nom')
      .then(({ data }) => {
        const rows: ZoneRow[] = (data ?? []).map((z: any) => ({
          id: z.id,
          nom: z.nom,
          description: z.description,
          espace_nom: z.espaces?.nom ?? '',
        }));
        setZones(rows);
        setLoading(false);
      });
  }, []);


  function pick(id: string, nom: string) {
    setField('zone', { id, label: nom });
    navigate('/mobile/saisie/ssi/ssi-motifs');
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-800">
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: '33%' }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/mobile')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M5 12L12 19M5 12L12 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-[17px] leading-tight">SSI – Sécurité Incendie</p>
            <p className="text-slate-400 text-[13px]">Étape 1 sur 3</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-900/60 border border-red-800/50 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                fill="url(#flamSsiZone)" />
              <defs>
                <linearGradient id="flamSsiZone" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="60%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-10">
        <h1 className="text-white font-bold text-2xl leading-tight">Zone SSI</h1>
        <p className="text-slate-400 text-[14px] mt-1 mb-6">Sélectionnez la zone concernée</p>

        {loading && <p className="text-slate-500 text-sm text-center py-12">Chargement…</p>}

        {!loading && zones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center">
              <Flame className="w-7 h-7 text-red-700" />
            </div>
            <p className="text-slate-400 font-medium">Aucune zone SSI configurée</p>
            <p className="text-slate-600 text-sm">Ajoutez des zones SSI dans le back-office.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {zones.map((z) => {
            const selected = draft.zone?.id === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => pick(z.id, z.nom)}
                className={`w-full text-left px-4 py-4 rounded-2xl border font-semibold text-[15px] transition-all active:scale-[0.98]
                  ${selected
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-200'
                    : 'bg-[#1c2333] border-slate-700 text-white hover:border-orange-800/60 hover:bg-orange-950/20'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                    ${selected ? 'bg-orange-500/30' : 'bg-red-950/50 border border-red-900/40'}`}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                        fill="url(#flamTileGrad)" />
                      <defs>
                        <linearGradient id="flamTileGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="60%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-[15px] ${selected ? 'text-amber-300' : 'text-white'}`}>{z.nom}</p>
                    {z.espace_nom && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{z.espace_nom || ''}
                      </p>
                    )}
                    {z.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{z.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
