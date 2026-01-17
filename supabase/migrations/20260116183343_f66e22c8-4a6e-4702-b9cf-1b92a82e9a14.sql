-- Tabela para configurar intervalos de manutenção por aeronave
CREATE TABLE public.aircraft_maintenance_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(20) NOT NULL CHECK (maintenance_type IN ('50h', '100h', '150h', '200h')),
  interval_hours NUMERIC NOT NULL DEFAULT 50,
  alert_green_threshold NUMERIC NOT NULL DEFAULT 20,
  alert_yellow_threshold NUMERIC NOT NULL DEFAULT 15,
  alert_orange_threshold NUMERIC NOT NULL DEFAULT 10,
  alert_red_threshold NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(aircraft_id, maintenance_type)
);

-- Tabela para registrar manutenções realizadas
CREATE TABLE public.aircraft_maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(20) NOT NULL CHECK (maintenance_type IN ('50h', '100h', '150h', '200h')),
  performed_at_hours NUMERIC NOT NULL,
  performed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_hours NUMERIC NOT NULL,
  mechanic_name VARCHAR(255),
  maintenance_center VARCHAR(255),
  service_order_number VARCHAR(100),
  description TEXT,
  cost NUMERIC,
  observations TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para notificações de manutenção
CREATE TABLE public.maintenance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(20) NOT NULL,
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('green', 'yellow', 'orange', 'red')),
  hours_remaining NUMERIC NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.aircraft_maintenance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft_maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para aircraft_maintenance_config
CREATE POLICY "Authenticated users can view maintenance config"
ON public.aircraft_maintenance_config FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operations can manage maintenance config"
ON public.aircraft_maintenance_config FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('admin', 'gestor_master', 'operacoes')
));

-- Políticas para aircraft_maintenance_records
CREATE POLICY "Authenticated users can view maintenance records"
ON public.aircraft_maintenance_records FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operations can manage maintenance records"
ON public.aircraft_maintenance_records FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('admin', 'gestor_master', 'operacoes')
));

-- Políticas para maintenance_notifications
CREATE POLICY "Authenticated users can view notifications"
ON public.maintenance_notifications FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operations can manage notifications"
ON public.maintenance_notifications FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('admin', 'gestor_master', 'operacoes')
));

-- Trigger para updated_at
CREATE TRIGGER update_aircraft_maintenance_config_updated_at
BEFORE UPDATE ON public.aircraft_maintenance_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_aircraft_maintenance_records_updated_at
BEFORE UPDATE ON public.aircraft_maintenance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();