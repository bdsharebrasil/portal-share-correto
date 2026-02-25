-- Atualizar tabela travel_reports existente para nova estrutura
-- Adicionar novas colunas
ALTER TABLE public.travel_reports 
  ADD COLUMN IF NOT EXISTS report_number TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS aircraft_id UUID REFERENCES public.aircraft(id),
  ADD COLUMN IF NOT EXISTS aircraft_registration TEXT,
  ADD COLUMN IF NOT EXISTS crew_member_name TEXT,
  ADD COLUMN IF NOT EXISTS crew_member_name_2 TEXT,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS observations TEXT,
  ADD COLUMN IF NOT EXISTS total_fuel NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_lodging NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_food NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_transport NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_other NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_crew NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_client NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sharebrasil NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Migrar dados existentes para novas colunas
UPDATE public.travel_reports SET
  report_number = numero,
  client_name = cliente,
  aircraft_registration = aeronave,
  crew_member_name = tripulante,
  crew_member_name_2 = tripulante2,
  destination = destino,
  start_date = data_inicio::date,
  end_date = data_fim::date,
  observations = observacoes,
  total_fuel = COALESCE(total_combustivel, 0),
  total_lodging = COALESCE(total_hospedagem, 0),
  total_food = COALESCE(total_alimentacao, 0),
  total_transport = COALESCE(total_transporte, 0),
  total_other = COALESCE(total_outros, 0),
  total_crew = COALESCE(total_tripulante, 0),
  total_client = COALESCE(total_cliente, 0),
  total_sharebrasil = COALESCE(total_share_brasil, 0),
  total_amount = COALESCE(valor_total, 0),
  pdf_url = pdf_path
WHERE report_number IS NULL;

-- Tornar as novas colunas obrigatórias após migração
ALTER TABLE public.travel_reports 
  ALTER COLUMN report_number SET NOT NULL,
  ALTER COLUMN client_name SET NOT NULL,
  ALTER COLUMN aircraft_registration SET NOT NULL,
  ALTER COLUMN crew_member_name SET NOT NULL,
  ALTER COLUMN destination SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

-- Remover colunas antigas (opcional - comentado para segurança)
-- ALTER TABLE public.travel_reports 
--   DROP COLUMN IF EXISTS numero,
--   DROP COLUMN IF EXISTS cliente,
--   DROP COLUMN IF EXISTS aeronave,
--   DROP COLUMN IF EXISTS tripulante,
--   DROP COLUMN IF EXISTS tripulante2,
--   DROP COLUMN IF EXISTS destino,
--   DROP COLUMN IF EXISTS data_inicio,
--   DROP COLUMN IF EXISTS data_fim,
--   DROP COLUMN IF EXISTS observacoes,
--   DROP COLUMN IF EXISTS total_combustivel,
--   DROP COLUMN IF EXISTS total_hospedagem,
--   DROP COLUMN IF EXISTS total_alimentacao,
--   DROP COLUMN IF EXISTS total_transporte,
--   DROP COLUMN IF EXISTS total_outros,
--   DROP COLUMN IF EXISTS total_tripulante,
--   DROP COLUMN IF EXISTS total_cliente,
--   DROP COLUMN IF EXISTS total_share_brasil,
--   DROP COLUMN IF EXISTS valor_total,
--   DROP COLUMN IF EXISTS pdf_path;