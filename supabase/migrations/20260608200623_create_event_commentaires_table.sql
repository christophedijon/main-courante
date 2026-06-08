CREATE TABLE IF NOT EXISTS public.event_commentaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.evenements(id) ON DELETE CASCADE,
  auteur_id uuid NOT NULL,
  auteur_nom text DEFAULT '',
  auteur_role text DEFAULT '',
  contenu text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.event_commentaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read" ON public.event_commentaires
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert" ON public.event_commentaires
  FOR INSERT TO authenticated WITH CHECK (true);
