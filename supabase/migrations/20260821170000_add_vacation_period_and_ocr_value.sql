ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS ferias_inicio date,
  ADD COLUMN IF NOT EXISTS ferias_fim date,
  ADD COLUMN IF NOT EXISTS ferias_dias integer,
  ADD COLUMN IF NOT EXISTS ferias_valor_holerite numeric(12,2);

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_inicio IS
  'Data inicial do período de férias, inclusive.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_fim IS
  'Data final do período de férias, inclusive.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_dias IS
  'Quantidade de dias corridos calculada a partir de ferias_inicio e ferias_fim.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_valor_holerite IS
  'Valor de férias identificado pela leitura do holerite para conferência.';
