/*
# Fix get_public_jauge to use soiree_date() instead of CURRENT_DATE

## Context
get_public_jauge() used CURRENT_DATE to find the current evening's jauge row.
CURRENT_DATE flips at UTC midnight (01h00 or 02h00 Paris time), causing the public
jauge display to show 0 when the evening row was still under the previous date.
soiree_date() uses a 6h Paris cutoff, which correctly keeps the same evening row
for night establishments (23h-5h).

## Changes
1. Recreate get_public_jauge to use soiree_date() instead of CURRENT_DATE

## Security
- No RLS policy changes
- Function remains SECURITY DEFINER with fixed search_path
*/

CREATE OR REPLACE FUNCTION public.get_public_jauge(p_etablissement_id uuid)
RETURNS TABLE(count_actuel integer, date_soiree date, is_test boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT je.count_actuel, je.date_soiree, je.is_test
FROM public.jauge_etat je
WHERE je.etablissement_id = p_etablissement_id
AND je.is_test = false
AND je.date_soiree = public.soiree_date();
END;
$function$;
