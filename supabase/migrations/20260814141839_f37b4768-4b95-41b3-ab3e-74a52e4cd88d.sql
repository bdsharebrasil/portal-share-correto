ALTER TABLE public.solicitacoes_reserva_voo DROP CONSTRAINT IF EXISTS solicitacoes_reserva_voo_status_check;
ALTER TABLE public.solicitacoes_reserva_voo ADD CONSTRAINT solicitacoes_reserva_voo_status_check
  CHECK (status = ANY (ARRAY['pendente','confirmado','em_voo','em_rota','pousado','concluido','rejeitado','cancelado']::text[]));

ALTER TABLE public.ctm_ordem_acompanhamento_servico
  ADD COLUMN IF NOT EXISTS os_oficina text,
  ADD COLUMN IF NOT EXISTS horas_celula numeric,
  ADD COLUMN IF NOT EXISTS dias_previstos integer,
  ADD COLUMN IF NOT EXISTS dias_efetivos integer,
  ADD COLUMN IF NOT EXISTS relatorio_voo_de text,
  ADD COLUMN IF NOT EXISTS relatorio_voo_ate text,
  ADD COLUMN IF NOT EXISTS total_voado_porcentagem text,
  ADD COLUMN IF NOT EXISTS porcentagem_rateio text;