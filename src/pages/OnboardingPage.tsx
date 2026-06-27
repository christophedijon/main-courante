import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Building2, Tag, User, Cpu, CheckCircle2, CheckCheck, Loader2, Image as ImageIcon, LogOut } from 'lucide-react';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuth } from '../context/AuthContext';
import StepWelcome from './onboarding/StepWelcome';
import StepCoordonnees from './onboarding/StepCoordonnees';
import StepCategorieERP from './onboarding/StepCategorieERP';
import Step2 from './onboarding/Step2';
import Step5 from './onboarding/Step5';
import StepLogo from './onboarding/StepLogo';
import Step6 from './onboarding/Step6';

// Sidebar steps (welcome is full-screen outside the stepper)
const STEPS = [
  { label: 'Coordonnées',        icon: Building2    },  // etape 1
  { label: 'Catégorie ERP',      icon: Tag          },  // etape 2
  { label: 'Direction',          icon: User         },  // etape 3
  { label: 'Matériel',           icon: Cpu          },  // etape 4
  { label: 'Logo',               icon: ImageIcon    },  // etape 5
  { label: 'Récap & Activation', icon: CheckCircle2 },  // etape 6
];
const STEP_ETAPES = [1, 2, 3, 4, 5, 6] as const;
const TOTAL_STEPS = STEPS.length;

// Intermediate steps where "Je reviens plus tard" is shown
const INTERMEDIATE_ETAPES = new Set([1, 2, 3, 4, 5]);

function uiStepIndex(etape: number): number {
  return Math.max(0, Math.min(etape - 1, TOTAL_STEPS - 1));
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('etabId') ?? undefined;
  const { signOut } = useAuth();

  const {
    state,
    updateData,
    initEtab,
    saveStep,
    saveCurrentStep,
    createDirectionUser,
    activateClient,
    loadPostesTemplate,
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

  async function handleNext(patch: Record<string, unknown>) {
    if (!etabId) return;
    await saveStep(etabId, etape, patch as never);
  }

  async function handleActivate() {
    if (!etabId) return;
    const ok = await activateClient(etabId);
    if (ok) {
      window.location.replace('/mobile');
    }
  }

  async function handleLoadTemplate(t: 'discotheque' | 'bar' | 'salle') {
    if (!etabId) return;
    await loadPostesTemplate(etabId, t);
  }

  async function handleLeave() {
    if (etabId) await saveCurrentStep(etabId);
    await signOut();
    navigate('/');
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (!initDone || (resumeId && saving && !data.nom && etape !== 0)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm">Initialisation…</p>
        </div>
      </div>
    );
  }

  if (error && !saving && etape === 1 && !etabId) {
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

  const currentUiIdx = Math.min(uiStepIndex(etape), TOTAL_STEPS - 1);
  const progressPct = activated ? 100 : ((currentUiIdx + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 border-r border-slate-800 p-6 shrink-0">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-white">Nouvel établissement</h1>
          <p className="text-xs text-slate-400 mt-0.5">Assistant d'onboarding</p>
        </div>

        <nav className="flex-1">
          <ol className="space-y-1">
            {STEPS.map(({ label, icon: Icon }, idx) => {
              const dbEtape = STEP_ETAPES[idx];
              const isLast = idx === STEPS.length - 1;
              const isCompleted = activated || (!isLast && etape > dbEtape);
              const isActive = !activated && (isLast ? etape >= dbEtape : etape === dbEtape);
              const isFuture = !isCompleted && !isActive;

              return (
                <li key={idx}>
                  <button
                    onClick={() => !isFuture && !isActive && goToStep(dbEtape)}
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
                    <div className={`ml-6 w-px h-3 my-0.5 transition-colors ${!isFuture && etape > STEP_ETAPES[idx] ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
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
            {STEPS.map((_, idx) => {
              const dbEtape = STEP_ETAPES[idx];
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
            <span className="text-xs text-slate-500">{STEPS[currentUiIdx]?.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* "Je reviens plus tard" on intermediate steps */}
            {INTERMEDIATE_ETAPES.has(etape) && (
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
            <button
              onClick={() => navigate('/clients')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Fermer et revenir aux clients"
            >
              <X className="w-5 h-5" />
            </button>
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

            {etape === 1 && (
              <StepCoordonnees
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                saving={saving}
              />
            )}
            {etape === 2 && (
              <StepCategorieERP
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(1)}
                saving={saving}
              />
            )}
            {etape === 3 && etabId && (
              <Step2
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(2)}
                saving={saving}
                etabId={etabId}
                createDirectionUser={createDirectionUser}
              />
            )}
            {etape === 4 && (
              <Step5
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(3)}
                saving={saving}
              />
            )}
            {etape === 5 && etabId && (
              <StepLogo
                etabId={etabId}
                onNext={() => handleNext({})}
                onBack={() => goToStep(4)}
                saving={saving}
              />
            )}
            {etape >= 6 && etabId && (
              <Step6
                data={data}
                etabId={etabId}
                onBack={() => goToStep(5)}
                saving={saving}
                activated={activated}
                onActivate={handleActivate}
                onLoadTemplate={handleLoadTemplate}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
