DELETE FROM etablissements
WHERE statut = 'brouillon'
  AND nom IN ('Nouvel établissement', 'Test');
