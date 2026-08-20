ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS decimo_terceiro_referencia text,
  ADD COLUMN IF NOT EXISTS ferias_referencia text,
  ADD COLUMN IF NOT EXISTS ferias_modalidade text,
  ADD COLUMN IF NOT EXISTS ferias_dias_comprados integer;

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.decimo_terceiro_referencia IS
  'Ano-base ou referência do pagamento de 13º salário.';

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_referencia IS
  'Período aquisitivo ou ano ao qual o pagamento de férias se refere.';

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_modalidade IS
  'Modalidade das férias: gozo integral, gozo parcial ou compra de dias.';

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.ferias_dias_comprados IS
  'Quantidade de dias de férias convertidos em abono pecuniário.';
