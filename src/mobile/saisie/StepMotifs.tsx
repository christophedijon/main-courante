import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import StepHeader from '../components/StepHeader';
import SelectableTile from '../components/SelectableTile';

export default function StepMotifs() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const { id: etabFromHook } = useEntreprise();
  const etablissementId = draft.etablissement?.id ?? etabFromHook;
  const [items, setItems] = useState<{ id: string; nom: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!etablissementId) return;
    supabase.from('motifs').select('id, nom, description, ordre')
      .eq('etablissement_id', etablissementId)
      .order('ordre')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [etablissementId]);

  if (!type) return <Navigate to="/mobile" replace />;
  if (!draft.niveau) return <Navigate to={`/mobile/saisie/${type}/niveau`} replace />;

  function toggle(id: string, nom: string) {
    const exists = draft.motifs.some((m) => m.id === id);
    const next = exists
      ? draft.motifs.filter((m) => m.id !== id)
      : [...draft.motifs, { id, label: nom }];
    setField('motifs', next);
  }

  return (
    <div>
      <StepHeader
        step={5} total={7}
        title="Choisir les motifs"
        subtitle={`${draft.motifs.length} sélectionné${draft.motifs.length !== 1 ? 's' : ''}`}
        backTo={`/mobile/saisie/${type}/niveau`}
      />
      <div className="px-4 py-5 space-y-2.5 pb-32">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Aucun motif configuré.</p>
        )}
        {items.map((m) => (
          <SelectableTile
            key={m.id}
            label={m.nom || 'Sans titre'}
            description={m.description || undefined}
            multi
            selected={draft.motifs.some((s) => s.id === m.id)}
            onClick={() => toggle(m.id, m.nom)}
          />
        ))}
      </div>

      {/* Sticky Continue button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-6 pb-4 px-4 z-20">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            disabled={draft.motifs.length === 0}
            onClick={() => navigate(`/mobile/saisie/${type}/commentaire`)}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500
              text-white font-bold text-[15px] py-4 rounded-2xl transition-colors"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
