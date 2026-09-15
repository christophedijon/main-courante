/*
# Add date_fin_validite column to user_formations

1. Modified Tables
- `user_formations`
  - Added `date_fin_validite` (date, nullable) — stores the end-of-validity date
    for a formation. Existing rows will have NULL until manually filled by
    Direction/Chef de poste. No default value is invented.

2. Security
- No RLS policy changes needed — the column is readable/writable under the
  existing user_formations policies.

3. Important Notes
- The column is nullable, so existing formations are unaffected.
- The Carte PRO mobile card displays this column (with an "Expirée" indicator
  in red if the date is past) when it is populated.
*/

ALTER TABLE public.user_formations
  ADD COLUMN IF NOT EXISTS date_fin_validite date;
