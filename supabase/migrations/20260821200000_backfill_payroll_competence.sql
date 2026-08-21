UPDATE public.historico_pagamentos_funcionarios
SET
  mes_referencia = EXTRACT(MONTH FROM COALESCE(data_pagamento::timestamp, criado_em))::integer,
  ano_referencia = EXTRACT(YEAR FROM COALESCE(data_pagamento::timestamp, criado_em))::integer
WHERE mes_referencia IS NULL
  AND ano_referencia IS NULL
  AND COALESCE(data_pagamento::timestamp, criado_em) IS NOT NULL;
