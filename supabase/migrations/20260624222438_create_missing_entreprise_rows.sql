
INSERT INTO entreprise (nom, adresse, telephone, etablissement_id)
VALUES
  ('Chez Greggy',  '', '', '202ff6f9-412d-4ed6-98bc-800f8659fe98'),
  ('Le Club Test', '', '', 'dd9d62d7-f939-4937-b8cb-ae52326425d3')
ON CONFLICT DO NOTHING;
