import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import StepHeader from '../components/StepHeader';
import SelectableTile from '../components/SelectableTile';

const ACCENTS = ['sky', 'blue', 'amber', 'red', 'red'] as const;

export default function StepNiveau() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const { id: etabFromHook } = useEntreprise();
  const etablissementId = draft.etablissement?.id ?? etabFromHook;
  const [items, setItems] = useState<{ id: string; label: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!etablissementId) return;
    supabase
      .from('niveaux_intervention')
      .select('id, label, description, ordre')
      .eq('etablissement_id', etablissementId)
      .order('ordre', { ascending: true })
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [etablissementId]);

  if (!type) return <Navigate to="/mobile" replace />;
  if (!draft.zone) return <Navigate to={`/mobile/saisie/${type}/zone`} replace />;

  function pickItem(id: string, label: string) {
    setField('niveau', { id, label });
    navigate(`/mobile/saisie/${type}/motifs`);
  }

  return (
    <div>
      <StepHeader
        step={4} total={7}
        title="Niveau / Graduation"
        subtitle={draft.zone.label}
        backTo={`/mobile/saisie/${type}/zone`}
      />
      <div className="px-4 py-5 space-y-2.5">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Aucun niveau configuré.</p>
        )}
        {items.map((n, i) => (
          <SelectableTile
            key={n.id}
            label={n.label || `Niveau ${i + 1}`}
            description={n.description || undefined}
            selected={draft.niveau?.id === n.id}
            accent={ACCENTS[Math.min(i, ACCENTS.length - 1)]}
            onClick={() => pickItem(n.id, n.label || `Niveau ${i + 1}`)}
          />
        ))}
      </div>
    </div>
  );
}
