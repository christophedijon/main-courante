/*
# Tâche planifiée des statistiques de soirée

1. Nouvelle tâche
- `stats-soiree-cron` : chaque jour à 08:00 UTC, recalcule les trois dernières soirées closes de chaque établissement ayant une activité.
- Idempotent : relancer la tâche produit le même résultat.
- Aucune clé d'accès n'est utilisée : la tâche appelle directement la base de données.

2. Interaction avec la purge
- La purge `jauge-snapshots-purge` (04:00 UTC) ne supprime que les instantanés de plus de 12 mois.
- La tâche recalcule uniquement les trois dernières soirées : elle ne lit jamais d'instantané proche de la purge.

3. Retour arrière
- SELECT cron.unschedule('stats-soiree-cron');
*/

SELECT cron.schedule(
  'stats-soiree-cron',
  '0 8 * * *',
  $$SELECT public.recalculer_stats_soiree_recentes();$$
);
