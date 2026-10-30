# Project memory

## Product intent & audience

- Backend reporting system for nighttime venue surveillance ("soirées") used by Direction/management staff.
- Generates nightly reports (`rapports_soiree`) from security agent event logs across multiple establishments.
- Reports are emailed automatically via Resend to a defined recipient list (5 Direction members).
- Frontend interface (React/Vite/Tailwind) for management staff to view reports and settings.
- Audience: venue security managers, direction staff, and the developer/operator running diagnostics.

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

## Decisions, constraints & rationale

- **Crash recovery (validated):** Reports created after 2026-10-31 00:00 UTC with no non-test log lines are reprocessed by next cron call. Older reports (Oct 17, 22, 24) are NEVER reprocessed. Reports with ≥1 successful send are never resent.
- `decisionRapportExistant` function added: ignore if successful send exists; reprocess if log non-empty without successful send; else reprocess only if created after cutoff.
- Dry-run output now includes the decision value.
- **Trigger removed:** `DROP TRIGGER IF EXISTS trg_reschedule_rapport_cron` executed; function and table preserved. `rapport-soiree-8h` job absent; jobs 16 (06:00 UTC) and 22 (07:00 UTC) unchanged.
- **Interface:** "Générer maintenant" button and `handleGenerate` removed from RapportsPage. Build passes.
- Key secrecy enforced: never display, copy, or log the service role key value.
- Production function uses 15:00 UTC–07:00 UTC window (17h–9h Paris time).
- Report send decision: send if ≥1 event OR max visitors > 1 (establishment-dependent).
- Recipients: 5 Direction members; `christophelemesnil@gmail.com` NOT in list.
- Resend delivery statuses not recorded — email delivery unconfirmable.
- Rollback paths documented for each change (code revert, trigger recreation, Bolt version history).

## Open questions & assumptions

- **Edge case (raised):** If log writing fails after a successful send, crash recovery could resend the report — not yet mitigated.
- **Unresolved:** Should production window change from 15:00–07:00 UTC to 06:00–06:00 UTC? Would alter event counts and add reports for Oct 16, 29.
- Email delivery confirmation requires Resend status tracking not currently implemented.