import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radio, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveDisplayName, useDisplayNames } from '../mobile/hooks/useDisplayNames';

type Derniere = { modifie_le: string; modifie_par: string | null } | null;

const TEXTE_ACTIF = "Vos volumes d'entrées, agrégés et anonymisés avec ceux d'autres établissements, servent à calculer la tendance du réseau, affichée dans vos rapports de soirée. Aucune donnée d'un établissement n'est visible par un autre.";
const TEXTE_INACTIF = "Vous ne participez pas au baromètre : la tendance du réseau n'apparaît pas dans vos rapports. Activez la participation pour la voir.";
const MESSAGE_REFUS = "La base a refusé ce changement : seule la Direction de cet établissement peut modifier cette option.";
const MESSAGE_ECHEC = "La modification n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.";

async function lireDerniere(etablissementId: string) {
  const { data, error } = await supabase
    .from('barometre_consentements')
    .select('modifie_le, modifie_par')
    .eq('etablissement_id', etablissementId)
    .order('modifie_le', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as Derniere, error };
}

function formaterDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });
}

export default function BarometreReseauCard() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [participe, setParticipe] = useState<boolean | null>(null);
  const [derniere, setDerniere] = useState<Derniere>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [rechargement, setRechargement] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreurMaj, setErreurMaj] = useState<string | null>(null);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);

  const auteurs = useMemo(() => (derniere?.modifie_par ? [derniere.modifie_par] : []), [derniere]);
  const { nameMap } = useDisplayNames(auteurs);

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreurChargement(false);
      const { data: mu, error: erreurMu } = await supabase
        .from('managed_users')
        .select('etablissement_id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (annule) return;
      if (erreurMu || !mu?.etablissement_id) {
        setErreurChargement(true);
        setChargement(false);
        return;
      }
      const id = mu.etablissement_id as string;
      const [resEtab, resDerniere] = await Promise.all([
        supabase.from('etablissements').select('barometre_participe').eq('id', id).maybeSingle(),
        lireDerniere(id),
      ]);
      if (annule) return;
      if (resEtab.error || typeof resEtab.data?.barometre_participe !== 'boolean' || resDerniere.error) {
        setErreurChargement(true);
        setChargement(false);
        return;
      }
      setEtablissementId(id);
      setParticipe(resEtab.data.barometre_participe);
      setDerniere(resDerniere.data);
      setChargement(false);
    })();
    return () => { annule = true; };
  }, [userId, rechargement]);

  async function appliquer(valeur: boolean) {
    if (!etablissementId) return;
    setEnCours(true);
    setErreurMaj(null);
    const { data, error } = await supabase
      .from('etablissements')
      .update({ barometre_participe: valeur })
      .eq('id', etablissementId)
      .select('barometre_participe');
    if (error) {
      setErreurMaj(error.code === '42501' ? MESSAGE_REFUS : MESSAGE_ECHEC);
      setEnCours(false);
      return;
    }
    if (!Array.isArray(data) || data.length !== 1 || typeof data[0].barometre_participe !== 'boolean') {
      setErreurMaj(MESSAGE_ECHEC);
      setEnCours(false);
      return;
    }
    setParticipe(data[0].barometre_participe);
    const resDerniere = await lireDerniere(etablissementId);
    if (resDerniere.error) {
      setErreurMaj("La modification est enregistrée, mais l'historique n'a pas pu être relu. Actualisez la page.");
    } else {
      setDerniere(resDerniere.data);
    }
    setEnCours(false);
  }

  function basculer() {
    if (participe) setConfirmationOuverte(true);
    else appliquer(true);
  }

  function confirmerDesactivation() {
    setConfirmationOuverte(false);
    appliquer(false);
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Radio className="w-4 h-4 text-blue-400" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm sm:text-base font-semibold text-white">Baromètre réseau</h2>
          <p className="text-xs text-slate-400">Participation de votre établissement</p>
        </div>
      </div>

      {chargement && (
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">Chargement du baromètre…</span>
        </div>
      )}

      {!chargement && erreurChargement && (
        <div className="bg-rose-950/40 border border-rose-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
            <p className="text-sm text-rose-100">Le réglage du baromètre n'a pas pu être chargé.</p>
          </div>
          <button
            onClick={() => setRechargement(v => v + 1)}
            className="self-start sm:self-auto text-sm font-semibold px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-400 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {!chargement && !erreurChargement && participe !== null && (
        <>
          <div className="flex items-center justify-between gap-4">
            <span id="barometre-participation-label" className="text-sm font-medium text-white">
              Participer au baromètre de fréquentation
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={participe}
              aria-labelledby="barometre-participation-label"
              disabled={enCours}
              onClick={basculer}
              className={`relative inline-flex w-11 h-6 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed ${participe ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${participe ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">{participe ? TEXTE_ACTIF : TEXTE_INACTIF}</p>

          {enCours && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Enregistrement…
            </p>
          )}

          {erreurMaj && (
            <p role="alert" className="text-sm text-rose-300">{erreurMaj}</p>
          )}

          <p className="text-xs text-slate-500">
            {derniere
              ? `Dernière modification le ${formaterDate(derniere.modifie_le)} par ${resolveDisplayName(nameMap, derniere.modifie_par, 'un administrateur')}.`
              : 'Aucune modification enregistrée.'}
          </p>
        </>
      )}

      {confirmationOuverte && (
        <ConfirmationDesactivation
          onConfirmer={confirmerDesactivation}
          onAnnuler={() => setConfirmationOuverte(false)}
          enCours={enCours}
        />
      )}
    </section>
  );
}

function ConfirmationDesactivation({ onConfirmer, onAnnuler, enCours }: {
  onConfirmer: () => void;
  onAnnuler: () => void;
  enCours: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="barometre-confirmation-titre">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onAnnuler} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h2 id="barometre-confirmation-titre" className="text-base font-semibold text-white">Quitter le baromètre ?</h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Si vous désactivez la participation, vos chiffres ne contribueront plus au calcul de la tendance du réseau et vous ne la verrez plus dans vos rapports. Les données déjà agrégées ne sont pas retirées.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onAnnuler}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirmer}
            disabled={enCours}
            className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
          >
            Désactiver
          </button>
        </div>
      </div>
    </div>
  );
}
