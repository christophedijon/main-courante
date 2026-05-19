import { useEffect, useState } from 'react';
import { Signal, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBeaconScanner } from '../../hooks/useBeaconScanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minutesAgo(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "à l'instant";
  return `il y a ${m}min`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BeaconScannerBanner() {
  const { userFonction, isSuperAdmin } = useAuth();
  const { isScanning, stopScan, recentDetections, beaconsLoaded, scanError } = useBeaconScanner();

  const [expanded, setExpanded] = useState(false);
  // Tick counter forces a re-render every 30 s so relative timestamps stay fresh
  const [, setTick] = useState(0);

  const isAdmin =
    userFonction === 'Direction' ||
    userFonction === 'Chef de poste' ||
    isSuperAdmin;

  // Debug log on every render
  console.log('DEBUG BANNER RENDER', {
    bluetooth: !!navigator?.bluetooth,
    isScanning,
    role: userFonction,
  });

  // Stop scan on unmount only
  useEffect(() => {
    return () => {
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render every 30 s to keep "il y a Xmin" fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasLEScan = typeof (navigator?.bluetooth as any)?.requestLEScan === 'function';

  const debugPanel = (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', color: '#0f0', fontSize: 11, padding: '4px 8px', maxWidth: 260, wordBreak: 'break-all', pointerEvents: 'none' }}>
      <div>bluetooth: {!!navigator?.bluetooth ? 'yes' : 'no'}</div>
      <div>requestLEScan: {hasLEScan ? 'yes' : 'no'}</div>
      <div>isScanning: {String(isScanning)}</div>
      <div>scanError: {scanError ?? 'none'}</div>
      <div>role: {userFonction ?? 'null'}</div>
      <div>beacons: {beaconsLoaded ? 'loaded' : 'loading...'}</div>
    </div>
  );

  if (!isScanning) return debugPanel;

  const lastDetection = recentDetections[0] ?? null;

  const collapsedLabel = lastDetection
    ? `Ronde active — ${lastDetection.beaconNom} ${minutesAgo(lastDetection.timestamp)}`
    : 'Ronde active — en attente de balise';

  return (
    <>
    {debugPanel}
    <div className="fixed bottom-20 left-4 right-4 z-40">
      {/* ------------------------------------------------------------------ */}
      {/* Expanded panel — rendered above the bar                             */}
      {/* ------------------------------------------------------------------ */}
      {expanded && (
        <div
          className="mb-2 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md overflow-hidden"
          style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.5)' }}
        >
          {/* Header row */}
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

          {/* Detection rows */}
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
                  {/* Time */}
                  <span className="text-xs text-slate-500 w-12 shrink-0 tabular-nums">
                    {formatTime(det.timestamp)}
                  </span>

                  {/* Beacon name */}
                  <span className="flex-1 mx-3 text-sm font-semibold text-slate-100 truncate">
                    {det.beaconNom}
                  </span>

                  {/* Zone name */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Collapsed bar (always visible when scanning)                        */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        aria-label={expanded ? 'Réduire le panneau ronde' : 'Voir les détections récentes'}
      >
        {/* Left: pulsing dot + icon + label */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulsing green dot */}
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />

          {/* Signal icon */}
          <Signal size={15} className="text-blue-400 shrink-0" />

          {/* Label */}
          <span className="text-sm text-slate-200 truncate">
            {collapsedLabel}
          </span>
        </div>

        {/* Right: chevron */}
        <span className="ml-3 shrink-0 text-slate-400">
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </button>
    </div>
    </>
  );
}
