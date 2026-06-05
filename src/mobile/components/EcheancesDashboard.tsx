import { AlertTriangle, CheckCircle } from 'lucide-react';
import { getNextDate, getStatut } from '../../lib/registreStatut';

type RegistreItem = {
  id: string;
  installation: string;
  reference_reglementaire: string;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
};

function formatDateFR(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  items: RegistreItem[];
}

export default function EcheancesDashboard({ items }: Props) {
  type Row = {
    item: RegistreItem;
    statut: 'retard' | 'attention';
    daysLeft: number;
    nextDate: Date;
  };

  const rows: Row[] = [];
  for (const item of items) {
    const statut = getStatut(item.date_verification, item.periodicite, item.applicable);
    if (statut !== 'retard' && statut !== 'attention') continue;
    const nextDate = item.date_verification
      ? getNextDate(item.date_verification, item.periodicite)
      : null;
    if (!nextDate) continue;
    const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    rows.push({ item, statut: statut as 'retard' | 'attention', daysLeft, nextDate });
  }

  rows.sort((a, b) => {
    if (a.statut !== b.statut) return a.statut === 'retard' ? -1 : 1;
    return a.daysLeft - b.daysLeft;
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">À traiter sous 3 mois</span>
        </div>
        {rows.length > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{
              background: rows.some((r) => r.statut === 'retard')
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(245,158,11,0.15)',
              color: rows.some((r) => r.statut === 'retard') ? '#ef4444' : '#f59e0b',
              border: `1px solid ${rows.some((r) => r.statut === 'retard') ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}
          >
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-4">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 font-medium">
            Aucune vérification à prévoir dans les 3 mois
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ divideColor: 'rgba(255,255,255,0.05)' }}>
          {rows.map(({ item, statut, daysLeft, nextDate }) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{item.installation}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: 'rgba(100,116,139,0.25)',
                      color: 'rgba(148,163,184,0.85)',
                    }}
                  >
                    {item.reference_reglementaire}
                  </span>
                  <span className="text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    Échéance : {formatDateFR(nextDate)}
                  </span>
                </div>
              </div>
              <span
                className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={
                  statut === 'retard'
                    ? {
                        background: 'rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.3)',
                      }
                    : {
                        background: 'rgba(245,158,11,0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }
                }
              >
                {statut === 'retard'
                  ? `${Math.abs(daysLeft)}j de retard`
                  : `J-${daysLeft}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
