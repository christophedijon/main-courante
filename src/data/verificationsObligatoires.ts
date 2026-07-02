export type VerificationItem = {
  id: string;
  nom: string;
  reference: string;
  frequence: 'Annuelle' | 'Semestrielle' | 'Ponctuelle';
  description: string;
  preChecked: boolean;
  categorie: 'obligatoire' | 'frequente' | 'equipement' | 'type_p' | 'type_n';
};

export const VERIFICATIONS_OBLIGATOIRES: VerificationItem[] = [
  { id: 'elec', nom: 'Installations électriques', reference: 'Art. EL 19', frequence: 'Annuelle', description: 'Vérification par organisme agréé ou technicien compétent', preChecked: true, categorie: 'obligatoire' },
  { id: 'baes', nom: 'Éclairage de sécurité / BAES', reference: 'Art. EC 15', frequence: 'Annuelle', description: 'Blocs autonomes, signalisation, balisage', preChecked: true, categorie: 'obligatoire' },
  { id: 'extincteurs', nom: 'Extincteurs', reference: 'Art. MS 73', frequence: 'Annuelle', description: 'Vérification et maintenance par organisme agréé', preChecked: true, categorie: 'obligatoire' },
  { id: 'ssi', nom: 'SSI (Système Sécurité Incendie)', reference: 'Art. MS 56', frequence: 'Annuelle', description: 'Détection incendie, alarme, compartimentage', preChecked: false, categorie: 'frequente' },
  { id: 'desenfumage', nom: 'Désenfumage', reference: 'Art. DF 10', frequence: 'Annuelle', description: 'Exutoires, volets, ventilateurs de désenfumage', preChecked: false, categorie: 'frequente' },
  { id: 'chauffage', nom: 'Chauffage / Climatisation', reference: 'Art. CH 58', frequence: 'Annuelle', description: 'Chaudières, CTA, climatiseurs, VMC', preChecked: false, categorie: 'frequente' },
  { id: 'gaz', nom: 'Installation gaz', reference: 'Art. GC 22', frequence: 'Annuelle', description: 'Canalisations, robinets, détecteurs gaz', preChecked: false, categorie: 'frequente' },
  { id: 'ria', nom: 'RIA (Robinets Incendie Armés)', reference: 'Art. MS 73', frequence: 'Annuelle', description: 'Pression, débit, état des tuyaux', preChecked: false, categorie: 'frequente' },
  { id: 'ascenseurs', nom: 'Ascenseurs', reference: 'Art. AS 9', frequence: 'Semestrielle', description: 'Contrôle technique par organisme agréé', preChecked: false, categorie: 'equipement' },
  { id: 'portes_auto', nom: 'Portes automatiques', reference: 'Art. CO 48', frequence: 'Annuelle', description: 'Portes coulissantes, tambour, battantes motorisées', preChecked: false, categorie: 'equipement' },
  { id: 'cuisine', nom: 'Cuisine / Appareils de cuisson', reference: 'Art. GC 22', frequence: 'Annuelle', description: 'Hotte, extraction, appareils de cuisson pro', preChecked: false, categorie: 'equipement' },
  { id: 'colonnes_seches', nom: 'Colonnes sèches', reference: 'Art. MS 73', frequence: 'Annuelle', description: 'Pression, raccords, signalisation', preChecked: false, categorie: 'equipement' },
  { id: 'limiteur_son', nom: 'Limiteur de son', reference: 'Décret 2017-1244', frequence: 'Annuelle', description: 'Calibration et contrôle du limiteur de pression acoustique', preChecked: false, categorie: 'type_p' },
  { id: 'impact_sonore', nom: "Étude d'impact sonore", reference: 'Décret 2017-1244', frequence: 'Ponctuelle', description: "Étude d'impact des nuisances sonores sur le voisinage", preChecked: false, categorie: 'type_p' },
  { id: 'hotte_extraction', nom: 'Hotte / Extraction cuisine', reference: 'Art. GC 22', frequence: 'Annuelle', description: 'Nettoyage et vérification du système extraction', preChecked: false, categorie: 'type_n' },
];
