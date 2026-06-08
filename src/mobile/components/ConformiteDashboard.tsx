import { computeConformite, RegistreItemMin } from '../../lib/registreStatut';
import ConformiteDonut from './ConformiteDonut';

interface Props {
  items: RegistreItemMin[];
}

export default function ConformiteDashboard({ items }: Props) {
  const { conformes, total, nbRetard, nbNonPlanifie, nbAttention, nbAJour } =
    computeConformite(items);

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Donut SVG */}
        <div className="shrink-0">
          <ConformiteDonut items={items} size={160} />
        </div>

        {/* Legend + stats */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {conformes}/{total} vérifications à jour
          </p>

          <div className="space-y-1.5">
            {nbRetard > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 4px #ef444488' }} />
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                  {nbRetard} en retard
                </span>
              </div>
            )}
            {(nbNonPlanifie + nbAttention) > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#f59e0b', boxShadow: '0 0 4px #f59e0b88' }} />
                <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                  {nbNonPlanifie + nbAttention} à surveiller
                </span>
              </div>
            )}
            {nbAJour > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 4px #22c55e88' }} />
                <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
                  {nbAJour} à jour
                </span>
              </div>
            )}
            {total === 0 && (
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>Aucune installation planifiable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
