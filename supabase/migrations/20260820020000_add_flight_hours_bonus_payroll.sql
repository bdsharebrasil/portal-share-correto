ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS valor_horas_voo numeric(12,2),
  ADD COLUMN IF NOT EXISTS bonificacao_extra numeric(12,2);

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.valor_horas_voo IS
  'Valor monetário pago pelas horas de voo do piloto/ tripulante no período.';

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.bonificacao_extra IS
  'Bonificação ou pagamento extra, separado do valor das horas de voo.';
