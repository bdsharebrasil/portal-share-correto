-- Rastreabilidade técnica de componentes aeronáuticos
-- Mantém o histórico imutável de instalação, remoção, inspeção e transferência.

CREATE TABLE IF NOT EXISTS public.ctm_componente_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  componente_id uuid NOT NULL REFERENCES public.ctm_mapa_componente(id) ON DELETE CASCADE,
  aeronave_id uuid NOT NULL REFERENCES public.aeronave(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('instalacao','remocao','inspecao','revisao','transferencia','ajuste')),
  data_evento date NOT NULL,
  horas_aeronave numeric,
  pousos_aeronave integer,
  ciclos_aeronave integer,
  posicao text,
  p_n_removido text,
  s_n_removido text,
  p_n_instalado text,
  s_n_instalado text,
  motivo text,
  descricao text,
  ordem_servico_id uuid REFERENCES public.ctm_ordem_acompanhamento_servico(id) ON DELETE SET NULL,
  peca_trocada_id uuid REFERENCES public.ctm_pecas_trocadas(id) ON DELETE SET NULL,
  programa_manutencao_id uuid REFERENCES public.ctm_programa_manutencao(id) ON DELETE SET NULL,
  documento_url text,
  documento_nome text,
  criado_por uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctm_componente_eventos_componente_data
  ON public.ctm_componente_eventos(componente_id, data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_ctm_componente_eventos_aeronave_data
  ON public.ctm_componente_eventos(aeronave_id, data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_ctm_componente_eventos_oas
  ON public.ctm_componente_eventos(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ctm_componente_eventos_peca
  ON public.ctm_componente_eventos(peca_trocada_id);

ALTER TABLE public.ctm_pecas_trocadas
  ADD COLUMN IF NOT EXISTS componente_id uuid REFERENCES public.ctm_mapa_componente(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ctm_pecas_trocadas_componente
  ON public.ctm_pecas_trocadas(componente_id);

ALTER TABLE public.ctm_componente_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe autenticada gerencia eventos de componentes" ON public.ctm_componente_eventos;
CREATE POLICY "Equipe autenticada gerencia eventos de componentes"
  ON public.ctm_componente_eventos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.ctm_componente_eventos IS 'Linha do tempo técnica de cada componente aeronáutico, vinculada a OAS, peça trocada e programa de manutenção.';
COMMENT ON COLUMN public.ctm_componente_eventos.tipo_evento IS 'Evento técnico: instalação, remoção, inspeção, revisão, transferência ou ajuste.';
COMMENT ON COLUMN public.ctm_componente_eventos.horas_aeronave IS 'Horas totais da aeronave no momento do evento.';
COMMENT ON COLUMN public.ctm_componente_eventos.pousos_aeronave IS 'Pousos totais da aeronave no momento do evento.';
COMMENT ON COLUMN public.ctm_componente_eventos.s_n_instalado IS 'Número de série instalado após o evento, quando aplicável.';
COMMENT ON COLUMN public.ctm_componente_eventos.s_n_removido IS 'Número de série removido no evento, quando aplicável.';

CREATE OR REPLACE FUNCTION public.ctm_touch_componente_evento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ctm_touch_componente_evento ON public.ctm_componente_eventos;
CREATE TRIGGER trg_ctm_touch_componente_evento
  BEFORE UPDATE ON public.ctm_componente_eventos
  FOR EACH ROW EXECUTE FUNCTION public.ctm_touch_componente_evento();

-- Importa os registros já existentes de peças trocadas para a linha do tempo,
-- sem duplicar eventos caso a migration seja executada novamente.
INSERT INTO public.ctm_componente_eventos (
  componente_id, aeronave_id, tipo_evento, data_evento, p_n_removido, s_n_removido,
  p_n_instalado, s_n_instalado, descricao, ordem_servico_id, peca_trocada_id,
  documento_url, documento_nome, criado_em, atualizado_em
)
SELECT
  p.componente_id,
  o.aeronave_id,
  'revisao',
  COALESCE(p.data_compra, o.data_saida, o.data_entrada, CURRENT_DATE),
  p.p_n_removido,
  p.s_n_removido,
  p.p_n_instalado,
  p.s_n_instalado,
  p.descricao,
  p.ordem_servico_id,
  p.id,
  p.nota_fiscal_path,
  p.nota_fiscal_nome,
  COALESCE(p.criado_em, now()),
  now()
FROM public.ctm_pecas_trocadas p
JOIN public.ctm_ordem_acompanhamento_servico o ON o.id = p.ordem_servico_id
WHERE p.componente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ctm_componente_eventos e WHERE e.peca_trocada_id = p.id
  );
