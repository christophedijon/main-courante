/*
# Create soiree_date_of(timestamp) function

Returns the "soirée date" (date with 6h00 Europe/Paris cutoff) for any
given timestamp. An event at 01h30 on Oct 9 belongs to the soirée of Oct 8;
an event at 06h01 on Oct 9 belongs to the soirée of Oct 9.

This mirrors the existing public.soiree_date() function which returns the
soirée date for "now", but accepts an arbitrary timestamp parameter.

1. New Functions
- `soiree_date_of(p_ts timestamptz)` — returns a date representing the
  soirée the given timestamp falls into, using Europe/Paris timezone.
  If the Paris time is before 06h00, the soirée is the previous calendar date.
*/

CREATE OR REPLACE FUNCTION public.soiree_date_of(p_ts timestamptz)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_paris_hour int;
  v_paris_date text;
BEGIN
  -- Extract Paris local time components from the timestamp
  SELECT
    EXTRACT(hour FROM p_ts AT TIME ZONE 'Europe/Paris')::int,
    to_char(p_ts AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')
  INTO v_paris_hour, v_paris_date;

  IF v_paris_hour < 6 THEN
    -- Before 6h Paris: belongs to previous day's soirée
    RETURN (v_paris_date::date) - 1;
  END IF;

  RETURN v_paris_date::date;
END;
$function$;
