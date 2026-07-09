-- Criar tabela cost_simulations
CREATE TABLE IF NOT EXISTS cost_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  form_data JSONB NOT NULL,
  costs JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice para melhorar buscas por user_id
CREATE INDEX IF NOT EXISTS idx_cost_simulations_user_id ON cost_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_simulations_created_at ON cost_simulations(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE cost_simulations ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias simulações
CREATE POLICY IF NOT EXISTS "Users can view their own simulations" 
  ON cost_simulations 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir apenas suas próprias simulações
CREATE POLICY IF NOT EXISTS "Users can create their own simulations" 
  ON cost_simulations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar apenas suas próprias simulações
CREATE POLICY IF NOT EXISTS "Users can update their own simulations" 
  ON cost_simulations 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar apenas suas próprias simulações
CREATE POLICY IF NOT EXISTS "Users can delete their own simulations" 
  ON cost_simulations 
  FOR DELETE 
  USING (auth.uid() = user_id);
