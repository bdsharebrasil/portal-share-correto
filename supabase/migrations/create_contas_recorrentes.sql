-- Criar tabela de contas recorrentes
CREATE TABLE IF NOT EXISTS contas_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações básicas
  descricao TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  valor DECIMAL(10, 2),
  categoria TEXT,
  
  -- Configuração de recorrência
  frequencia_recorrencia VARCHAR(20) NOT NULL DEFAULT 'mensal' CHECK (frequencia_recorrencia IN ('semanal', 'mensal', 'trimestral', 'anual')),
  dia_recorrencia INTEGER CHECK (dia_recorrencia >= 1 AND dia_recorrencia <= 31),
  
  -- Configurações adicionais
  lembrete_antecipado BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'cancelado')),
  notas TEXT,
  
  -- Data de primeira recorrência
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Rastreamento
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Índices para melhor performance
  UNIQUE(id)
);

-- Criar índices
CREATE INDEX idx_contas_recorrentes_status ON contas_recorrentes(status);
CREATE INDEX idx_contas_recorrentes_frequencia ON contas_recorrentes(frequencia_recorrencia);
CREATE INDEX idx_contas_recorrentes_dia ON contas_recorrentes(dia_recorrencia);
CREATE INDEX idx_contas_recorrentes_criado_por ON contas_recorrentes(criado_por);
CREATE INDEX idx_contas_recorrentes_created_at ON contas_recorrentes(created_at);

-- Habilitar Row Level Security (RLS)
ALTER TABLE contas_recorrentes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Usuários só podem ver suas próprias contas recorrentes (baseado em criado_por)
CREATE POLICY "Usuários podem ver suas próprias contas recorrentes"
  ON contas_recorrentes
  FOR SELECT
  USING (auth.uid() = criado_por OR auth.has_role('authenticated'));

-- Usuários podem criar contas recorrentes
CREATE POLICY "Usuários autenticados podem criar contas recorrentes"
  ON contas_recorrentes
  FOR INSERT
  WITH CHECK (auth.uid() = criado_por);

-- Usuários podem atualizar suas próprias contas recorrentes
CREATE POLICY "Usuários podem atualizar suas próprias contas recorrentes"
  ON contas_recorrentes
  FOR UPDATE
  USING (auth.uid() = criado_por OR auth.uid() = atualizado_por);

-- Usuários podem deletar suas próprias contas recorrentes
CREATE POLICY "Usuários podem deletar suas próprias contas recorrentes"
  ON contas_recorrentes
  FOR DELETE
  USING (auth.uid() = criado_por);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_contas_recorrentes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contas_recorrentes_updated_at
  BEFORE UPDATE ON contas_recorrentes
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_recorrentes_updated_at();
