-- Tabela para configurações de aeronaves no calendário de agendamentos
CREATE TABLE public.scheduling_aircraft_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  enabled_for_scheduling boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  UNIQUE(aircraft_id)
);

-- Tabela para configurações de tripulação na escala
CREATE TABLE public.scheduling_crew_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_member_id uuid NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  enabled_for_scheduling boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  UNIQUE(crew_member_id)
);

-- Enable RLS
ALTER TABLE public.scheduling_aircraft_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_crew_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view scheduling config" ON public.scheduling_aircraft_config
  FOR SELECT USING (true);

CREATE POLICY "Operators can manage scheduling config" ON public.scheduling_aircraft_config
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role) OR 
    has_role(auth.uid(), 'operacoes'::app_role)
  );

CREATE POLICY "Anyone can view crew scheduling config" ON public.scheduling_crew_config
  FOR SELECT USING (true);

CREATE POLICY "Operators can manage crew scheduling config" ON public.scheduling_crew_config
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role) OR 
    has_role(auth.uid(), 'operacoes'::app_role)
  );

-- Inserir configuração inicial para todas as aeronaves
INSERT INTO public.scheduling_aircraft_config (aircraft_id, enabled_for_scheduling)
SELECT id, true FROM public.aircraft ON CONFLICT DO NOTHING;

-- Inserir configuração inicial para todos os tripulantes
INSERT INTO public.scheduling_crew_config (crew_member_id, enabled_for_scheduling)
SELECT id, true FROM public.crew_members ON CONFLICT DO NOTHING;