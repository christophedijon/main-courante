# Project memory

## Product intent & audience

- Backend reporting system for nighttime venue surveillance ("soirées") used by Direction/management staff.
- Generates nightly reports (`rapports_soiree`) from security agent event logs across multiple establishments.
- Reports are emailed automatically via Resend to a defined recipient list (5 Direction members).
- Audience: venue security managers, direction staff, and the developer/operator running diagnostics.

## Brand personality & voice

- Technical, precise, diagnostic-oriented communication in French.
- Values transparency about limitations (e.g., HTTP response retention, email delivery unconfirmable).
- Corrects prior diagnostics openly when new evidence emerges.

## Visual design & UX direction

- No UI design context inferred yet — all interactions are SQL/HTTP-level backend diagnostics.
- Tabular presentation of simulation results preferred for multi-establishment comparisons.

## Decisions, constraints & rationale

- Dry-run mode: `{"dry_run": true, "date_soiree": "<date>"}` via `net.http_post` from SQL, Authorization header built from `vault.decrypted_secrets` (name = `'service_role_key'`).
- Key secrecy enforced: never display, copy, or log the service role key value.
- No temporary functions deployed; no access controls disabled.
- Production function uses a **15:00 UTC–07:00 UTC** window (17h–9h Paris time), not the requested 06h–06h rule.
- `net._http_response` retains only recent hours (~last few days), limiting historical HTTP audit.
- Report send decision logic: send if ≥1 event OR max visitors > 1 (establishment-dependent thresholds).
- Report recipients: 5 Direction members; `christophelemesnil@gmail.com` is NOT in the recipient list.
- Resend delivery statuses are not recorded — email delivery unconfirmable.

## Open questions & assumptions

- **Unresolved:** Should the production window be changed from 15:00–07:00 UTC to the requested 06:00–06:00 UTC rule? This would reduce the 2026-10-17 count from 2 to 1 event (still triggers send) and add reports for 2026-10-16 and 2026-10-29.
- Assuming events created before 06:00 UTC are counted in the same night's report — confirmed for 2026-10-18 events (02:30 and 04:52 UTC both pre-cron).
- Email delivery confirmation requires Resend status tracking not currently implemented.