-- Tabela de Serviços da OAS
CREATE TABLE IF NOT EXISTS public.ctm_oas_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oas_id UUID NOT NULL REFERENCES ctm_service_orders(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  periodo TEXT, -- ex: "50 H"
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  nf TEXT, -- Número da Nota Fiscal
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Peças da OAS
CREATE TABLE IF NOT EXISTS public.ctm_oas_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oas_id UUID NOT NULL REFERENCES ctm_service_orders(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  periodo TEXT, -- ex: "50 H"
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  nf TEXT, -- Número da Nota Fiscal
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Horas de Voo durante OAS
CREATE TABLE IF NOT EXISTS public.ctm_oas_horas_voo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oas_id UUID NOT NULL REFERENCES ctm_service_orders(id) ON DELETE CASCADE,
  mes TEXT NOT NULL, -- ex: "SETEMBRO DE 2022"
  carvalima DECIMAL(5,2) DEFAULT 0, -- Horas do piloto Carvalima
  watt DECIMAL(5,2) DEFAULT 0, -- Horas do piloto Watt
  oficina_testes DECIMAL(5,2) DEFAULT 0, -- Horas de testes na oficina
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_ctm_oas_servicos_oas_id ON public.ctm_oas_servicos(oas_id);
CREATE INDEX idx_ctm_oas_pecas_oas_id ON public.ctm_oas_pecas(oas_id);
CREATE INDEX idx_ctm_oas_horas_voo_oas_id ON public.ctm_oas_horas_voo(oas_id);

-- RLS (Row Level Security)
ALTER TABLE public.ctm_oas_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctm_oas_pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctm_oas_horas_voo ENABLE ROW LEVEL SECURITY;

-- Policies para ctm_oas_servicos
CREATE POLICY "Anyone can view ctm_oas_servicos" ON public.ctm_oas_servicos
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert ctm_oas_servicos" ON public.ctm_oas_servicos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own ctm_oas_servicos" ON public.ctm_oas_servicos
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own ctm_oas_servicos" ON public.ctm_oas_servicos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies para ctm_oas_pecas
CREATE POLICY "Anyone can view ctm_oas_pecas" ON public.ctm_oas_pecas
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert ctm_oas_pecas" ON public.ctm_oas_pecas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own ctm_oas_pecas" ON public.ctm_oas_pecas
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own ctm_oas_pecas" ON public.ctm_oas_pecas
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies para ctm_oas_horas_voo
CREATE POLICY "Anyone can view ctm_oas_horas_voo" ON public.ctm_oas_horas_voo
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert ctm_oas_horas_voo" ON public.ctm_oas_horas_voo
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own ctm_oas_horas_voo" ON public.ctm_oas_horas_voo
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own ctm_oas_horas_voo" ON public.ctm_oas_horas_voo
  FOR DELETE USING (auth.uid() IS NOT NULL);
