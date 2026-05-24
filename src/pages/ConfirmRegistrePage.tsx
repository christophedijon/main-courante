import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'already' | 'error';

interface ConfirmData {
  installation?: string;
  entreprise?: string;
  confirme_at?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function ConfirmRegistrePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<ConfirmData>({});

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    fetch(`${SUPABASE_URL}/functions/v1/confirm-registre?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData({ installation: json.installation, entreprise: json.entreprise });
          setStatus('success');
        } else if (json.error === 'already_confirmed') {
          setData({ installation: json.installation, confirme_at: json.confirme_at });
          setStatus('already');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === 'loading' && <LoadingCard />}
        {status === 'success' && <SuccessCard data={data} />}
        {status === 'already' && <AlreadyCard data={data} />}
        {status === 'error' && <ErrorCard />}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-10 text-center">
      {children}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
        <Clock className="w-8 h-8 text-slate-400 animate-pulse" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Vérification en cours…</h1>
      <p className="text-slate-500 text-sm">Merci de patienter quelques instants.</p>
    </Card>
  );
}

function SuccessCard({ data }: { data: ConfirmData }) {
  return (
    <Card>
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-3">Prise en compte enregistrée</h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-6">
        Merci, votre prise en compte a bien été enregistrée.<br />
        Nous restons à votre disposition pour convenir d'une date d'intervention.
      </p>
      {data.installation && (
        <div className="bg-slate-50 rounded-xl px-5 py-4 text-left mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Visite périodique concernée
          </p>
          <p className="text-sm font-medium text-slate-800">{data.installation}</p>
        </div>
      )}
      {data.entreprise && (
        <p className="text-xs text-slate-400 mt-4">{data.entreprise}</p>
      )}
    </Card>
  );
}

function AlreadyCard({ data }: { data: ConfirmData }) {
  const dateStr = data.confirme_at
    ? new Date(data.confirme_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card>
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-8 h-8 text-blue-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-3">Déjà confirmé</h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-6">
        Cette prise en compte a déjà été enregistrée
        {dateStr && <> le <strong className="text-slate-700">{dateStr}</strong></>}.
      </p>
      {data.installation && (
        <div className="bg-slate-50 rounded-xl px-5 py-4 text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Visite périodique concernée
          </p>
          <p className="text-sm font-medium text-slate-800">{data.installation}</p>
        </div>
      )}
    </Card>
  );
}

function ErrorCard() {
  return (
    <Card>
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
        <XCircle className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-3">Lien invalide ou expiré</h1>
      <p className="text-slate-500 text-sm leading-relaxed">
        Ce lien de confirmation est invalide ou a expiré.<br />
        Veuillez contacter l'établissement si vous pensez qu'il s'agit d'une erreur.
      </p>
      <div className="mt-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Chaque lien est à usage unique et personnel à votre établissement.
        </p>
      </div>
    </Card>
  );
}
