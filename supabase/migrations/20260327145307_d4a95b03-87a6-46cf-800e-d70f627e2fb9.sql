
CREATE TABLE public.ctm_itens_nao_controlados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  tipo_controle TEXT NOT NULL CHECK (tipo_controle IN ('pneu_camara', 'vela_ignicao', 'pastilha_freio', 'disco_freio')),
  posicao TEXT,
  media_horas NUMERIC,
  marca TEXT,
  data_ultima_troca DATE,
  horas_ultima_troca NUMERIC,
  ordem_servico TEXT,
  nota_fiscal TEXT,
  horas_apos NUMERIC,
  pousos_apos NUMERIC,
  horas_restantes NUMERIC,
  pousos_restantes NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ctm_itens_nao_controlados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.ctm_itens_nao_controlados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
