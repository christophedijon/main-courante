export type Mode = 'mois' | 'annee';

export interface SoireeStat {
  date_soiree: string;
  jour_semaine: number;
  visiteurs: number;
  pic_debut: string | null;
  pic_fin: string | null;
  nb_evenements: number;
  evenements_par_categorie: Record<string, number> | null;
  saut_detecte: boolean;
  mode_jauge: string;
}

export interface HeureStat {
  date_soiree: string;
  heure_paris: number | null;
  entrees: number;
}

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const HEURES_OUVERTURE = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8];

function periodKey(date: string, mode: Mode): string {
  return mode === 'mois' ? date.slice(0, 7) : date.slice(0, 4);
}

export function availablePeriods(soirees: SoireeStat[], mode: Mode): string[] {
  return [...new Set(soirees.map(s => periodKey(s.date_soiree, mode)))].sort().reverse();
}

export function previousPeriod(key: string, mode: Mode): string {
  if (mode === 'annee') return String(Number(key) - 1);
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatPeriod(key: string, mode: Mode): string {
  if (mode === 'annee') return key;
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function joursPresents(soirees: SoireeStat[]): number[] {
  return [...new Set(soirees.map(s => s.jour_semaine))].sort((a, b) => a - b);
}

export function filterSoirees(soirees: SoireeStat[], key: string, mode: Mode, jours: Set<number>): SoireeStat[] {
  return soirees.filter(s => periodKey(s.date_soiree, mode) === key && jours.has(s.jour_semaine));
}

export interface Resume {
  visiteurs: number;
  soirees: number;
  moyenne: number;
  evenements: number;
  pour1000: number;
}

export function resume(list: SoireeStat[]): Resume {
  const visiteurs = list.reduce((acc, s) => acc + s.visiteurs, 0);
  const evenements = list.reduce((acc, s) => acc + s.nb_evenements, 0);
  const soirees = list.length;
  return {
    visiteurs,
    soirees,
    moyenne: soirees ? visiteurs / soirees : 0,
    evenements,
    pour1000: visiteurs ? (evenements / visiteurs) * 1000 : 0,
  };
}

export function ecart(actuel: number, precedent: number): { valeur: number; pourcent: number | null } {
  return {
    valeur: actuel - precedent,
    pourcent: precedent ? ((actuel - precedent) / precedent) * 100 : null,
  };
}

export function moyenneParJour(list: SoireeStat[], jours: Set<number>) {
  return [...jours].sort((a, b) => a - b).map(jour => {
    const du = list.filter(s => s.jour_semaine === jour);
    const total = du.reduce((acc, s) => acc + s.visiteurs, 0);
    return { jour, nb: du.length, moyenne: du.length ? total / du.length : 0 };
  });
}

export function profilHoraire(heures: HeureStat[], dates: Set<string>) {
  const parHeure = new Map<number, number>();
  for (const h of heures) {
    if (h.heure_paris === null || !dates.has(h.date_soiree)) continue;
    parHeure.set(h.heure_paris, (parHeure.get(h.heure_paris) ?? 0) + h.entrees);
  }
  return HEURES_OUVERTURE.map(heure => ({ heure, entrees: parHeure.get(heure) ?? 0 }));
}

export function categories(list: SoireeStat[]) {
  return list.reduce(
    (acc, s) => ({
      securite_personnes: acc.securite_personnes + (s.evenements_par_categorie?.securite_personnes ?? 0),
      ssi: acc.ssi + (s.evenements_par_categorie?.ssi ?? 0),
    }),
    { securite_personnes: 0, ssi: 0 },
  );
}

export function formatPic(s: SoireeStat): string {
  if (s.mode_jauge !== 'automatique' || !s.pic_debut || !s.pic_fin) return '—';
  return `${s.pic_debut.replace(':', 'h')} - ${s.pic_fin.replace(':', 'h')}`;
}
