/*
# Lock EXECUTE on 7 SECURITY DEFINER functions (Lot A)

## Context
Audit étape 3/5. Seven functions that should NOT be callable by authenticated users
(or by anyone except service_role / postgres / trigger-owner) still have
EXECUTE granted to authenticated. This migration revokes that access.

## Functions locked
1. open_test_session(uuid, timestamptz)        — dead function (writes to dropped table `entreprise`), no caller
2. open_exceptional_session(uuid, timestamptz)  — dead function (writes to dropped table `entreprise`), no caller
3. close_exceptional_session(uuid)              — dead function (writes to dropped table `entreprise`), no caller
4. expirer_essais()                             — intended for cron only, no caller (check-trial-reminders does the work)
5. set_service_role_key(text)                   — superseded by store_service_role_key, no caller
6. reschedule_rapport_cron(text)                — called only via trigger, not directly by users
7. trg_fn_reschedule_rapport_cron()             — trigger function, should not be callable via RPC

## Changes
For each function: REVOKE EXECUTE FROM PUBLIC, anon, authenticated.
service_role and postgres retain EXECUTE (not revoked).

## Rollback
To restore previous state, for each function run:
  GRANT EXECUTE ON FUNCTION public.<name>(<signature>) TO authenticated, service_role;
(see full rollback commands in the PR / audit notes)

## Safety
- No function bodies modified.
- No functions dropped.
- No tables, triggers, or cron jobs touched.
- The trigger `trg_reschedule_rapport_cron` on `rapport_email_settings` continues to fire;
  the trigger function runs with SECURITY DEFINER (owner: postgres) regardless of caller role.
*/

REVOKE EXECUTE ON FUNCTION public.open_test_session(uuid, timestamp with time zone)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_exceptional_session(uuid, timestamp with time zone)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_exceptional_session(uuid)                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expirer_essais()                                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_service_role_key(text)                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reschedule_rapport_cron(text)                             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_reschedule_rapport_cron()                          FROM PUBLIC, anon, authenticated;
