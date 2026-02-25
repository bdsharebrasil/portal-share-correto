-- Criar função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela principal de Ciclo de Vida do Voo
CREATE TABLE public.flight_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id),
  aircraft_id UUID REFERENCES public.aircraft(id),
  origin_icao VARCHAR(4) NOT NULL,
  destination_icao VARCHAR(4) NOT NULL,
  flight_date DATE NOT NULL,
  return_date DATE,
  flight_type VARCHAR(20) NOT NULL CHECK (flight_type IN ('ida', 'ida_volta', 'pernoite')),
  has_overnight BOOLEAN DEFAULT false,
  is_controlled_airport BOOLEAN DEFAULT false,
  has_private_hangar BOOLEAN DEFAULT false,
  flight_duration_hours DECIMAL(5,2),
  status VARCHAR(30) NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado', 'confirmado', 'em_execucao', 'concluido', 'aguardando_despesas', 'em_cobranca', 'finalizado')),
  responsible_user_id UUID REFERENCES auth.users(id),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  finalized_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de despesas do voo
CREATE TABLE public.flight_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_cycle_id UUID NOT NULL REFERENCES public.flight_cycles(id) ON DELETE CASCADE,
  expense_type VARCHAR(50) NOT NULL,
  expense_category VARCHAR(30) NOT NULL CHECK (expense_category IN ('imediata', 'regulatoria', 'variavel')),
  expense_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'recebida', 'enviada', 'paga', 'atrasada', 'nao_aplicavel')),
  expected_date DATE,
  received_date DATE,
  sent_to_client_date DATE,
  payment_date DATE,
  amount DECIMAL(12,2),
  observations TEXT,
  attachment_url TEXT,
  deadline_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração de prazos por tipo de despesa
CREATE TABLE public.expense_deadline_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_type VARCHAR(50) NOT NULL UNIQUE,
  default_deadline_days INTEGER NOT NULL DEFAULT 7,
  alert_days_before INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configurações padrão de prazos
INSERT INTO public.expense_deadline_config (expense_type, default_deadline_days, alert_days_before) VALUES
  ('hospedagem', 3, 1),
  ('alimentacao', 3, 1),
  ('transporte_terrestre', 5, 2),
  ('combustivel_emergencia', 7, 3),
  ('diaria_hangar', 5, 2),
  ('tarifa_decea', 30, 7),
  ('tarifa_infraero', 30, 7),
  ('taxa_pouso', 15, 5),
  ('taxa_permanencia', 15, 5),
  ('hangar_particular', 5, 2),
  ('servicos_rampa', 7, 3),
  ('outras', 10, 3);

-- Habilitar RLS
ALTER TABLE public.flight_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_deadline_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Authenticated users can view flight_cycles" ON public.flight_cycles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert flight_cycles" ON public.flight_cycles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update flight_cycles" ON public.flight_cycles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete flight_cycles" ON public.flight_cycles FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view flight_expenses" ON public.flight_expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert flight_expenses" ON public.flight_expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update flight_expenses" ON public.flight_expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete flight_expenses" ON public.flight_expenses FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view expense_deadline_config" ON public.expense_deadline_config FOR SELECT USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_flight_cycles_updated_at BEFORE UPDATE ON public.flight_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_flight_expenses_updated_at BEFORE UPDATE ON public.flight_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_flight_cycles_status ON public.flight_cycles(status);
CREATE INDEX idx_flight_cycles_client ON public.flight_cycles(client_id);
CREATE INDEX idx_flight_cycles_aircraft ON public.flight_cycles(aircraft_id);
CREATE INDEX idx_flight_cycles_date ON public.flight_cycles(flight_date);
CREATE INDEX idx_flight_expenses_cycle ON public.flight_expenses(flight_cycle_id);
CREATE INDEX idx_flight_expenses_status ON public.flight_expenses(status);