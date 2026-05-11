/*
  # Registre de Sécurité — Tables et données initiales

  ## Nouvelles tables
  1. `registre_securite`
     - Chaque ligne représente une obligation de vérification réglementaire
     - Colonnes : installation, référence, organisme, périodicité, applicable,
       date_verification, nom_verificateur, observations, observations_levees, rapport_url
  2. `registre_historique`
     - Archive des vérifications précédentes par installation
     - FK vers registre_securite avec ON DELETE CASCADE

  ## Sécurité
  - RLS activé sur les deux tables
  - Accès authenticated uniquement (select/insert/update)

  ## Données
  - 26 installations pré-remplies selon la réglementation ERP française
*/

CREATE TABLE IF NOT EXISTS public.registre_securite (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  installation text NOT NULL,
  reference_reglementaire text NOT NULL,
  organisme_verificateur text NOT NULL,
  periodicite text NOT NULL,
  applicable boolean DEFAULT true,
  date_verification date,
  nom_verificateur text DEFAULT '',
  observations text DEFAULT '',
  observations_levees text DEFAULT '',
  rapport_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.registre_securite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registre_select"
  ON public.registre_securite FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "registre_insert"
  ON public.registre_securite FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "registre_update"
  ON public.registre_securite FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.registre_historique (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  registre_id uuid REFERENCES public.registre_securite(id) ON DELETE CASCADE,
  date_verification date NOT NULL,
  nom_verificateur text DEFAULT '',
  rapport_url text DEFAULT '',
  observations text DEFAULT '',
  observations_levees text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.registre_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registre_historique_select"
  ON public.registre_historique FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "registre_historique_insert"
  ON public.registre_historique FOR INSERT
  TO authenticated WITH CHECK (true);

-- Données initiales (uniquement si la table est vide)
INSERT INTO public.registre_securite (installation, reference_reglementaire, organisme_verificateur, periodicite, applicable)
SELECT * FROM (VALUES
  ('Désenfumage', 'DF 10', 'Technicien compétent', 'Annuelle', true),
  ('Installations de désenfumage mécanique asservies à un SSI de catégorie A ou B', 'MS 73 / MS 75', 'Personne ou organisme agréé', 'Triennale', true),
  ('SSI de catégorie A ou B', 'MS 73', 'Personne ou organisme agréé', 'Triennale', true),
  ('Installations de système de sécurité incendie et équipement', 'MS 73', 'Technicien compétent', 'Annuelle', true),
  ('Extincteurs et robinets d''incendie armés', 'MS 73', 'Technicien compétent', 'Annuelle', true),
  ('Installations fixes d''extinction automatique à eau', 'MS 73', 'Technicien compétent', 'Annuelle', true),
  ('Installations fixes d''extinction automatique à eau (contrôle)', 'MS 73', 'Personne ou organisme agréé', 'Triennale', true),
  ('Éclairage de sécurité', 'EC 14', 'Technicien compétent', 'Annuelle', true),
  ('Installations électriques', 'EL 19', 'Personne ou organisme agréé', 'Annuelle', true),
  ('Ascenseurs (vérification)', 'AS 8', 'Personne ou organisme agréé', 'Quinquennale', true),
  ('Ascenseurs (entretien)', 'AS 8 / AS 9', 'Technicien compétent', 'Annuelle', true),
  ('Escaliers mécaniques / monte-charge', 'AS 10', 'Personne ou organisme agréé', 'Annuelle', true),
  ('Portes automatiques (contrôle)', 'CO 48', 'Technicien compétent', 'Annuelle', true),
  ('Formation du personnel', 'MS 48', 'Organisme agréé', 'Annuelle', true),
  ('Installations de gaz combustible (entretien)', 'GZ 30', 'Technicien compétent', 'Annuelle', true),
  ('Installations de gaz combustible (contrôle)', 'GZ 30', 'Organisme agréé', 'Annuelle', true),
  ('Installations de chauffage et/ou réfrigération', 'CH 39 / CH 57 et 58', 'Technicien compétent', 'Annuelle', true),
  ('Centrale de Traitement de l''Air', 'CH 58', 'Technicien compétent', 'Annuelle', true),
  ('Ramonage', 'CH 57 et 58', 'Technicien compétent', 'Annuelle', true),
  ('Matériel de cuisson', 'GC 21 / GC 22', 'Technicien compétent', 'Annuelle', true),
  ('Hotte d''extraction des buées et graisses', 'GC 21 / GC 22', 'Technicien compétent', 'Annuelle', true),
  ('Appareils et accessoires de levage installés à demeure', 'L 57', 'Personne ou organisme agréé', 'Annuelle', true),
  ('Appareils et accessoires de levage avec déplacement', 'L 57', 'Personne ou organisme agréé', 'Semestrielle', true),
  ('Dépoussiérage des cintres, grils, fosses techniques', 'L 57 §3', 'Technicien compétent', 'Annuelle', true),
  ('Groupe électrogène', 'EL 19', 'Technicien compétent', 'Annuelle', true),
  ('Exercices d''évacuation', 'MS 46 / MS 48', 'Commission de sécurité', 'Annuelle', true)
) AS v(installation, reference_reglementaire, organisme_verificateur, periodicite, applicable)
WHERE NOT EXISTS (SELECT 1 FROM public.registre_securite LIMIT 1);
