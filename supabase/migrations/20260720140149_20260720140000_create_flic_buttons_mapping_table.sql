/*
# Create flic_buttons mapping table (fix: all Flic buttons wrote SARL BALGY's jauge)

## Context
The flic-jauge edge function selected the target establishment with
.in('statut', ['essai','actif']).order('enseigne').limit(1) — i.e. the first
active establishment alphabetically, with no link to the physical button that
triggered the webhook. With several establishments active at once, every Flic
button in the field modified the same establishment's jauge (currently SARL
BALGY). See prior diagnostic.

## Changes

### 1. New table: flic_buttons
Maps a physical Flic button (identified by its hub MAC + optional button id)
to the establishment whose jauge it should drive.

- id          uuid PK
- etablissement_id  uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE
- button_mac  text NOT NULL  — MAC address of the Flic Hub (e.g. "90:88:a9:5b:10:fb")
- button_bid  text           — button identifier within the hub (nullable when a
                               single button is paired to the hub)
- created_at  timestamptz DEFAULT now()

Unique constraint on (button_mac, button_bid) so the same physical button can't
be mapped to two establishments. A partial unique constraint on button_mac
alone (WHERE button_bid IS NULL) prevents two "single-button" hubs from
colliding on the same MAC.

### 2. Security
- RLS enabled.
- Policies follow the existing _isolation pattern: the owning establishment
  (etablissement_id = get_my_entreprise_id()) or a super admin can read/write.
  WITH CHECK mirrors USING on all write policies so cross-tenant inserts are
  rejected. The flic-jauge edge function uses the service role key and bypasses
  RLS, so it can read any mapping.

### 3. Index
- Index on button_mac (and button_mac, button_bid) for the webhook lookup path.
*/
CREATE TABLE IF NOT EXISTS public.flic_buttons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  button_mac       text NOT NULL,
  button_bid       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flic_buttons ENABLE ROW LEVEL SECURITY;

-- A given physical button maps to exactly one establishment.
CREATE UNIQUE INDEX IF NOT EXISTS flic_buttons_mac_bid_uniq
  ON public.flic_buttons (button_mac, button_bid);

-- A hub used in single-button mode (button_bid NULL) maps to one establishment.
CREATE UNIQUE INDEX IF NOT EXISTS flic_buttons_mac_only_uniq
  ON public.flic_buttons (button_mac)
  WHERE button_bid IS NULL;

CREATE INDEX IF NOT EXISTS flic_buttons_lookup_idx
  ON public.flic_buttons (button_mac, button_bid);

DROP POLICY IF EXISTS "flic_buttons_select_isolation" ON public.flic_buttons;
CREATE POLICY "flic_buttons_select_isolation"
  ON public.flic_buttons FOR SELECT TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "flic_buttons_insert_isolation" ON public.flic_buttons;
CREATE POLICY "flic_buttons_insert_isolation"
  ON public.flic_buttons FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "flic_buttons_update_isolation" ON public.flic_buttons;
CREATE POLICY "flic_buttons_update_isolation"
  ON public.flic_buttons FOR UPDATE TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()))
  WITH CHECK (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));

DROP POLICY IF EXISTS "flic_buttons_delete_isolation" ON public.flic_buttons;
CREATE POLICY "flic_buttons_delete_isolation"
  ON public.flic_buttons FOR DELETE TO authenticated
  USING (is_super_admin() OR (etablissement_id = get_my_entreprise_id()));
