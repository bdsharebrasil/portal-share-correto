ALTER TABLE public.historico_pagamentos_funcionarios
  ADD COLUMN IF NOT EXISTS salario_bruto numeric,
  ADD COLUMN IF NOT EXISTS salario_liquido numeric,
  ADD COLUMN IF NOT EXISTS descontos_detalhes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS beneficios_detalhes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custo_total_empresa numeric;

COMMENT ON COLUMN public.historico_pagamentos_funcionarios.salario_bruto IS 'Valor bruto informado no holerite.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.salario_liquido IS 'Valor líquido efetivamente pago ao colaborador no holerite.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.descontos_detalhes IS 'Lista estruturada de descontos do holerite, com tipo e valor.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.beneficios_detalhes IS 'Lista estruturada de benefícios pagos pela empresa, com tipo e valor.';
COMMENT ON COLUMN public.historico_pagamentos_funcionarios.custo_total_empresa IS 'Custo total da empresa para o pagamento, incluindo líquido, benefícios e adicionais.';

UPDATE public.historico_pagamentos_funcionarios
SET salario_bruto = COALESCE(salario_bruto, salario_holerite),
    salario_liquido = COALESCE(salario_liquido, valor_total, salario_holerite),
    custo_total_empresa = COALESCE(custo_total_empresa, valor_total, salario_holerite)
WHERE salario_bruto IS NULL
   OR salario_liquido IS NULL
   OR custo_total_empresa IS NULL;

CREATE INDEX IF NOT EXISTS idx_historico_pagamentos_funcionarios_salario_bruto
  ON public.historico_pagamentos_funcionarios (salario_bruto);
CREATE INDEX IF NOT EXISTS idx_historico_pagamentos_funcionarios_salario_liquido
  ON public.historico_pagamentos_funcionarios (salario_liquido);
COMMIT;
