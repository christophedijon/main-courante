import { useEffect, useState } from 'react';
import { Signal, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useBeaconScanner } from '../../hooks/useBeaconScanner';

function minutesAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "à l'instant";
  return `il y a ${m}min`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function BeaconScannerBanner() {
  const { isActive, stopRonde, recentDetections } = useBeaconScanner();
  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    return () => { stopRonde(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!isActive) return null;

  const lastDetection = recentDetections[0] ?? null;
  const collapsedLabel = lastDetection
    ? `Ronde active — ${lastDetection.beaconNom} ${minutesAgo(lastDetection.timestamp)}`
    : 'Ronde active — en attente de balise';

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40">
      {expanded && (
        <div
          className="mb-2 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md overflow-hidden"
          style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.5)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Détections récentes
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          {recentDetections.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500 text-center">
              Aucune détection récente
            </div>
          ) : (
            <ul>
              {recentDetections.map((det, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between px-4 py-3 border-b border-slate-800 last:border-b-0"
                >
                  <span className="text-xs text-slate-500 w-12 shrink-0 tabular-nums">
                    {formatTime(det.timestamp)}
                  </span>
                  <span className="flex-1 mx-3 text-sm font-semibold text-slate-100 truncate">
                    {det.beaconNom}
                  </span>
                  {det.zoneNom ? (
                    <span className="text-xs text-slate-400 shrink-0 max-w-[100px] truncate text-right">
                      {det.zoneNom}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        aria-label={expanded ? 'Réduire le panneau ronde' : 'Voir les détections récentes'}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <Signal size={15} className="text-blue-400 shrink-0" />
          <span className="text-sm text-slate-200 truncate">{collapsedLabel}</span>
        </div>
        <span className="ml-3 shrink-0 text-slate-400">
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </button>
    </div>
  );
}
