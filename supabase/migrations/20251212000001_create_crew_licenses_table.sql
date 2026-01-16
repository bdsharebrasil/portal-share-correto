-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view crew licenses" ON public.crew_licenses;
DROP POLICY IF EXISTS "Authenticated users can manage crew licenses" ON public.crew_licenses;

-- Enable RLS if not already enabled
ALTER TABLE public.crew_licenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that allow public read and authenticated write
CREATE POLICY "Anyone can view crew licenses"
  ON public.crew_licenses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert crew licenses"
  ON public.crew_licenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update crew licenses"
  ON public.crew_licenses FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete crew licenses"
  ON public.crew_licenses FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create index for faster queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_crew_licenses_crew_member_id 
  ON public.crew_licenses(crew_member_id);
