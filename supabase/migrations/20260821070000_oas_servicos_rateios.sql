-- Histórico detalhado de serviços executados em uma OAS.
CREATE TABLE IF NOT EXISTS public.ctm_oas_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ctm_ordem_acompanhamento_servico(id) ON DELETE CASCADE,
  oficina_nome text,
  os_oficina text,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  numero_nota_fiscal text,
  data_servico date,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Complementa o histórico legado de peças com valor e documento fiscal.
ALTER TABLE public.ctm_pecas_trocadas
  ADD COLUMN IF NOT EXISTS valor_total numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS numero_nota_fiscal text,
  ADD COLUMN IF NOT EXISTS data_compra date;

-- Rateio específico de cada serviço ou peça, preservando o vínculo com a OAS.
CREATE TABLE IF NOT EXISTS public.ctm_oas_item_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ctm_ordem_acompanhamento_servico(id) ON DELETE CASCADE,
  item_tipo text NOT NULL CHECK (item_tipo IN ('servico', 'peca')),
  servico_id uuid REFERENCES public.ctm_oas_servicos(id) ON DELETE CASCADE,
  peca_id uuid REFERENCES public.ctm_pecas_trocadas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_rateio text NOT NULL DEFAULT 'cota',
  percentual numeric(8,4) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ctm_oas_item_rateios_item_check CHECK (
    (item_tipo = 'servico' AND servico_id IS NOT NULL AND peca_id IS NULL)
    OR (item_tipo = 'peca' AND peca_id IS NOT NULL AND servico_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ctm_oas_servicos_oas ON public.ctm_oas_servicos(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ctm_oas_pecas_oas ON public.ctm_pecas_trocadas(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ctm_oas_item_rateios_oas ON public.ctm_oas_item_rateios(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ctm_oas_item_rateios_servico ON public.ctm_oas_item_rateios(servico_id);
CREATE INDEX IF NOT EXISTS idx_ctm_oas_item_rateios_peca ON public.ctm_oas_item_rateios(peca_id);

ALTER TABLE public.ctm_oas_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctm_oas_item_rateios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe autenticada gerencia servicos OAS" ON public.ctm_oas_servicos;
CREATE POLICY "Equipe autenticada gerencia servicos OAS"
  ON public.ctm_oas_servicos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Equipe autenticada gerencia rateios OAS" ON public.ctm_oas_item_rateios;
CREATE POLICY "Equipe autenticada gerencia rateios OAS"
  ON public.ctm_oas_item_rateios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ctm_oas_servicos IS 'Serviços executados, separados por oficina, OS e nota fiscal dentro de uma OAS.';
COMMENT ON TABLE public.ctm_oas_item_rateios IS 'Rateio individual por cotista para cada serviço ou peça de uma OAS.';
COMMIT;

-- Atualiza os totais da OAS sempre que um serviço ou peça for inserido/alterado/removido.
CREATE OR REPLACE FUNCTION public.ctm_recalcular_totais_oas(p_oas_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ctm_ordem_acompanhamento_servico
  SET total_mao_obra = COALESCE((SELECT SUM(valor) FROM public.ctm_oas_servicos WHERE ordem_servico_id = p_oas_id), 0),
      total_pecas = COALESCE((SELECT SUM(valor_total) FROM public.ctm_pecas_trocadas WHERE ordem_servico_id = p_oas_id), 0),
      total_geral = COALESCE((SELECT SUM(valor) FROM public.ctm_oas_servicos WHERE ordem_servico_id = p_oas_id), 0)
                   + COALESCE((SELECT SUM(valor_total) FROM public.ctm_pecas_trocadas WHERE ordem_servico_id = p_oas_id), 0),
      total_valor_os = COALESCE((SELECT SUM(valor) FROM public.ctm_oas_servicos WHERE ordem_servico_id = p_oas_id), 0)
                       + COALESCE((SELECT SUM(valor_total) FROM public.ctm_pecas_trocadas WHERE ordem_servico_id = p_oas_id), 0),
      updated_at = now()
  WHERE id = p_oas_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ctm_sync_totais_oas_servico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ctm_recalcular_totais_oas(COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ctm_totais_oas_servico ON public.ctm_oas_servicos;
CREATE TRIGGER trg_ctm_totais_oas_servico AFTER INSERT OR UPDATE OR DELETE ON public.ctm_oas_servicos
FOR EACH ROW EXECUTE FUNCTION public.ctm_sync_totais_oas_servico();

DROP TRIGGER IF EXISTS trg_ctm_totais_oas_peca ON public.ctm_pecas_trocadas;
CREATE TRIGGER trg_ctm_totais_oas_peca AFTER INSERT OR UPDATE OR DELETE ON public.ctm_pecas_trocadas
FOR EACH ROW EXECUTE FUNCTION public.ctm_sync_totais_oas_servico();

GRANT EXECUTE ON FUNCTION public.ctm_recalcular_totais_oas(uuid) TO authenticated;
COMMIT;
