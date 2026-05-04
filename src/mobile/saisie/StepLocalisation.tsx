import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';

type Espace = { id: string; nom: string };
type Zone = { id: string; nom: string };

const ZONE_ICONS: Record<string, string> = {
  'entrée': '🚪',
  'bar': '🍸',
  'extérieur': '📍',
  'vestiaire': '👕',
  'piste': '🎵',
  'sanitaires': '🚻',
  'vip': '👑',
  'autre': '📍',
};

function zoneIcon(nom: string): string {
  return ZONE_ICONS[nom.toLowerCase()] ?? '📍';
}

export default function StepLocalisation() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();

  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loadingEspaces, setLoadingEspaces] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);

  useEffect(() => {
    supabase.from('espaces').select('id, nom').order('nom').then(({ data }) => {
      setEspaces(data ?? []);
      setLoadingEspaces(false);
    });
  }, []);

  useEffect(() => {
    if (!draft.espace) { setZones([]); return; }
    setLoadingZones(true);
    supabase
      .from('zones')
      .select('id, nom')
      .eq('espace_id', draft.espace.id)
      .eq('categorie', type)
      .order('nom')
      .then(({ data }) => {
        setZones(data ?? []);
        setLoadingZones(false);
      });
  }, [draft.espace, type]);

  if (!type) return <Navigate to="/mobile" replace />;

  const canContinue = !!draft.espace && !!draft.zone;

  function pickEspace(id: string, nom: string) {
    setField('espace', { id, label: nom });
    setField('zone', null);
  }

  function pickZone(id: string, nom: string) {
    setField('zone', { id, label: nom });
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-800">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: '25%' }} />
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/mobile')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-[17px] leading-tight">Sécurité des Personnes</p>
            <p className="text-slate-400 text-[13px]">Étape 1 sur 4</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/mobile')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-32 space-y-6">
        {/* Title block */}
        <div>
          <h1 className="text-white font-bold text-2xl leading-tight">Localisation</h1>
          <p className="text-slate-400 text-[14px] mt-1">Où se passe l'incident ?</p>
        </div>

        {/* Espace */}
        <div>
          <p className="text-slate-400 text-[13px] mb-3">Espace</p>
          {loadingEspaces && <p className="text-slate-500 text-sm text-center py-4">Chargement…</p>}
          {!loadingEspaces && espaces.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucun espace configuré.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {espaces.map((e) => {
              const selected = draft.espace?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => pickEspace(e.id, e.nom)}
                  className={`py-5 px-3 rounded-2xl border font-bold text-[15px] text-center transition-all active:scale-[0.97]
                    ${selected
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                      : 'bg-[#1c2333] border-slate-700 text-white hover:border-slate-600'
                    }`}
                >
                  {e.nom}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone — toujours visible, grisé si pas d'espace */}
        <div>
          <p className="text-slate-400 text-[13px] mb-3">Zone</p>
          {draft.espace && loadingZones && (
            <p className="text-slate-500 text-sm text-center py-4">Chargement…</p>
          )}
          {!draft.espace && (
            <p className="text-slate-600 text-sm text-center py-4">Sélectionnez d'abord un espace</p>
          )}
          {draft.espace && !loadingZones && zones.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucune zone dans cet espace.</p>
          )}
          {draft.espace && !loadingZones && zones.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {zones.map((z) => {
                const selected = draft.zone?.id === z.id;
                const icon = zoneIcon(z.nom);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => pickZone(z.id, z.nom)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-2xl border font-semibold text-[14px] text-left transition-all active:scale-[0.97]
                      ${selected
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                        : 'bg-[#1c2333] border-slate-700 text-white hover:border-slate-600'
                      }`}
                  >
                    <span className="text-sky-400 text-lg leading-none">{icon}</span>
                    <span>{z.nom}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky continue */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent z-20">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => canContinue && navigate(`/mobile/saisie/${type}/description`)}
            className={`w-full py-4 rounded-2xl font-bold text-[16px] transition-all
              ${canContinue
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-[#1e3a5f] text-slate-400 cursor-not-allowed'
              }`}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
