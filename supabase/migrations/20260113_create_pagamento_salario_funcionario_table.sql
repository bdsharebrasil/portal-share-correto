-- Create pagamento_salario_funcionario table
CREATE TABLE IF NOT EXISTS public.pagamento_salario_funcionario (
  id uuid not null default gen_random_uuid (),
  user_profile uuid null,
  banco character varying(255) null,
  base_salary_holerite numeric null,
  benefit text null,
  comprovante_url text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  data_pagamento date null,
  decimo_terceiro_parcela1 numeric null,
  decimo_terceiro_parcela2 numeric null,
  extra text null,
  ferias numeric null,
  holerite_url text null,
  horas_voo text null,
  obs text null,
  obs2 text null,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint pagamento_salario_funcionario_pkey primary key (id),
  constraint pagamento_salario_funcionario_user_profile_fkey foreign KEY (user_profile) references public.user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pagamento_salario_user_profile ON public.pagamento_salario_funcionario USING btree (user_profile) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_pagamento_salario_data_pagamento ON public.pagamento_salario_funcionario USING btree (data_pagamento) TABLESPACE pg_default;

-- Create trigger for updating timestamp
CREATE OR REPLACE FUNCTION update_pagamento_salario_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pagamento_salario_update_timestamp
  BEFORE UPDATE ON pagamento_salario_funcionario
  FOR EACH ROW
  EXECUTE FUNCTION update_pagamento_salario_timestamp();

-- Enable RLS
ALTER TABLE public.pagamento_salario_funcionario ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view pagamento_salario_funcionario from their empresa" ON public.pagamento_salario_funcionario
  FOR SELECT USING (user_profile IN (
    SELECT id FROM public.user_profiles WHERE empresa_id IN (
      SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert pagamento_salario_funcionario for their empresa" ON public.pagamento_salario_funcionario
  FOR INSERT WITH CHECK (user_profile IN (
    SELECT id FROM public.user_profiles WHERE empresa_id IN (
      SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can update pagamento_salario_funcionario from their empresa" ON public.pagamento_salario_funcionario
  FOR UPDATE USING (user_profile IN (
    SELECT id FROM public.user_profiles WHERE empresa_id IN (
      SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete pagamento_salario_funcionario from their empresa" ON public.pagamento_salario_funcionario
  FOR DELETE USING (user_profile IN (
    SELECT id FROM public.user_profiles WHERE empresa_id IN (
      SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
    )
  ));