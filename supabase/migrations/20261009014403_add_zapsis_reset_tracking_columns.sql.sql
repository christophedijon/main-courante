/*
# Add columns for ZAPSIS reset counter and cumulative entries

## Purpose
sync_jauge_zapsis Case 3 needs to track:
- How many consecutive ZAPSIS readings have been below baseline (to confirm a real reset)
- entrees_cumulees_avant_reset: entries counted before a confirmed ZAPSIS reset, preserved

## Security
- No RLS changes. Columns are nullable with defaults, no data loss.
*/

ALTER TABLE jauge_etat
  ADD COLUMN IF NOT EXISTS zapsis_low_readings integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entrees_cumulees_avant_reset integer DEFAULT 0;
