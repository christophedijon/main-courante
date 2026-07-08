ALTER TABLE email_rules
  ADD CONSTRAINT email_rules_etablissement_type_key
  UNIQUE (etablissement_id, type);