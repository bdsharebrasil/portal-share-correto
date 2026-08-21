ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS mes_referencia integer,
  ADD COLUMN IF NOT EXISTS ano_referencia integer;

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.mes_referencia IS
  'Mês de competência do pagamento salarial, de 1 a 12.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ano_referencia IS
  'Ano de competência do pagamento salarial.';

CREATE INDEX IF NOT EXISTS idx_historico_pagamentos_funcionarios_competencia
  ON public.historico_pagamentos_funcionarios (id_usuario, ano_referencia, mes_referencia);
