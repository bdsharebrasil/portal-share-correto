-- Create contas_bancarias table
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid not null default gen_random_uuid (),
  empresa_id uuid not null,
  banco character varying(255) null,
  numero_conta character varying(100) null,
  tipo_conta character varying(50) null default 'corrente'::character varying,
  ativo boolean null default true,
  criado_por uuid not null,
  criado_em timestamp with time zone null default CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint contas_bancarias_pkey primary key (id),
  constraint contas_bancarias_empresa_id_numero_conta_key unique (empresa_id, numero_conta),
  constraint contas_bancarias_criado_por_fkey foreign KEY (criado_por) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contas_empresa ON public.contas_bancarias USING btree (empresa_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_contas_ativo ON public.contas_bancarias USING btree (ativo) TABLESPACE pg_default;

-- Create trigger for updating timestamp
CREATE OR REPLACE FUNCTION update_contas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contas_update_timestamp
  BEFORE UPDATE ON contas_bancarias
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_timestamp();

-- Enable RLS
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view contas_bancarias from their empresa" ON public.contas_bancarias
  FOR SELECT USING (empresa_id IN (
    SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert contas_bancarias for their empresa" ON public.contas_bancarias
  FOR INSERT WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
  ) AND criado_por = auth.uid());

CREATE POLICY "Users can update contas_bancarias from their empresa" ON public.contas_bancarias
  FOR UPDATE USING (empresa_id IN (
    SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete contas_bancarias from their empresa" ON public.contas_bancarias
  FOR DELETE USING (empresa_id IN (
    SELECT empresa_id FROM public.user_profiles WHERE id = auth.uid()
  ));