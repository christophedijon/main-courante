import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Building2, User, LayoutGrid, ShieldCheck, Cpu, CheckCircle2, CheckCheck, Loader2 } from 'lucide-react';
import { useOnboarding } from '../hooks/useOnboarding';
import Step1 from './onboarding/Step1';
import Step2 from './onboarding/Step2';
import Step3 from './onboarding/Step3';
import Step4 from './onboarding/Step4';
import Step5 from './onboarding/Step5';
import Step6 from './onboarding/Step6';

const STEPS = [
  { label: 'Établissement', icon: Building2 },
  { label: 'Direction', icon: User },
  { label: 'Structure', icon: LayoutGrid },
  { label: 'Vérificateurs', icon: ShieldCheck },
  { label: 'Matériel', icon: Cpu },
  { label: 'Récap & Activation', icon: CheckCircle2 },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('etabId') ?? undefined;

  const {
    state,
    updateData,
    initEtab,
    saveStep,
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
    await activateClient(etabId);
  }

  async function handleLoadTemplate(t: 'discotheque' | 'bar' | 'salle') {
    if (!etabId) return;
    await loadPostesTemplate(etabId, t);
  }

  if (!initDone || (resumeId && saving && !data.nom)) {
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
              const n = idx + 1;
              const isCompleted = etape > n || activated;
              const isActive = etape === n && !activated;
              const isFuture = etape < n && !activated;

              return (
                <li key={n}>
                  <button
                    onClick={() => n < etape && goToStep(n)}
                    disabled={n >= etape && !activated}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                      ${isActive ? 'bg-blue-600/20 border border-blue-500/30' : ''}
                      ${isCompleted ? 'hover:bg-slate-800 cursor-pointer' : ''}
                      ${isFuture ? 'opacity-40 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all
                      ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                      ${isActive ? 'bg-blue-500 text-white' : ''}
                      ${isFuture ? 'bg-slate-700 text-slate-500' : ''}
                    `}>
                      {isCompleted ? <CheckCheck className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className={`text-sm ${isActive ? 'text-white font-medium' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className={`ml-6 w-px h-3 my-0.5 transition-colors ${n < etape ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">Étape {Math.min(etape, 6)} sur 6</p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(Math.min(etape, 6) / 6) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
          {/* Mobile step indicator */}
          <div className="md:hidden flex items-center gap-2">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx + 1 < etape ? 'w-6 bg-emerald-500' :
                  idx + 1 === etape ? 'w-8 bg-blue-500' :
                  'w-3 bg-slate-700'
                }`}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <span className="text-xs text-slate-500">
              {STEPS[Math.min(etape - 1, 5)].label}
            </span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Fermer et revenir au dashboard"
          >
            <X className="w-5 h-5" />
          </button>
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
              <Step1
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                saving={saving}
              />
            )}
            {etape === 2 && etabId && (
              <Step2
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(1)}
                saving={saving}
                etabId={etabId}
                createDirectionUser={createDirectionUser}
              />
            )}
            {etape === 3 && (
              <Step3
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(2)}
                saving={saving}
              />
            )}
            {etape === 4 && (
              <Step4
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
                onBack={() => goToStep(3)}
                saving={saving}
              />
            )}
            {etape === 5 && (
              <Step5
                data={data}
                onChange={updateData}
                onNext={patch => handleNext(patch)}
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
