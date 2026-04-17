
-- CSV import history tracking table
CREATE TABLE public.csv_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_details jsonb DEFAULT '[]'::jsonb,
  import_mode text NOT NULL DEFAULT 'create_new',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

-- Only admins can manage csv_imports
CREATE POLICY "Admins can manage csv_imports"
  ON public.csv_imports
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
