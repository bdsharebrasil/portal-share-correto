ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS decimo_terceiro_status text,
  ADD COLUMN IF NOT EXISTS decimo_terceiro_primeira_data date,
  ADD COLUMN IF NOT EXISTS decimo_terceiro_segunda_data date;

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.decimo_terceiro_status IS
  'Status consolidado do pagamento do 13º salário.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.decimo_terceiro_primeira_data IS
  'Data de pagamento da primeira parcela do 13º salário.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.decimo_terceiro_segunda_data IS
  'Data de pagamento da segunda parcela do 13º salário.';
