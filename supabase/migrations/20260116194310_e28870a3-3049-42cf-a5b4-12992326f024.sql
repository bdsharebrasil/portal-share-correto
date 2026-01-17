-- Criar tabela despesas_cliente_direto
CREATE TABLE IF NOT EXISTS public.despesas_cliente_direto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_bancario_id UUID REFERENCES controle_bancario(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  client_name TEXT NOT NULL,
  aeronave_id UUID REFERENCES aircraft(id),
  aeronave_registro TEXT,
  
  categoria_id UUID REFERENCES categorias_movimentacao(id),
  categoria_nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  
  fornecedor_nome TEXT NOT NULL,
  fornecedor_cnpj TEXT,
  fornecedor_dados JSONB,
  
  status TEXT NOT NULL DEFAULT 'pendente_envio',
  data_envio DATE,
  enviado_por UUID,
  meio_envio TEXT,
  email_enviado BOOLEAN DEFAULT false,
  
  data_pagamento_cliente DATE,
  comprovante_pagamento_url TEXT,
  valor_pago NUMERIC(15,2),
  observacoes_pagamento TEXT,
  
  validado_por UUID,
  data_validacao TIMESTAMPTZ,
  observacoes_validacao TEXT,
  
  boleto_url TEXT,
  nota_fiscal_url TEXT,
  outros_documentos JSONB,
  
  lembrete_enviado BOOLEAN DEFAULT false,
  data_ultimo_lembrete DATE,
  quantidade_lembretes INTEGER DEFAULT 0,
  
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  criado_por UUID,
  
  CONSTRAINT despesas_cliente_direto_status_check CHECK (
    status IN (
      'pendente_envio',
      'enviado',
      'visualizado_cliente',
      'aguardando_pagamento',
      'comprovante_recebido',
      'pagamento_validado',
      'concluido',
      'atrasado',
      'cancelado'
    )
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_despesas_cliente_direto_client ON despesas_cliente_direto(client_id);
CREATE INDEX IF NOT EXISTS idx_despesas_cliente_direto_status ON despesas_cliente_direto(status);
CREATE INDEX IF NOT EXISTS idx_despesas_cliente_direto_vencimento ON despesas_cliente_direto(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_cliente_direto_aeronave ON despesas_cliente_direto(aeronave_id);

-- Enable RLS
ALTER TABLE despesas_cliente_direto ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "despesas_cliente_direto_select_policy"
  ON despesas_cliente_direto FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "despesas_cliente_direto_insert_policy"
  ON despesas_cliente_direto FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "despesas_cliente_direto_update_policy"
  ON despesas_cliente_direto FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "despesas_cliente_direto_delete_policy"
  ON despesas_cliente_direto FOR DELETE TO authenticated
  USING (true);