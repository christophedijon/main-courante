/**
 * Calcule la date de la soiree courante en fuseau Europe/Paris.
 * Si l'heure locale est avant 6h du matin, la soiree est celle de la veille.
 * Cela permet aux etablissements ouverts la nuit (ex: 23h-5h) d'avoir
 * une seule ligne de jauge pour toute la soiree.
 *
 * Doit retourner la meme valeur que la fonction SQL public.soiree_date().
 */
export function soireeDate(): string {
  const now = new Date();
  const parisTime = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const parts: Record<string, string> = {};
  for (const p of parisTime) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }

  const hour = parseInt(parts.hour, 10);
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;

  if (hour < 6) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().slice(0, 10);
  }

  return dateStr;
}

/**
 * Renvoie l'instant de debut de la soiree courante (6h00 Europe/Paris
 * de la date renvoyee par soireeDate()) en ISO UTC, pour filtrer par
 * created_at >= ... dans des requetes Supabase.
 *
 * Utilise Intl pour determiner le fuseau reel (gestion DST automatique).
 */
export function soireeStartISO(): string {
  const sd = soireeDate();
  const [y, m, d] = sd.split('-').map(Number);
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parisFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(noonUTC);
  const [ph, pm] = parisFmt.split(':').map(Number);
  const offsetMin = (ph * 60 + pm) - 12 * 60;
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const om = String(absMin % 60).padStart(2, '0');
  return `${sd}T06:00:00${sign}${oh}:${om}`;
}

/**
 * Renvoie l'instant de debut (06h00 Europe/Paris) d'une soiree donnee
 * par sa date (format YYYY-MM-DD), en ISO UTC avec offset.
 */
export function soireeStartISOForDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parisFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(noonUTC);
  const [ph, pm] = parisFmt.split(':').map(Number);
  const offsetMin = (ph * 60 + pm) - 12 * 60;
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const om = String(absMin % 60).padStart(2, '0');
  return `${dateStr}T06:00:00${sign}${oh}:${om}`;
}

/**
 * Renvoie l'instant de fin (06h00 Europe/Paris du lendemain) d'une soiree
 * donnee par sa date (format YYYY-MM-DD), en ISO UTC avec offset.
 */
export function soireeEndISOForDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = next.toISOString().slice(0, 10);
  return soireeStartISOForDate(nextStr);
}

/**
 * Calcule la date de soirée d'un instant quelconque (UTC ISO string ou Date).
 * Même logique que soireeDate() mais pour un horodatage arbitraire.
 * Doit retourner la même valeur que la fonction SQL public.soiree_date_of(ts).
 */
export function soireeDateOf(ts: string | Date): string {
  const date = typeof ts === 'string' ? new Date(ts) : ts;
  const parisTime = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const parts: Record<string, string> = {};
  for (const p of parisTime) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }

  const hour = parseInt(parts.hour, 10);
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;

  if (hour < 6) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().slice(0, 10);
  }

  return dateStr;
}

/**
 * Formate une date de soirée pour l'affichage en français.
 * Ex: "2026-10-08" → "Soirée du 8 octobre"
 */
export function formatSoireeLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric' });
  const mois = d.toLocaleDateString('fr-FR', { month: 'long' });
  return `Soirée du ${jour} ${mois}`;
}
