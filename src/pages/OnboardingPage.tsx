import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Tag, CheckCircle2, CheckCheck, Loader2, LogOut } from 'lucide-react';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuth } from '../context/AuthContext';
import StepWelcome from './onboarding/StepWelcome';
import StepActivation from './onboarding/StepActivation';

// 5-step onboarding: Welcome (etape 0) + 4 steps in stepper (etapes 1-4)
// Etapes 1-3 redirect to existing pages with ?onboarding=true query param
const STEPS = [
  { label: 'Mon établissement', icon: Building2,    etape: 1 },
  { label: 'Espaces & Zones',   icon: MapPin,       etape: 2 },
  { label: 'Motifs de saisie',  icon: Tag,          etape: 3 },
  { label: 'Activation',        icon: CheckCircle2, etape: 4 },
] as const;

const STEP_ROUTES: Record<number, string> = {
  1: '/entreprise',
  2: '/espaces-zones',
  3: '/motifs',
};

const TOTAL_STEPS = STEPS.length;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('etabId') ?? undefined;
  const { signOut } = useAuth();

  const {
    state,
    initEtab,
    saveStep,
    saveCurrentStep,
    activateClient,
    goToStep,
    setError,
  } = useOnboarding(resumeId);

  const { etabId, etape, data, saving, error, activated } = state;

  const [initDone, setInitDone] = useState(!!resumeId);
  const initStarted = useRef(false);

  useEffect(() => {
    if (resumeId) return;
    if (initStarted.current) return;
    initStarted.current = true;
    initEtab().then(id => {
      if (id) setInitDone(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When we arrive back from an external page (e.g. /entreprise?onboarding=true),
  // the URL has ?etabId=... but the etape in state is already updated by that page.
  // We just need to display the correct step.
  useEffect(() => {
    if (resumeId && etape >= 1 && etape <= 3 && STEP_ROUTES[etape]) {
      // Already on the right step — stay here (don't auto-redirect)
    }
  }, [resumeId, etape]);

  async function handleActivate() {
    if (!etabId) return;
    const ok = await activateClient(etabId);
    if (ok) {
      window.location.replace('/mobile');
    }
  }

  async function handleLeave() {
    if (etabId) await saveCurrentStep(etabId);
    await signOut();
    navigate('/');
  }

  // Navigate to an external page in onboarding mode
  function goToExternalStep(targetEtape: number) {
    const route = STEP_ROUTES[targetEtape];
    const resolvedEtabId = etabId ?? resumeId;
    if (!route || !resolvedEtabId) return;
    navigate(`${route}?onboarding=true&etabId=${resolvedEtabId}`);
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (!initDone || (resumeId && saving && etape === 0)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm">Initialisation…</p>
        </div>
      </div>
    );
  }

  if (error && !saving && etape === 0 && !etabId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); initEtab().then(id => { if (id) setInitDone(true); }); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Welcome (full-screen, outside stepper) ───────────────────────────────────

  if (etape === 0 && (initDone || resumeId)) {
    return (
      <StepWelcome
        onStart={async () => { if (etabId) await saveStep(etabId, 0, {}, 1); }}
        onLeave={handleLeave}
        saving={saving}
      />
    );
  }

  // ── Main layout with sidebar stepper ────────────────────────────────────────

  const currentUiIdx = Math.max(0, Math.min(etape - 1, TOTAL_STEPS - 1));
  const progressPct = activated ? 100 : ((currentUiIdx + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 border-r border-slate-800 p-6 shrink-0">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-white">Configuration</h1>
          <p className="text-xs text-slate-400 mt-0.5">Assistant d'onboarding</p>
        </div>

        <nav className="flex-1">
          <ol className="space-y-1">
            {STEPS.map(({ label, icon: Icon, etape: dbEtape }, idx) => {
              const isLast = idx === STEPS.length - 1;
              const isCompleted = activated || (!isLast && etape > dbEtape);
              const isActive = !activated && (isLast ? etape >= dbEtape : etape === dbEtape);
              const isFuture = !isCompleted && !isActive;

              return (
                <li key={idx}>
                  <button
                    onClick={() => {
                      if (isFuture || isActive) return;
                      if (STEP_ROUTES[dbEtape]) {
                        goToExternalStep(dbEtape);
                      } else {
                        goToStep(dbEtape);
                      }
                    }}
                    disabled={isFuture || isActive}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                      ${isActive    ? 'bg-blue-600/20 border border-blue-500/30' : ''}
                      ${isCompleted ? 'hover:bg-slate-800 cursor-pointer'        : ''}
                      ${isFuture    ? 'opacity-40 cursor-not-allowed'            : ''}
                    `}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all
                      ${isCompleted ? 'bg-emerald-500 text-white'   : ''}
                      ${isActive    ? 'bg-blue-500 text-white'      : ''}
                      ${isFuture    ? 'bg-slate-700 text-slate-500' : ''}
                    `}>
                      {isCompleted ? <CheckCheck className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-sm ${isActive ? 'text-white font-medium' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={`ml-6 w-px h-3 my-0.5 transition-colors ${etape > dbEtape ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Étape {activated ? TOTAL_STEPS : currentUiIdx + 1} sur {TOTAL_STEPS}
          </p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
          {/* Mobile step dots */}
          <div className="md:hidden flex items-center gap-2">
            {STEPS.map(({ etape: dbEtape }, idx) => {
              const past   = activated || etape > dbEtape;
              const active = !activated && (idx === STEPS.length - 1 ? etape >= dbEtape : etape === dbEtape);
              return (
                <div key={idx} className={`h-1.5 rounded-full transition-all ${
                  past ? 'w-6 bg-emerald-500' : active ? 'w-8 bg-blue-500' : 'w-3 bg-slate-700'
                }`} />
              );
            })}
          </div>
          <div className="hidden md:block">
            <span className="text-xs text-slate-500">
              {STEPS[currentUiIdx]?.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {etape < 4 && (
              <button
                onClick={handleLeave}
                disabled={saving}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                title="Sauvegarder et quitter"
              >
                <LogOut className="w-3.5 h-3.5" />
                Je reviens plus tard
              </button>
            )}
          </div>
        </header>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
                <span className="shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Étapes 1-3 : external pages — show "navigate" card */}
            {etape >= 1 && etape <= 3 && etabId && (
              <ExternalStepCard
                etape={etape}
                etabId={etabId}
                onGo={() => goToExternalStep(etape)}
              />
            )}

            {/* Étape 4 : activation */}
            {etape >= 4 && etabId && (
              <StepActivation
                etabId={etabId}
                saving={saving}
                activated={activated}
                onActivate={handleActivate}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── ExternalStepCard ─────────────────────────────────────────────────────────

const STEP_META: Record<number, { title: string; description: string; icon: React.ElementType; accent: string }> = {
  1: {
    title: 'Informations de l\'établissement',
    description: 'Vérifiez et complétez le nom, le type ERP, la catégorie, la capacité et les coordonnées de votre établissement.',
    icon: Building2,
    accent: 'text-blue-400',
  },
  2: {
    title: 'Espaces & Zones',
    description: 'Configurez la structure de votre établissement : espaces, zones de sécurité et zones SSI.',
    icon: MapPin,
    accent: 'text-emerald-400',
  },
  3: {
    title: 'Motifs de saisie',
    description: 'Définissez les motifs d\'intervention, les motifs SSI et les niveaux d\'intervention utilisés lors de la saisie.',
    icon: Tag,
    accent: 'text-amber-400',
  },
};

function ExternalStepCard({ etape, etabId, onGo }: { etape: number; etabId: string; onGo: () => void }) {
  const meta = STEP_META[etape];
  if (!meta) return null;
  const { title, description, icon: Icon, accent } = meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${accent}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
            Étape {etape}/4
          </p>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-slate-400 text-sm leading-relaxed mb-6">{description}</p>
        <button
          onClick={onGo}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
        >
          <Icon className="w-4 h-4" />
          Configurer — {title}
        </button>
        <p className="text-xs text-slate-600 mt-3">
          Vous serez redirigé vers la page de configuration. Un bouton "Enregistrer et continuer" vous ramènera ici.
        </p>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl">
        <span className="text-slate-500 text-xs">
          ID établissement : <span className="font-mono text-slate-400 text-[11px]">{etabId.slice(0, 8)}…</span>
        </span>
      </div>
    </div>
  );
}
