CREATE TABLE IF NOT EXISTS registre_signatures (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registre_id             uuid NOT NULL REFERENCES registre_securite(id) ON DELETE CASCADE,
  date_verification_signee date NOT NULL,
  signataire_id           uuid NOT NULL,
  signataire_nom          text DEFAULT '',
  signataire_role         text DEFAULT '',
  signature_data          text NOT NULL,
  signed_at               timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE registre_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registre_signatures_select"
  ON registre_signatures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "registre_signatures_insert"
  ON registre_signatures FOR INSERT
  TO authenticated
  WITH CHECK (true);
