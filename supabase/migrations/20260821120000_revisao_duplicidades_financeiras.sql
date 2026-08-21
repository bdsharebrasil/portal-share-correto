CREATE TABLE IF NOT EXISTS public.financeiro_duplicidade_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_par text NOT NULL UNIQUE,
  fluxo text NOT NULL CHECK (fluxo IN ('caixa','reembolsaveis','cliente','dga')),
  lancamento_id uuid,
  lancamento_origem text NOT NULL DEFAULT 'movimentacoes',
  lancamento_relacionado_id uuid,
  relacionado_origem text NOT NULL DEFAULT 'movimentacoes',
  observacao text,
  verificado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verificado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dup_revisoes_fluxo ON public.financeiro_duplicidade_revisoes(fluxo);
CREATE INDEX IF NOT EXISTS idx_dup_revisoes_lancamento ON public.financeiro_duplicidade_revisoes(lancamento_id);

ALTER TABLE public.financeiro_duplicidade_revisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_duplicidade_revisoes_select" ON public.financeiro_duplicidade_revisoes;
CREATE POLICY "financeiro_duplicidade_revisoes_select" ON public.financeiro_duplicidade_revisoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "financeiro_duplicidade_revisoes_insert" ON public.financeiro_duplicidade_revisoes;
CREATE POLICY "financeiro_duplicidade_revisoes_insert" ON public.financeiro_duplicidade_revisoes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "financeiro_duplicidade_revisoes_delete" ON public.financeiro_duplicidade_revisoes;
CREATE POLICY "financeiro_duplicidade_revisoes_delete" ON public.financeiro_duplicidade_revisoes FOR DELETE TO authenticated USING (true);
