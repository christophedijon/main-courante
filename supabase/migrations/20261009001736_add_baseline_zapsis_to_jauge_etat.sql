/*
# Add baseline_zapsis column to jauge_etat

## Context
ZAPSIS returns a cumulative counter (total tickets sold since the counter started).
When a new soirée begins, this counter may still show the previous evening's total.
Without a baseline, the jauge would show 546 people present at the start of a new
evening when nobody has arrived yet.

## Changes
1. Add `baseline_zapsis` column (integer, default 0)
2. This column stores the ZAPSIS value at the start of the soirée
3. entrees_billetterie = ZAPSIS_value - baseline_zapsis (net entries for this soirée)

## Security
- No RLS changes
- Column is nullable to avoid issues with existing rows
*/

ALTER TABLE public.jauge_etat
ADD COLUMN IF NOT EXISTS baseline_zapsis integer NOT NULL DEFAULT 0;
