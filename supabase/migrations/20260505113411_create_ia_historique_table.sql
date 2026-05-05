/*
  # Créer la table ia_historique

  ## Résumé
  Stocke l'historique des consultations de l'assistant IA par agent.

  ## Nouvelles tables
  - `ia_historique`
    - `id` (uuid, PK)
    - `agent_id` (uuid) — référence à l'utilisateur auth
    - `agent_nom` (text) — nom complet de l'agent
    - `question` (text) — question posée
    - `reponse_complete` (text) — réponse brute de l'IA
    - `sections` (jsonb) — sections parsées
    - `created_at` (timestamptz)

  ## Sécurité
  - RLS activé
  - SELECT : tout utilisateur authentifié peut lire ses propres entrées (policy filtre via agent_id)
  - INSERT : tout utilisateur authentifié peut insérer ses propres entrées
  - DELETE : tout utilisateur authentifié peut supprimer ses propres entrées
*/

CREATE TABLE IF NOT EXISTS public.ia_historique (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  agent_nom text NOT NULL DEFAULT '',
  question text NOT NULL,
  reponse_complete text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ia_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_historique_select"
  ON public.ia_historique FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

CREATE POLICY "ia_historique_insert"
  ON public.ia_historique FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "ia_historique_delete"
  ON public.ia_historique FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

CREATE INDEX IF NOT EXISTS ia_historique_agent_id_idx ON public.ia_historique (agent_id, created_at DESC);
