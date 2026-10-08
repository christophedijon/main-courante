/*
# Add read_at column to signatures table

## Purpose
When a user signs a document, we now record not only the signature timestamp (signed_at)
but also when they completed reading the document (read_at). This supports the new
mandatory-read feature: the user must scroll to the bottom AND check "I have read and
understood" before signing.

## Changes
1. New column: `signatures.read_at` (timestamptz, nullable)
   - Set to `now()` at the moment the user confirms they have read the document
   - Nullable for backward compatibility with existing signatures

## Security
No RLS changes needed — the existing policies on `signatures` already cover
the new column (same table, same etablissement_id scoping).
*/

ALTER TABLE public.signatures
ADD COLUMN IF NOT EXISTS read_at timestamptz;
