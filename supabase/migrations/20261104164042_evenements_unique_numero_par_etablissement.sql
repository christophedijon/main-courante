-- Unicité du numéro par établissement au lieu de globale.
-- Le nouvel index est créé avant la suppression de l'ancienne contrainte, sans fenêtre sans contrôle.
-- Aucun doublon (etablissement_id, numero) n'existe (vérifié avant).

CREATE UNIQUE INDEX IF NOT EXISTS evenements_etablissement_numero_key ON public.evenements (etablissement_id, numero);

ALTER TABLE public.evenements DROP CONSTRAINT IF EXISTS evenements_numero_key;
