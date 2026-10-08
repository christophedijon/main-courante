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
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  return dateStr;
}
