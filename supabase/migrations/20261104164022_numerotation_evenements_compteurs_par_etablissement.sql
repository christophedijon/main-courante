-- Numérotation des événements sans trou, par établissement et par année.
-- Un compteur par (établissement, année), incrémenté atomiquement dans la transaction de la saisie :
-- une transaction annulée ne consomme aucun numéro. Les numéros existants ne sont pas modifiés.
-- L'ancienne séquence evenement_numero_seq est conservée mais n'est plus utilisée.

CREATE TABLE IF NOT EXISTS public.evenement_compteurs (
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  annee integer NOT NULL,
  dernier_numero integer NOT NULL CHECK (dernier_numero >= 0),
  PRIMARY KEY (etablissement_id, annee)
);

ALTER TABLE public.evenement_compteurs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evenement_compteurs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prochain_numero_evenement(p_etablissement_id uuid, p_horodatage timestamptz)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_annee integer;
  v_numero integer;
BEGIN
  IF p_etablissement_id IS NULL THEN
    RAISE EXCEPTION 'etablissement_id requis pour numeroter un evenement' USING ERRCODE = '22004';
  END IF;
  v_annee := extract(year FROM (p_horodatage AT TIME ZONE 'Europe/Paris'))::integer;
  INSERT INTO public.evenement_compteurs (etablissement_id, annee, dernier_numero)
  VALUES (p_etablissement_id, v_annee, 1)
  ON CONFLICT (etablissement_id, annee)
  DO UPDATE SET dernier_numero = public.evenement_compteurs.dernier_numero + 1
  RETURNING dernier_numero INTO v_numero;
  RETURN v_annee::text || '-' || lpad(v_numero::text, 6, '0');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.prochain_numero_evenement(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_evenement_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.prochain_numero_evenement(NEW.etablissement_id, now());
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_evenement_numero() FROM PUBLIC, anon, authenticated;

INSERT INTO public.evenement_compteurs (etablissement_id, annee, dernier_numero)
SELECT etablissement_id, substring(numero FROM 1 FOR 4)::integer, max(substring(numero FROM 6)::integer)
FROM public.evenements
WHERE numero ~ '^\d{4}-\d{6}$' AND etablissement_id IS NOT NULL
GROUP BY etablissement_id, substring(numero FROM 1 FOR 4)::integer
ON CONFLICT (etablissement_id, annee) DO NOTHING;
