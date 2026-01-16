-- Tabela para solicitações de voo dos sócios
CREATE TABLE IF NOT EXISTS public.flight_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  departure_time TIME,
  return_date DATE,
  duration_days INTEGER DEFAULT 1,
  passenger_count INTEGER DEFAULT 1,
  passengers_info JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'rejeitado', 'cancelado', 'em_voo', 'concluido')),
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  assigned_pilot_id UUID REFERENCES public.crew_members(id),
  assigned_copilot_id UUID REFERENCES public.crew_members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para bloqueio de datas
CREATE TABLE IF NOT EXISTS public.blocked_flight_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  reason TEXT,
  blocked_by UUID,
  is_fleet_wide BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para status em tempo real da frota
CREATE TABLE IF NOT EXISTS public.aircraft_live_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL UNIQUE REFERENCES public.aircraft(id) ON DELETE CASCADE,
  current_status TEXT NOT NULL DEFAULT 'disponivel' CHECK (current_status IN ('disponivel', 'em_voo', 'manutencao', 'reservado', 'indisponivel')),
  current_location TEXT,
  current_flight_id UUID REFERENCES public.flight_booking_requests(id),
  last_departure TIMESTAMPTZ,
  expected_arrival TIMESTAMPTZ,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para login dos sócios (portal separado)
CREATE TABLE IF NOT EXISTS public.client_portal_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_client ON public.flight_booking_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_aircraft ON public.flight_booking_requests(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_status ON public.flight_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_date ON public.flight_booking_requests(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_blocked_flight_dates_aircraft ON public.blocked_flight_dates(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_blocked_flight_dates_date ON public.blocked_flight_dates(block_date);

-- RLS Policies
ALTER TABLE public.flight_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_flight_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft_live_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_auth ENABLE ROW LEVEL SECURITY;

-- Políticas para flight_booking_requests
CREATE POLICY "Authenticated users can view all bookings" ON public.flight_booking_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create bookings" ON public.flight_booking_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Operators can update bookings" ON public.flight_booking_requests
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role) OR 
    has_role(auth.uid(), 'operacoes'::app_role)
  );

CREATE POLICY "Operators can delete bookings" ON public.flight_booking_requests
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role)
  );

-- Políticas para blocked_flight_dates
CREATE POLICY "Anyone can view blocked dates" ON public.blocked_flight_dates
  FOR SELECT USING (true);

CREATE POLICY "Operators can manage blocked dates" ON public.blocked_flight_dates
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role) OR 
    has_role(auth.uid(), 'operacoes'::app_role)
  );

-- Políticas para aircraft_live_status
CREATE POLICY "Anyone can view aircraft status" ON public.aircraft_live_status
  FOR SELECT USING (true);

CREATE POLICY "Operators can update aircraft status" ON public.aircraft_live_status
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role) OR 
    has_role(auth.uid(), 'operacoes'::app_role) OR
    has_role(auth.uid(), 'piloto_chefe'::app_role)
  );

-- Políticas para client_portal_auth (apenas admins gerenciam)
CREATE POLICY "Only admins can manage client portal auth" ON public.client_portal_auth
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'gestor_master'::app_role)
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_flight_booking_requests_timestamp
  BEFORE UPDATE ON public.flight_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_flight_booking_requests_updated_at();

-- Inserir status inicial para todas as aeronaves existentes
INSERT INTO public.aircraft_live_status (aircraft_id, current_status)
SELECT id, 'disponivel' FROM public.aircraft
ON CONFLICT (aircraft_id) DO NOTHING;