import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';
import StepHeader from '../components/StepHeader';
import SelectableTile from '../components/SelectableTile';

export default function StepZone() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const [items, setItems] = useState<{ id: string; nom: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draft.espace) return;
    supabase
      .from('zones')
      .select('id, nom, description, categorie')
      .eq('espace_id', draft.espace.id)
      .eq('categorie', type)
      .order('nom')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [draft.espace, type]);

  if (!type) return <Navigate to="/mobile" replace />;
  if (!draft.espace) return <Navigate to={`/mobile/saisie/${type}/espace`} replace />;

  function pickItem(id: string, nom: string) {
    setField('zone', { id, label: nom });
    navigate(`/mobile/saisie/${type}/niveau`);
  }

  return (
    <div>
      <StepHeader
        step={3} total={7}
        title="Choisir la zone"
        subtitle={draft.espace.label}
        backTo={`/mobile/saisie/${type}/espace`}
      />
      <div className="px-4 py-5 space-y-2.5">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            Aucune zone {type === 'ssi' ? 'SSI' : 'Sécurité des personnes'} dans cet espace.
          </p>
        )}
        {items.map((z) => (
          <SelectableTile
            key={z.id}
            label={z.nom}
            description={z.description || undefined}
            selected={draft.zone?.id === z.id}
            onClick={() => pickItem(z.id, z.nom)}
          />
        ))}
      </div>
    </div>
  );
}
