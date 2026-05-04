/*
  # Système de signature de documents

  ## Modifications toolbox_documents
  - destinataires (text[]) : rôles pouvant voir le document
  - signature_requise (boolean) : si true, l'agent doit signer
  - content_version (integer) : incrémenté à chaque modif du contenu

  ## Nouvelle table signatures
  - Enregistre chaque signature d'agent par document et version
  - Contrainte unique : un agent ne signe qu'une fois par version
  - RLS : tout utilisateur authentifié peut lire/écrire ses propres signatures

  ## Sécurité
  - RLS activé sur signatures
  - SELECT ouvert (nécessaire pour le dashboard Direction)
  - INSERT/UPDATE ouvert (la validation est faite côté app via re-auth)
*/

-- ─── Colonnes toolbox_documents ───────────────────────────────────────────────

ALTER TABLE public.toolbox_documents
  ADD COLUMN IF NOT EXISTS destinataires text[] DEFAULT '{}';

ALTER TABLE public.toolbox_documents
  ADD COLUMN IF NOT EXISTS signature_requise boolean DEFAULT false;

ALTER TABLE public.toolbox_documents
  ADD COLUMN IF NOT EXISTS content_version integer DEFAULT 1;

-- ─── Table signatures ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.signatures (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id     uuid NOT NULL REFERENCES public.toolbox_documents(id) ON DELETE CASCADE,
  agent_id        uuid NOT NULL,
  agent_nom       text NOT NULL DEFAULT '',
  agent_role      text NOT NULL DEFAULT '',
  signed_at       timestamptz DEFAULT now(),
  content_version integer NOT NULL DEFAULT 1,
  synced          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_select"
  ON public.signatures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "signatures_insert"
  ON public.signatures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "signatures_update"
  ON public.signatures FOR UPDATE
  TO authenticated
  USING (true);

-- Contrainte : un agent ne signe qu'une fois par version de document
CREATE UNIQUE INDEX IF NOT EXISTS signatures_unique_version
  ON public.signatures(document_id, agent_id, content_version);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.signatures;
