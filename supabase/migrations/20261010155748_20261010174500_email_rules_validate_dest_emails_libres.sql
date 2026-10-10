/*
# Validation trigger for email_rules.dest_emails_libres

## Purpose
Enforce server-side validation on the dest_emails_libres array column:
- Maximum 5 free email addresses
- Each address must match a valid email format
- Duplicates are removed automatically (deduplication)
- Empty/whitespace-only entries are removed
- Applies to ALL email_rules rows (both rapport_soiree and registre_securite)

## How it works
A BEFORE INSERT OR UPDATE trigger calls the validate_dest_emails_libres()
function, which:
1. Returns NULL (no change) if dest_emails_libres is NULL or empty
2. Trims each entry, removes empty strings
3. Validates each against a basic email regex
4. Deduplicates (case-insensitive)
5. Raises an exception if more than 5 entries remain
6. Returns the cleaned array as the new value for the column

## Security
This is a data integrity trigger, not a security boundary. It runs with
the privileges of the invoking user (SECURITY INVOKER). The RLS policies
on email_rules already restrict access to Direction users only.
*/

-- Create the validation function
CREATE OR REPLACE FUNCTION public.validate_dest_emails_libres()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned text[] := '{}';
  entry text;
  lower_entry text;
  seen text[] := '{}';
  email_regex text := '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
BEGIN
  -- If column is null or empty array, leave as-is
  IF NEW.dest_emails_libres IS NULL OR array_length(NEW.dest_emails_libres, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Process each entry
  FOREACH entry IN ARRAY NEW.dest_emails_libres LOOP
    entry := btrim(entry);
    IF entry = '' OR entry IS NULL THEN
      CONTINUE;
    END IF;

    -- Validate email format
    IF NOT (entry ~ email_regex) THEN
      RAISE EXCEPTION 'Adresse e-mail invalide: %', entry;
    END IF;

    -- Deduplicate (case-insensitive)
    lower_entry := lower(entry);
    IF NOT (lower_entry = ANY(seen)) THEN
      seen := array_append(seen, lower_entry);
      cleaned := array_append(cleaned, entry);
    END IF;
  END LOOP;

  -- Enforce max 5
  IF array_length(cleaned, 1) > 5 THEN
    RAISE EXCEPTION 'Maximum 5 adresses e-mail libres autorisées (vous en avez fourni %)', array_length(cleaned, 1);
  END IF;

  NEW.dest_emails_libres := cleaned;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_validate_dest_emails_libres ON email_rules;

CREATE TRIGGER trg_validate_dest_emails_libres
  BEFORE INSERT OR UPDATE OF dest_emails_libres ON email_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dest_emails_libres();
