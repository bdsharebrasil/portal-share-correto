-- Vincula uma Ordem de Acompanhamento de Serviço ao item do Programa de Manutenção
-- selecionado no momento da abertura da OAS.
ALTER TABLE public.ctm_ordem_acompanhamento_servico
  ADD COLUMN IF NOT EXISTS programa_manutencao_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ctm_oas_programa_manutencao_id_fkey'
  ) THEN
    ALTER TABLE public.ctm_ordem_acompanhamento_servico
      ADD CONSTRAINT ctm_oas_programa_manutencao_id_fkey
      FOREIGN KEY (programa_manutencao_id)
      REFERENCES public.ctm_programa_manutencao(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ctm_oas_programa_manutencao
  ON public.ctm_ordem_acompanhamento_servico(programa_manutencao_id);

COMMENT ON COLUMN public.ctm_ordem_acompanhamento_servico.programa_manutencao_id
  IS 'Item do Programa de Manutenção que originou esta OAS; preenchido na abertura e atualizado ao finalizar.';
