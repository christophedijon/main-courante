import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';
import StepHeader from '../components/StepHeader';
import SelectableTile from '../components/SelectableTile';

export default function StepEtablissement() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const [items, setItems] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('entreprise').select('id, nom').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, []);

  if (!type || (type !== 'ssi' && type !== 'securite_personnes')) {
    return <Navigate to="/mobile" replace />;
  }

  function pickItem(id: string, nom: string) {
    setField('etablissement', { id, label: nom || 'Établissement' });
    navigate(`/mobile/saisie/${type}/espace`);
  }

  return (
    <div>
      <StepHeader step={1} total={7} title="Choisir l'établissement" backTo="/mobile" />
      <div className="px-4 py-5 space-y-2.5">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && items.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Aucun établissement configuré.</p>
        )}
        {items.map((e) => (
          <SelectableTile
            key={e.id}
            label={e.nom || 'Établissement sans nom'}
            selected={draft.etablissement?.id === e.id}
            onClick={() => pickItem(e.id, e.nom)}
          />
        ))}
      </div>
    </div>
  );
}
