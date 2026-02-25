-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'financeiro_master',
  'gestor_master',
  'financeiro',
  'operacoes',
  'piloto_chefe',
  'tripulante',
  'cotista'
);

-- User Profiles Table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  display_name TEXT,
  tipo TEXT,
  avatar_url TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User Roles Table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RPC function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Aircraft Table
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativa',
  fuel_consumption NUMERIC(10,2) DEFAULT 0,
  cell_hours_before NUMERIC(10,2) DEFAULT 0,
  cell_hours_current NUMERIC(10,2) DEFAULT 0,
  cell_hours_prev NUMERIC(10,2) DEFAULT 0,
  horimeter_start NUMERIC(10,2) DEFAULT 0,
  horimeter_end NUMERIC(10,2) DEFAULT 0,
  horimeter_active NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view aircraft"
  ON public.aircraft FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage aircraft"
  ON public.aircraft FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Crew Members Table
CREATE TABLE public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT,
  canac TEXT,
  anac_expiry DATE,
  cma TEXT,
  cma_expiry DATE,
  passport TEXT,
  passport_expiry DATE,
  status TEXT NOT NULL DEFAULT 'active',
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crew members"
  ON public.crew_members FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage crew members"
  ON public.crew_members FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Clients Table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  cnpj TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clients"
  ON public.clients FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage clients"
  ON public.clients FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Aerodromes Table
CREATE TABLE public.aerodromes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icao_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aerodromes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view aerodromes"
  ON public.aerodromes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage aerodromes"
  ON public.aerodromes FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Flight Schedules Table
CREATE TABLE public.flight_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id),
  crew_member_id UUID REFERENCES public.crew_members(id),
  client_id UUID REFERENCES public.clients(id),
  flight_date DATE NOT NULL,
  flight_time TIME NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  estimated_duration TEXT,
  passengers INTEGER,
  flight_type TEXT,
  contact TEXT,
  observations TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flight schedules"
  ON public.flight_schedules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage flight schedules"
  ON public.flight_schedules FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Logbook Entries Table
CREATE TABLE public.logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id) NOT NULL,
  entry_date DATE NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  flight_time_hours INTEGER NOT NULL DEFAULT 0,
  flight_time_minutes INTEGER NOT NULL DEFAULT 0,
  landings INTEGER NOT NULL DEFAULT 0,
  fuel_added NUMERIC(10,2) DEFAULT 0,
  pilot_name TEXT,
  copilot_name TEXT,
  remarks TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  horimeter_start NUMERIC(10,2) DEFAULT 0,
  horimeter_end NUMERIC(10,2) DEFAULT 0,
  cell_start NUMERIC(10,2) DEFAULT 0,
  cell_end NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view logbook entries"
  ON public.logbook_entries FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage logbook entries"
  ON public.logbook_entries FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Monthly Diary Closures Table
CREATE TABLE public.monthly_diary_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_flight_hours NUMERIC(10,2) NOT NULL,
  total_landings INTEGER NOT NULL,
  total_fuel_added NUMERIC(10,2) NOT NULL,
  observations TEXT,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (aircraft_id, year, month)
);

ALTER TABLE public.monthly_diary_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view monthly closures"
  ON public.monthly_diary_closures FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage monthly closures"
  ON public.monthly_diary_closures FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Flight Documents Table
CREATE TABLE public.flight_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flight documents"
  ON public.flight_documents FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage flight documents"
  ON public.flight_documents FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Flight Plans Table
CREATE TABLE public.flight_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_date DATE NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  aircraft_id UUID REFERENCES public.aircraft(id),
  pilot_in_command TEXT NOT NULL,
  alternate_airport TEXT,
  cruise_altitude TEXT,
  estimated_time TEXT,
  fuel_endurance TEXT,
  route TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flight plans"
  ON public.flight_plans FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage flight plans"
  ON public.flight_plans FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Flight Checklists Table
CREATE TABLE public.flight_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_plan_id UUID REFERENCES public.flight_plans(id) ON DELETE CASCADE NOT NULL,
  item TEXT NOT NULL,
  checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view checklists"
  ON public.flight_checklists FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage checklists"
  ON public.flight_checklists FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Contacts Table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  notes TEXT,
  birthday DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contacts"
  ON public.contacts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Hoteis Table
CREATE TABLE public.hoteis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hoteis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hoteis"
  ON public.hoteis FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage hoteis"
  ON public.hoteis FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Manutencoes Table
CREATE TABLE public.manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  aeronave_id UUID REFERENCES public.aircraft(id),
  data_programada DATE NOT NULL,
  mecanico TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'aguardando',
  oficina TEXT,
  observacoes TEXT,
  custo_estimado NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view manutencoes"
  ON public.manutencoes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage manutencoes"
  ON public.manutencoes FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Salaries Table
CREATE TABLE public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id UUID REFERENCES public.crew_members(id),
  base_salary NUMERIC(10,2) NOT NULL,
  flight_hour_rate NUMERIC(10,2),
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view salaries"
  ON public.salaries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage salaries"
  ON public.salaries FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Aircraft Hourly Rates Table
CREATE TABLE public.aircraft_hourly_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id) NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (aircraft_id, effective_date)
);

ALTER TABLE public.aircraft_hourly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hourly rates"
  ON public.aircraft_hourly_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage hourly rates"
  ON public.aircraft_hourly_rates FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Flight Payments Table
CREATE TABLE public.flight_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_schedule_id UUID REFERENCES public.flight_schedules(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
  ON public.flight_payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage payments"
  ON public.flight_payments FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Receipts Table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  payer_name TEXT NOT NULL,
  payer_document TEXT,
  payer_address TEXT,
  payer_city TEXT,
  payer_uf TEXT,
  amount NUMERIC(10,2) NOT NULL,
  service_description TEXT NOT NULL,
  issue_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own receipts"
  ON public.receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own receipts"
  ON public.receipts FOR ALL
  USING (auth.uid() = user_id);

-- Favorite Payers Table
CREATE TABLE public.favorite_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  address TEXT,
  city TEXT,
  uf TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.favorite_payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorite payers"
  ON public.favorite_payers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorite payers"
  ON public.favorite_payers FOR ALL
  USING (auth.uid() = user_id);

-- Favorite Services Table
CREATE TABLE public.favorite_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.favorite_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorite services"
  ON public.favorite_services FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorite services"
  ON public.favorite_services FOR ALL
  USING (auth.uid() = user_id);

-- Client Portal Data Table
CREATE TABLE public.client_portal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  data_type TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  amount NUMERIC(10,2),
  due_date DATE,
  status TEXT DEFAULT 'pending',
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_portal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own portal data"
  ON public.client_portal_data FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can manage portal data"
  ON public.client_portal_data FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('recibos', 'recibos', false);

-- Storage policies for receipts
CREATE POLICY "Users can upload their own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recibos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recibos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recibos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage bucket for client portal documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false);

-- Storage policies for client documents
CREATE POLICY "Authenticated users can upload client documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Clients can view their documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-documents');

CREATE POLICY "Authenticated users can delete client documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);