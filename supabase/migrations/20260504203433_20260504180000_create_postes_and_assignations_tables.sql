/*
  # Création des tables postes et assignations

  ## Nouvelles tables
  - `postes` : Liste des postes de travail configurables par la Direction
    - `id` (uuid, PK)
    - `nom` (text) : Nom du poste (ex: "Entrée principale", "Parking B2")
    - `fonction` (text) : Rôle ciblé (ex: "Agent de Sécurité", "Serveur", "Tous")
    - `description` (text) : Description libre
    - `actif` (boolean) : Poste actif ou archivé
    - `ordre` (integer) : Ordre d'affichage
    - `created_at`, `updated_at`

  - `assignations` : Assignation d'un agent à un poste
    - `id` (uuid, PK)
    - `poste_id` (uuid FK → postes)
    - `agent_id` (uuid FK → auth.users)
    - `agent_nom` (text) : Copie dénormalisée pour affichage rapide
    - `agent_fonction` (text) : Copie dénormalisée
    - `assigned_by` (uuid FK → auth.users) : Qui a fait l'assignation
    - `assigned_at` (timestamptz)
    - `actif` (boolean) : Assignation active ou historique
    - Contrainte UNIQUE partielle : un agent ne peut avoir qu'une seule assignation active

  ## Sécurité
  - RLS activé sur les deux tables
  - postes : lecture pour tous les authentifiés, écriture pour les admins (Direction + Chef de poste)
  - assignations : lecture pour tous, écriture pour les admins
*/

-- ─── POSTES ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.postes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         text        NOT NULL,
  fonction    text        NOT NULL DEFAULT 'Tous',
  description text        NOT NULL DEFAULT '',
  actif       boolean     NOT NULL DEFAULT true,
  ordre       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read postes"
  ON public.postes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert postes"
  ON public.postes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can update postes"
  ON public.postes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete postes"
  ON public.postes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ─── ASSIGNATIONS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assignations (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  poste_id        uuid        NOT NULL REFERENCES public.postes(id) ON DELETE CASCADE,
  agent_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_nom       text        NOT NULL DEFAULT '',
  agent_fonction  text        NOT NULL DEFAULT '',
  assigned_by     uuid        REFERENCES auth.users(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  actif           boolean     NOT NULL DEFAULT true
);

-- Garantit qu'un agent n'a qu'une seule assignation active à la fois
CREATE UNIQUE INDEX IF NOT EXISTS assignations_one_active_per_agent
  ON public.assignations (agent_id)
  WHERE actif = true;

ALTER TABLE public.assignations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assignations"
  ON public.assignations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert assignations"
  ON public.assignations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can update assignations"
  ON public.assignations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins can delete assignations"
  ON public.assignations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_users
      WHERE auth_user_id = auth.uid()
        AND fonction IN ('Direction', 'Chef de poste')
    ) OR EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_assignations_poste_actif ON public.assignations (poste_id) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_assignations_agent ON public.assignations (agent_id);
CREATE INDEX IF NOT EXISTS idx_postes_actif_ordre ON public.postes (actif, ordre);
