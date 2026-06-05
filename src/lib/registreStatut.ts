export type Statut = 'non_applicable' | 'non_planifie' | 'a_jour' | 'attention' | 'retard';

export type RegistreItemMin = {
  applicable: boolean;
  periodicite: string;
  date_verification: string | null;
};

export function getNextDate(lastDate: string, periodicite: string): Date | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case 'mensuelle':     d.setMonth(d.getMonth() + 1); break;
    case 'trimestrielle': d.setMonth(d.getMonth() + 3); break;
    case 'semestrielle':  d.setMonth(d.getMonth() + 6); break;
    case 'annuelle':      d.setFullYear(d.getFullYear() + 1); break;
    case 'triennale':     d.setFullYear(d.getFullYear() + 3); break;
    case 'quinquennale':  d.setFullYear(d.getFullYear() + 5); break;
    case 'sans':          return null;
    default:              return null;
  }
  return d;
}

export function getStatut(
  lastDate: string | null,
  periodicite: string,
  applicable: boolean,
): Statut {
  if (!applicable) return 'non_applicable';
  if (periodicite.toLowerCase() === 'sans') return 'non_applicable';
  if (!lastDate) return 'non_planifie';
  const next = getNextDate(lastDate, periodicite);
  if (!next) return 'non_planifie';
  const diff = next.getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'retard';
  if (days < 90) return 'attention';
  return 'a_jour';
}

export type ConformiteResult = {
  pct: number;
  total: number;
  conformes: number;
  nbRetard: number;
  nbNonPlanifie: number;
  nbAttention: number;
  nbAJour: number;
  couleur: 'rouge' | 'orange' | 'vert';
};

export function computeConformite(items: RegistreItemMin[]): ConformiteResult {
  const planifiables = items.filter(
    (it) => it.applicable && it.periodicite.toLowerCase() !== 'sans',
  );

  let nbRetard = 0;
  let nbNonPlanifie = 0;
  let nbAttention = 0;
  let nbAJour = 0;

  for (const it of planifiables) {
    const s = getStatut(it.date_verification, it.periodicite, it.applicable);
    if (s === 'retard') nbRetard++;
    else if (s === 'non_planifie') nbNonPlanifie++;
    else if (s === 'attention') nbAttention++;
    else if (s === 'a_jour') nbAJour++;
  }

  const total = planifiables.length;
  const conformes = nbAJour + nbAttention;
  const pct = total === 0 ? 100 : Math.round((conformes / total) * 100);

  let couleur: 'rouge' | 'orange' | 'vert';
  if (nbRetard > 0 || nbNonPlanifie > 0) couleur = 'rouge';
  else if (nbAttention > 0) couleur = 'orange';
  else couleur = 'vert';

  return { pct, total, conformes, nbRetard, nbNonPlanifie, nbAttention, nbAJour, couleur };
}
