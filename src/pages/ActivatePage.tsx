import { useEffect, useState } from 'react';
import { Shield, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function ActivatePage() {
  const [link, setLink]       = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [going, setGoing]     = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('link');
    if (!raw) {
      setError("Lien d'activation invalide. Demandez un nouveau lien à votre administrateur.");
      return;
    }
    try {
      const decoded = decodeURIComponent(raw);
      setLink(decoded);
      // Detect recovery vs invite from the encoded Supabase link
      setIsRecovery(decoded.includes('type=recovery'));
    } catch {
      setError("Lien d'activation corrompu.");
    }
  }, []);

  function activate() {
    if (!link) return;
    setGoing(true);
    // Navigate to the Supabase verify endpoint. Gmail never reaches this URL
    // because it was only linked as /activate?link=... in the email.
    window.location.href = link;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='rgba(59%2C130%2C246%2C0.06)' stroke-width='1'/%3E%3Cpolygon points='28,52 54,66 54,94 28,108 2,94 2,66' fill='none' stroke='rgba(59%2C130%2C246%2C0.06)' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '56px 100px',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)' }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        {/* brand */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Main Courante</span>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />
            <div className="px-8 py-8 text-center">

              {error ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                  </div>
                  <h1 className="text-white font-semibold text-lg mb-2">Lien invalide</h1>
                  <p className="text-slate-400 text-sm">{error}</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-7 h-7 text-blue-400" />
                  </div>
                  <h1 className="text-white font-bold text-2xl mb-2">
                    {isRecovery ? 'Réinitialisation' : 'Invitation reçue'}
                  </h1>
                  <p className="text-slate-400 text-sm mb-8">
                    {isRecovery
                      ? 'Cliquez ci-dessous pour définir un nouveau mot de passe.'
                      : 'Cliquez ci-dessous pour activer votre compte et définir votre mot de passe.'}
                  </p>

                  <button
                    onClick={activate}
                    disabled={!link || going}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                      disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed
                      text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/30"
                  >
                    {going ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Redirection…</>
                    ) : (
                      <>{isRecovery ? 'Réinitialiser mon mot de passe' : 'Activer mon compte'}<ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-slate-600 mt-6">
            Main Courante — Gestion de sécurité évènementielle
          </p>
        </div>
      </div>
    </div>
  );
}
