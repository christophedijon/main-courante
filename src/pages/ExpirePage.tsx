import { AlertTriangle, LogOut, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ExpirePage() {
  const { signOut, etabNom, etabDateFinEssai } = useAuth();

  const dateFormatted = etabDateFinEssai
    ? new Date(etabDateFinEssai).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  const mailtoBody = encodeURIComponent(
    `Bonjour,\n\nL'essai de ${etabNom ?? 'mon établissement'} est terminé depuis le ${dateFormatted ?? 'récemment'}. Je souhaite être rappelé pour souscrire un abonnement.\n\nCordialement`
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-white font-bold text-2xl mb-2">Période d'essai terminée</h1>
          {etabNom && (
            <p className="text-slate-400 text-sm">
              <span className="text-white font-medium">{etabNom}</span>
            </p>
          )}
          {dateFormatted && (
            <p className="text-slate-500 text-sm mt-1">
              Expirée le <span className="text-slate-400">{dateFormatted}</span>
            </p>
          )}
        </div>

        {/* Info card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
          <p className="text-slate-300 text-sm leading-relaxed mb-3">
            Votre accès à Main Courante a été suspendu. Toutes vos données sont conservées
            et accessibles dès que vous souscrivez un abonnement.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Contactez-nous pour choisir l'offre adaptée à votre établissement et reprendre
            exactement là où vous en étiez.
          </p>
        </div>

        {/* CTA */}
        <a
          href={`mailto:contact@maincourante.eu?subject=${encodeURIComponent(`Demande de rappel — ${etabNom ?? 'Abonnement'}`)}&body=${mailtoBody}`}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm py-3.5 rounded-xl transition-colors mb-3"
        >
          <Phone className="w-4 h-4" />
          Demander à être rappelé
        </a>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm py-3 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>

      </div>
    </div>
  );
}
