type RegistreItem = {
  id: string;
  installation: string;
  reference_reglementaire: string;
  organisme_verificateur: string;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
  nom_verificateur: string;
  observations: string;
  observations_levees: string;
  rapport_url: string;
  reprise_papier?: boolean;
};

type EntrepriseInfo = {
  nom: string | null;
  logo_url: string | null;
  type_erp: string | null;
  categorie_erp: string | null;
  siret: string | null;
  adresse: string | null;
};

export type RegistreSignature = {
  signataire_nom: string;
  signataire_role: string;
  signature_data: string;
  signed_at: string;
  verificateur_nom?: string;
  verificateur_organisme?: string;
  verificateur_contact?: string;
  observations_signature?: string;
};

interface Props {
  item: RegistreItem;
  entreprise: EntrepriseInfo | null;
  signature?: RegistreSignature | null;
}

function formatDateFR(d: string | null): string {
  if (!d) return '…………………………';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function computeNextDate(lastDate: string | null, periodicite: string): string {
  if (!lastDate) return '—';
  const d = new Date(lastDate + 'T12:00:00');
  const p = periodicite.toLowerCase();
  switch (p) {
    case 'mensuelle':     d.setMonth(d.getMonth() + 1); break;
    case 'trimestrielle': d.setMonth(d.getMonth() + 3); break;
    case 'semestrielle':  d.setMonth(d.getMonth() + 6); break;
    case 'annuelle':      d.setFullYear(d.getFullYear() + 1); break;
    case 'triennale':     d.setFullYear(d.getFullYear() + 3); break;
    case 'quinquennale':  d.setFullYear(d.getFullYear() + 5); break;
    default: return '—';
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function extractVille(adresse: string | null | undefined): string {
  if (!adresse?.trim()) return '';
  const parts = adresse.split(/[,\n]+/);
  const last = parts[parts.length - 1].trim();
  const match = last.match(/\d{5}\s+(.+)/);
  if (match) return match[1].trim();
  if (/\d{5}/.test(last)) return '';
  return last;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #d1d5db',
  minHeight: 32,
};

const LABEL_STYLE: React.CSSProperties = {
  width: '40%',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  backgroundColor: '#f9fafb',
  borderRight: '1px solid #d1d5db',
  display: 'flex',
  alignItems: 'center',
};

const VALUE_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 13,
  color: '#111827',
  display: 'flex',
  alignItems: 'center',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={ROW_STYLE}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={VALUE_STYLE}>{value}</div>
    </div>
  );
}

export default function FicheVerification({ item, entreprise, signature }: Props) {
  const nextDate = computeNextDate(item.date_verification, item.periodicite);
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ville = extractVille(entreprise?.adresse);

  const signedDate = signature
    ? new Date(signature.signed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  const isImageLogo = entreprise?.logo_url && /\.(png|jpe?g|gif|webp)$/i.test(entreprise.logo_url);

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    color: '#000000',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    padding: '0',
    maxWidth: '210mm',
    margin: '0 auto',
    fontSize: 13,
  };

  const blockStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  };

  const blockTitleStyle: React.CSSProperties = {
    backgroundColor: '#1e3a5f',
    color: '#ffffff',
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div className="fiche-print-area" style={containerStyle}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #1e3a5f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isImageLogo && (
            <img
              src={entreprise!.logo_url!}
              alt="Logo"
              style={{ height: 52, width: 'auto', objectFit: 'contain' }}
            />
          )}
          <div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#111827', margin: 0 }}>
              {entreprise?.nom ?? '—'}
            </p>
            {(entreprise?.type_erp || entreprise?.categorie_erp) && (
              <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0 0' }}>
                ERP type {entreprise?.type_erp ?? '—'} – {entreprise?.categorie_erp ?? '—'}e catégorie
              </p>
            )}
            {entreprise?.siret && (
              <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0 0' }}>
                SIRET : {entreprise.siret}
              </p>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: '#1e3a5f', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Fiche de vérification
          </p>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f', margin: '2px 0 0 0', textTransform: 'uppercase' }}>
            de sécurité
          </p>
          <p style={{ fontSize: 10, color: '#6b7280', margin: '4px 0 0 0' }}>
            Registre de sécurité — art. R123-51 CCH
          </p>
        </div>
      </div>

      {/* ── Installation vérifiée ── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Installation vérifiée</div>
        <InfoRow label="Installation" value={item.installation} />
        <InfoRow label="Référence réglementaire" value={item.reference_reglementaire || '—'} />
        <InfoRow label="Vérificateur (organisme)" value={item.organisme_verificateur || '—'} />
        <InfoRow label="Périodicité" value={item.periodicite} />
      </div>

      {/* ── Vérification ── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Vérification</div>
        <InfoRow label="Date de la vérification" value={formatDateFR(item.date_verification)} />
        <InfoRow label="Prochaine échéance" value={nextDate} />
        <InfoRow
          label="Nom du vérificateur"
          value={item.nom_verificateur?.trim() ? item.nom_verificateur : '…………………………'}
        />
      </div>

      {/* ── Observations ── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Observations</div>
        <div style={{ padding: '10px 12px', minHeight: 54, fontSize: 13, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {item.observations?.trim() || 'Néant'}
        </div>
      </div>

      {/* ── Levée des observations ── */}
      <div style={blockStyle}>
        <div style={blockTitleStyle}>Levée des observations</div>
        <div style={{ padding: '10px 12px', minHeight: 44, fontSize: 13, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {item.observations_levees?.trim() || '—'}
        </div>
      </div>

      {/* ── Visa ── */}
      <div style={{ ...blockStyle, marginBottom: 20 }}>
        <div style={blockTitleStyle}>Visa et date du vérificateur</div>
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Zone signature */}
          <div style={{ flex: 2, minHeight: 90, borderRight: '1px solid #d1d5db', padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {signature ? (
              <>
                <img
                  src={signature.signature_data}
                  alt="Signature"
                  style={{ maxHeight: 64, width: 'auto', objectFit: 'contain', marginBottom: 6 }}
                />
                <p style={{ fontSize: 10, color: '#374151', margin: '0 0 2px 0' }}>
                  Signé par {signature.signataire_nom} ({signature.signataire_role})
                </p>
                {signature.verificateur_nom && (
                  <p style={{ fontSize: 10, color: '#374151', margin: '0 0 2px 0' }}>
                    Vérificateur : {signature.verificateur_nom}
                    {signature.verificateur_organisme ? ` — ${signature.verificateur_organisme}` : ''}
                  </p>
                )}
                {signature.verificateur_contact && (
                  <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px 0' }}>
                    Contact : {signature.verificateur_contact}
                  </p>
                )}
                {signature.observations_signature && (
                  <p style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', margin: 0 }}>
                    Observations : {signature.observations_signature}
                  </p>
                )}
              </>
            ) : (
              <div style={{ minHeight: 64, borderBottom: '1px solid #9ca3af', width: '80%' }} />
            )}
          </div>
          {/* Fait à */}
          <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
              Fait à{' '}
              <span style={{ fontWeight: ville ? 600 : 400 }}>
                {ville || '………………………'}
              </span>
              {' '}le{' '}
              <span style={{ fontWeight: signedDate ? 600 : 400 }}>
                {signedDate || '………………………'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Pied de page ── */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, textAlign: 'center' }}>
        <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
          Document établi conformément à l'art. R123-51 du Code de la construction et de l'habitation — édité le {today}
        </p>
        {item.reprise_papier && (
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
            ⚠ Données issues du registre de sécurité papier antérieur — à remplacer lors de la prochaine vérification.
          </p>
        )}
      </div>

    </div>
  );
}
