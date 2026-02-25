-- Table for absence justifications (justificativas de falta)
CREATE TABLE public.absence_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  justification TEXT NOT NULL,
  document_url TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for time correction requests (solicitações de correção de ponto)
CREATE TABLE public.time_correction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  time_entry_id UUID REFERENCES public.time_entries(id),
  correction_type VARCHAR NOT NULL,
  original_time TEXT,
  corrected_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.absence_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_correction_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for absence_justifications
CREATE POLICY "Users can view their own absence justifications"
ON public.absence_justifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own absence justifications"
ON public.absence_justifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin and gestor_master can view all absence justifications"
ON public.absence_justifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'gestor_master')
  )
);

CREATE POLICY "Admin and gestor_master can update absence justifications"
ON public.absence_justifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'gestor_master')
  )
);

-- RLS policies for time_correction_requests
CREATE POLICY "Users can view their own time correction requests"
ON public.time_correction_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time correction requests"
ON public.time_correction_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin and gestor_master can view all time correction requests"
ON public.time_correction_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'gestor_master')
  )
);

CREATE POLICY "Admin and gestor_master can update time correction requests"
ON public.time_correction_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'gestor_master')
  )
);