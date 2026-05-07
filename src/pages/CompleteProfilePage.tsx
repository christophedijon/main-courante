import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User as UserIcon, Phone, Globe, CreditCard, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CnapsInput, { isValidCnaps } from '../components/CnapsInput';
import {
  NATIONALITIES, EXEMPT_NATIONALITIES, normalizeStr,
} from '../lib/profileConstants';

type Msg = { type: 'success' | 'error'; text: string };

const iCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;

export default function CompleteProfilePage() {
  const { session, userFonction, setProfileCompleted } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [natQuery, setNatQuery] = useState('');
  const [natSuggestions, setNatSuggestions] = useState<string[]>([]);
  const [carteProNumero, setCarteProNumero] = useState('CAR');
  const [carteProValidite, setCarteProValidite] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const needsCartePro = userFonction === 'Agent de Sécurité' || userFonction === 'Chef de poste';
  const needsCarte = !EXEMPT_NATIONALITIES.has(nationalite) && nationalite.trim() !== '';

  function handleNatInput(val: string) {
    setNatQuery(val);
    setNationalite(val);
    if (val.length < 3) { setNatSuggestions([]); return; }
    const q = normalizeStr(val);
    setNatSuggestions(NATIONALITIES.filter((n) => normalizeStr(n).includes(q)).slice(0, 6));
  }

  function selectNat(nat: string) {
    setNatQuery(nat);
    setNationalite(nat);
    setNatSuggestions([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!firstName.trim() || !lastName.trim() || !telephone.trim() || !nationalite.trim()) {
      setMsg({ type: 'error', text: 'Tous les champs obligatoires doivent être remplis.' });
      return;
    }
    if (telephone.replace(/\D/g, '').length < 10) {
      setMsg({ type: 'error', text: 'Numéro de téléphone invalide (10 chiffres minimum).' });
      return;
    }
    if (needsCartePro && !isValidCnaps(carteProNumero)) {
      setMsg({ type: 'error', text: 'Numéro de carte professionnelle CNAPS incomplet.' });
      return;
    }

    setSaving(true);
    const uid = session?.user.id;
    if (!uid) { setSaving(false); return; }

    const profileData: Record<string, unknown> = {
      id: uid,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      telephone: telephone.trim(),
      nationalite: nationalite.trim(),
      updated_at: new Date().toISOString(),
    };

    if (needsCartePro) {
      profileData.carte_pro_numero = carteProNumero;
      if (carteProValidite) profileData.carte_pro_validite = carteProValidite;
    }

    const { error } = await supabase.from('user_profiles').upsert(profileData);
    if (error) {
      setSaving(false);
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde. Réessayez.' });
      return;
    }

    await setProfileCompleted();
    setSaving(false);

    // Redirection selon la fonction
    const adminFonctions = ['Direction', 'Chef de poste'];
    if (userFonction && adminFonctions.includes(userFonction)) {
      navigate('/mobile');
    } else {
      navigate('/mobile');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-white text-2xl font-bold">Bienvenue !</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
          Complétez votre profil pour accéder à l'application.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-12">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-5">

          {msg && (
            <div className={`flex items-start gap-2 rounded-xl p-3 text-sm border
              ${msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {msg.type === 'success'
                ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Identité */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5" />
              Identité
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  required
                  className={iCls}
                />
              </Field>
              <Field label="Nom *">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  required
                  className={iCls}
                />
              </Field>
            </div>

            <Field label="Téléphone *">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0600000000"
                  required
                  className={`${iCls} pl-9`}
                />
              </div>
            </Field>

            {/* Nationalité */}
            <div className="relative">
              <Field label="Nationalité *">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={natQuery}
                    onChange={(e) => handleNatInput(e.target.value)}
                    placeholder="Ex : Française, Sénégalaise…"
                    autoComplete="off"
                    required
                    className={`${iCls} pl-9`}
                  />
                </div>
              </Field>
              {natSuggestions.length > 0 && (
                <ul className="absolute z-30 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                  {natSuggestions.map((nat) => (
                    <li key={nat}>
                      <button
                        type="button"
                        onMouseDown={() => selectNat(nat)}
                        className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        {nat}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Carte professionnelle — Agents de Sécurité et Chefs de poste */}
          {needsCartePro && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" />
                Carte professionnelle CNAPS *
              </p>
              <p className="text-xs text-slate-500">
                Format : <span className="font-mono text-slate-400">CAR-XX-XXXX-XX-XX-XXXXXXXX</span>
              </p>
              <Field label="Numéro de carte">
                <CnapsInput
                  value={carteProNumero}
                  onChange={(val) => setCarteProNumero(val)}
                />
              </Field>
              <Field label="Date de fin de validité">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type="date"
                    value={carteProValidite}
                    onChange={(e) => setCarteProValidite(e.target.value)}
                    className={`${iCls} pl-9`}
                  />
                </div>
              </Field>
            </div>
          )}

          {needsCarte && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-xs text-amber-400/80">
                Vous pourrez ajouter votre carte de séjour depuis votre profil après connexion.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Enregistrement…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Valider mon profil
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
