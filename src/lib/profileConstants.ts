export const NATIONALITIES = [
  'Afghane', 'Albanaise', 'Algérienne', 'Allemande', 'Américaine', 'Andorrane', 'Angolaise',
  'Antiguaise', 'Argentine', 'Arménienne', 'Australienne', 'Autrichienne', 'Azerbaïdjanaise',
  'Bahamienne', 'Bahreïnienne', 'Bangladaise', 'Barbadienne', 'Bélarusse', 'Belge', 'Bélizienne',
  'Béninoise', 'Bhoutanaise', 'Bolivienne', 'Bosnienne', 'Botswanaise', 'Brésilienne', 'Britannique',
  'Bruneïenne', 'Bulgare', 'Burkinabè', 'Burundaise', 'Cambodgienne', 'Camerounaise', 'Canadienne',
  'Cap-verdienne', 'Centrafricaine', 'Chilienne', 'Chinoise', 'Chypriote', 'Colombienne', 'Comorienne',
  'Congolaise', 'Costaricienne', 'Croate', 'Cubaine', 'Danoise', 'Djiboutienne', 'Dominicaine',
  'Égyptienne', 'Émiratie', 'Équatorienne', 'Érythréenne', 'Espagnole', 'Est-timoraise', 'Estonienne',
  'Éthiopienne', 'Fidjienne', 'Finlandaise', 'Française', 'Gabonaise', 'Gambienne', 'Géorgienne',
  'Ghanéenne', 'Grecque', 'Grenadienne', 'Guatemaltèque', 'Guinéenne', 'Guyanienne', 'Haïtienne',
  'Hondurienne', 'Hongroise', 'Indienne', 'Indonésienne', 'Irakienne', 'Iranienne', 'Irlandaise',
  'Islandaise', 'Israélienne', 'Italienne', 'Ivoirienne', 'Jamaïcaine', 'Japonaise', 'Jordanienne',
  'Kazakhstanaise', 'Kenyane', 'Kirghize', 'Kiribatienne', 'Koweïtienne', 'Laotienne', 'Lesothane',
  'Lettone', 'Libanaise', 'Libérienne', 'Libyenne', 'Liechtensteinoise', 'Lituanienne', 'Luxembourgeoise',
  'Macédonienne', 'Malgache', 'Malaisienne', 'Malawienne', 'Maldivienne', 'Malienne', 'Maltaise',
  'Marocaine', 'Mauritanienne', 'Mauricienne', 'Mexicaine', 'Micronésienne', 'Moldave', 'Monégasque',
  'Mongole', 'Monténégrine', 'Mozambicaine', 'Namibienne', 'Néo-zélandaise', 'Népalaise', 'Nicaraguayenne',
  'Nigériane', 'Nigérienne', 'Nord-coréenne', 'Norvégienne', 'Omanaise', 'Ougandaise', 'Ouzbèque',
  'Pakistanaise', 'Palestinienne', 'Panaméenne', 'Papouasienne', 'Paraguayenne', 'Péruvienne',
  'Philippine', 'Polonaise', 'Portugaise', 'Qatarienne', 'Roumaine', 'Russe', 'Rwandaise',
  'Saint-lucienne', 'Salvadorienne', 'Saoudienne', 'Sénégalaise', 'Serbe', 'Seychelloise',
  'Sierra-léonaise', 'Singapourienne', 'Slovaque', 'Slovène', 'Somalienne', 'Soudanaise',
  'Sri-lankaise', 'Suédoise', 'Suisse', 'Surinamaise', 'Swazie', 'Syrienne', 'Tadjike',
  'Tanzanienne', 'Tchadienne', 'Tchèque', 'Thaïlandaise', 'Togolaise', 'Trinidadienne', 'Tunisienne',
  'Turkmène', 'Turque', 'Ukrainienne', 'Uruguayenne', 'Vanuataise', 'Vénézuélienne', 'Vietnamienne',
  'Yéménite', 'Zambienne', 'Zimbabwéenne',
];

export const EXEMPT_NATIONALITIES = new Set([
  'Française',
  'Allemande', 'Autrichienne', 'Belge', 'Bulgare', 'Chypriote', 'Croate', 'Danoise',
  'Espagnole', 'Estonienne', 'Finlandaise', 'Grecque', 'Hongroise', 'Irlandaise',
  'Italienne', 'Lettone', 'Lituanienne', 'Luxembourgeoise', 'Maltaise', 'Néerlandaise',
  'Polonaise', 'Portugaise', 'Roumaine', 'Slovaque', 'Slovène', 'Suédoise', 'Tchèque',
  'Islandaise', 'Liechtensteinoise', 'Norvégienne',
  'Suisse',
]);

export const TYPES_FORMATION = ['Extincteur', 'SST', 'Habili Elec', 'SIAPP1', 'SIAPP2'];

export function normalizeStr(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export function formatDateFR(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
