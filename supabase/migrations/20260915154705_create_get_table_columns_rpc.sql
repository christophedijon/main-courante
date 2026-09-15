-- RPC to fetch column names for a list of tables (used by export edge function)
CREATE OR REPLACE FUNCTION public.get_table_columns(table_names text[])
RETURNS TABLE (table_name text, column_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.table_name::text AS table_name,
    c.column_name::text AS column_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = ANY(table_names)
  ORDER BY c.table_name, c.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(text[]) TO authenticated;
