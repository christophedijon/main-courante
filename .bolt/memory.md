# Project memory

## Product intent & audience

- Backend reporting system for nighttime venue surveillance ("soirées") used by Direction/management staff.
- Generates nightly reports (`rapports_soiree`) from security agent event logs across multiple establishments.
- Reports are emailed automatically via Resend to a defined recipient list (5 Direction members).
- Frontend interface (React/Vite/Tailwind) for management staff to view reports and settings.
- Audience: venue security managers, direction staff, and the developer/operator running diagnostics.
- New feature: bracelet alerts (`alertes_bracelet`) — security bracelets emit alerts (battery, signal, code) captured per establishment.

## Brand personality & voice

- Technical, precise, diagnostic-oriented communication in French.
- Values transparency about limitations (e.g., HTTP response retention, email delivery unconfirmable).
- Corrects prior diagnostics openly when new evidence emerges.

## Visual design & UX direction

- React/Vite frontend with Tailwind CSS, Lucide React icons (per `.bolt/prompt`).
- `RapportsPage.tsx` is the main reports page; "Générer maintenant" button and `handleGenerate` function removed.
- No other UI pages call `rapport-soiree` with a user token — verified across `src/`.
- Tabular presentation preferred for multi-establishment comparisons and case/decision matrices.
- Report cards, sending rule, gauge, and permissions are stable — must not be modified.
- New `alertes_bracelet` table has no associated UI page yet — do not create one unless requested.

## Decisions, constraints & rationale

- **`alertes_bracelet` table (created):** Columns: `id` (uuid auto), `created_at` (timestamp auto), `bracelet_id` (text), `code` (text), `batterie` (int), `rssi` (int), `passerelle` (text), `statut` (text, default `'nouvelle'`), `etablissement_id` (uuid, NOT NULL, FK to `etablissements` ON DELETE CASCADE).
- **RLS for `alertes_bracelet`:** Anon role can INSERT only (no SELECT/UPDATE/DELETE). Authenticated users read/modify only their own establishment's alerts, same pattern as other tables. Super-admins see all.
- **Table grants tightened:** Anon gets INSERT only; authenticated users get SELECT/INSERT/UPDATE/DELETE. Residual REFERENCES and TRIGGER privileges removed.
- **Establishments table:** Name is `etablissements`. Test establishments: `08863af3-a1e2-4b90-a6c4-c2863f017494` ("Le Test"), `2cae4b7a-10d2-4d73-b545-86337585f4dc` ("sarl boite").
- **Crash recovery (validated):** Reports created after 2026-10-31 00:00 UTC with no non-test log lines are reprocessed by next cron call. Older reports never reprocessed. Reports with ≥1 successful send are never resent.
- `decisionRapportExistant` function added; dry-run output includes decision value.
- **Trigger removed:** `DROP TRIGGER IF EXISTS trg_reschedule_rapport_cron` executed; function and table preserved. Jobs 16 (06:00 UTC) and 22 (07:00 UTC) unchanged.
- Key secrecy enforced: never display, copy, or log the service role key value.
- Production function uses 15:00 UTC–07:00 UTC window (17h–9h Paris time).
- Report send decision: send if ≥1 event OR max visitors > 1 (establishment-dependent).
- Recipients: 5 Direction members; `christophelemesnil@gmail.com` NOT in list.
- Resend delivery statuses not recorded — email delivery unconfirmable.

## Open questions & assumptions

- **Edge case (raised):** If log writing fails after a successful send, crash recovery could resend the report — not yet mitigated.
- **Unresolved:** Should production window change from 15:00–07:00 UTC to 06:00–06:00 UTC? Would alter event counts and add reports for Oct 16, 29.
- **Bracelet alerts:** No UI page created for `alertes_bracelet` — may be needed in future for management staff to view/acknowledge alerts.
- Email delivery confirmation requires Resend status tracking not currently implemented.