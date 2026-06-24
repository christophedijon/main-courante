export type EspaceItem = { nom: string; couleur: string };
export type ZoneItem = { nom: string; categorie: string; capacite: number | '' };
export type NiveauItem = { nom: string; ordre: number };
export type VerificateurItem = {
  nom: string;
  type: string;
  organisme: string;
  personne: string;
  telephone: string;
  email: string;
  prochaine_visite: string;
};

export type OnboardingData = {
  nom: string;
  siret: string;
  type_erp: 'N' | 'P' | 'L' | '';
  effectif_public: number | '';
  plan: 'light' | 'base' | 'premium';
  essai_duree_jours: number;
  direction_prenom: string;
  direction_nom: string;
  direction_email: string;
  direction_telephone: string;
  direction_user_id?: string;
  direction_managed_id?: string;
  espaces: EspaceItem[];
  zones: ZoneItem[];
  niveaux: NiveauItem[];
  verificateurs: VerificateurItem[];
  flic_hub_enabled: boolean;
  flic_hub_mac: string;
  zapsis_enabled: boolean;
  zapsis_api_key: string;
  ble_rondes_enabled: boolean;
  ble_rondes_nombre: number | '';
};

export const INITIAL_DATA: OnboardingData = {
  nom: '', siret: '', type_erp: '', effectif_public: '', plan: 'light', essai_duree_jours: 30,
  direction_prenom: '', direction_nom: '', direction_email: '', direction_telephone: '',
  espaces: [], zones: [], niveaux: [],
  verificateurs: [],
  flic_hub_enabled: false, flic_hub_mac: '',
  zapsis_enabled: false, zapsis_api_key: '',
  ble_rondes_enabled: false, ble_rondes_nombre: '',
};

export const TEMPLATES_STRUCTURE = {
  discotheque: {
    espaces: [
      { nom: 'Piste', couleur: '#6366f1' },
      { nom: 'Bar', couleur: '#3b82f6' },
      { nom: 'Vestiaire', couleur: '#64748b' },
      { nom: 'VIP', couleur: '#f59e0b' },
    ],
    zones: [
      { nom: 'Entrée principale', categorie: 'acces_public', capacite: '' as const },
      { nom: 'Piste de danse', categorie: 'securite_personnes', capacite: '' as const },
      { nom: 'Bar central', categorie: 'securite_personnes', capacite: '' as const },
      { nom: 'Espace VIP', categorie: 'securite_personnes', capacite: '' as const },
      { nom: 'Sortie de secours', categorie: 'sortie_secours', capacite: '' as const },
    ],
    niveaux: [
      { nom: 'RDC', ordre: 1 },
      { nom: 'Étage 1', ordre: 2 },
    ],
  },
};

export const TEMPLATES_POSTES = {
  discotheque: [
    { nom: 'Check de mise en exploitation', fonction: 'Chef de poste', description: 'Vérifier tous les déclencheurs manuels, issues de secours et équipements SSI avant ouverture.', ordre: 1 },
    { nom: 'Filtrage entrée principale', fonction: 'Agent de Sécurité', description: "Assurer le filtrage des clients à l'entrée, vérification des pièces d'identité et contrôle de la capacité.", ordre: 2 },
    { nom: "Contrôle d'accès", fonction: 'Agent de Sécurité', description: 'Palpation de sécurité, gestion du vestiaire et surveillance des accès restreints.', ordre: 3 },
    { nom: 'Surveillance piste', fonction: 'Agent de Sécurité', description: "Surveillance de la piste de danse, gestion de l'affluence et intervention sur incidents.", ordre: 4 },
    { nom: 'Surveillance bar', fonction: 'Agent de Sécurité', description: 'Sécurité au niveau du bar, prévention des débordements et coordination avec le service.', ordre: 5 },
    { nom: 'Ronde générale', fonction: 'Agent de Sécurité', description: 'Vérification horaire de toutes les zones : issues, sanitaires, extérieur.', ordre: 6 },
  ],
  bar: [
    { nom: 'Check de mise en exploitation', fonction: 'Chef de poste', description: "Vérification de l'établissement avant ouverture au public.", ordre: 1 },
    { nom: 'Accueil / Filtrage', fonction: 'Agent de Sécurité', description: "Filtrage à l'entrée et accueil des clients.", ordre: 2 },
    { nom: 'Surveillance salle', fonction: 'Agent de Sécurité', description: 'Surveillance de la salle et gestion des incidents.', ordre: 3 },
    { nom: 'Sortie / Fin de service', fonction: 'Agent de Sécurité', description: 'Gestion de la sortie progressive des clients et sécurisation de la fermeture.', ordre: 4 },
  ],
  salle: [
    { nom: 'Briefing événement', fonction: 'Chef de poste', description: "Briefing pré-événement avec toute l'équipe de sécurité.", ordre: 1 },
    { nom: 'Accueil VIP', fonction: 'Agent de Sécurité', description: 'Accueil et escorte des invités VIP, vérification des accréditations.', ordre: 2 },
    { nom: 'Vestiaire', fonction: 'Agent de Sécurité', description: 'Tenue du vestiaire et gestion des effets personnels.', ordre: 3 },
    { nom: 'Régie / Surveillance technique', fonction: 'Agent de Sécurité', description: "Surveillance de la régie technique et des accès backstage.", ordre: 4 },
    { nom: 'Sortie événement', fonction: 'Agent de Sécurité', description: "Gestion ordonnée de la sortie du public en fin d'événement.", ordre: 5 },
  ],
};

export const CATEGORIE_LABELS: Record<string, string> = {
  securite_personnes: 'Sécurité personnes',
  sortie_secours: 'Sortie de secours',
  acces_public: 'Accès public',
  zone_service: 'Zone service',
};

export const TYPE_ERP_LABELS: Record<string, string> = {
  N: 'Type N — Discothèque',
  P: 'Type P — Bar / débit de boissons',
  L: 'Type L — Restaurant / café / salle polyvalente',
};

export const PLAN_INFO = {
  light: { label: 'Light', price: 'Gratuit 30j', color: 'text-emerald-400', border: 'border-emerald-500/40 bg-emerald-500/5' },
  base: { label: 'Base', price: '79 € / mois', color: 'text-blue-400', border: 'border-blue-500/40 bg-blue-500/5' },
  premium: { label: 'Premium', price: '149 € / mois', color: 'text-amber-400', border: 'border-amber-500/40 bg-amber-500/5' },
};
