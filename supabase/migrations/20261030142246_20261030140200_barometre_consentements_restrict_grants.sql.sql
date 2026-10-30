/*
# Baromètre : retrait des droits d'écriture sur le journal des consentements

1. Modification
- Retire à `authenticated`, `anon` et `PUBLIC` les droits INSERT, UPDATE, DELETE et TRUNCATE sur `barometre_consentements`.

2. Pourquoi
- La plateforme accorde par défaut tous les droits sur les nouvelles tables. Les politiques refusaient déjà l'écriture, mais le journal doit être écrit uniquement par le déclencheur.

3. Résultat
- Seule la lecture (SELECT) reste accordée à `authenticated`, soumise à la politique de lecture de la Direction.
- Le déclencheur, qui s'exécute avec les droits de son propriétaire, continue d'écrire dans le journal.
*/

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.barometre_consentements FROM PUBLIC, anon, authenticated;
