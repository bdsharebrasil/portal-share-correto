-- Tabela de Sócios vinculados a Aeronaves
CREATE TABLE IF NOT EXISTS aircraft_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quota_hours DECIMAL(10, 2) DEFAULT 0,
  balance_hours DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aircraft_id, partner_id)
);

-- Tabela de Transações de Câmbio de Horas
CREATE TABLE IF NOT EXISTS hour_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  from_partner_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  to_partner_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hours DECIMAL(10, 2) NOT NULL,
  type TEXT CHECK (type IN ('loan', 'swap', 'correction')), -- 'loan' = empréstimo automático, 'swap' = troca manual
  description TEXT,
  logbook_entry_id UUID REFERENCES logbook_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_aircraft_partners_aircraft_id ON aircraft_partners(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_partners_partner_id ON aircraft_partners(partner_id);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_aircraft_id ON hour_transactions(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_created_at ON hour_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_from_partner ON hour_transactions(from_partner_id);
CREATE INDEX IF NOT EXISTS idx_hour_transactions_to_partner ON hour_transactions(to_partner_id);

-- RLS Policies para aircraft_partners
ALTER TABLE aircraft_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler aircraft_partners"
ON aircraft_partners FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Gestor pode editar aircraft_partners"
ON aircraft_partners FOR UPDATE
USING (auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'operacoes'))
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'operacoes'));

CREATE POLICY "Admin/Gestor pode criar aircraft_partners"
ON aircraft_partners FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'operacoes'));

CREATE POLICY "Admin pode deletar aircraft_partners"
ON aircraft_partners FOR DELETE
USING (auth.jwt() ->> 'role' IN ('admin', 'gestor_master'));

-- RLS Policies para hour_transactions
ALTER TABLE hour_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler hour_transactions"
ON hour_transactions FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin/Gestor pode criar hour_transactions"
ON hour_transactions FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'piloto_chefe', 'operacoes'));

CREATE POLICY "Admin pode editar hour_transactions"
ON hour_transactions FOR UPDATE
USING (auth.jwt() ->> 'role' IN ('admin', 'gestor_master'))
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'gestor_master'));

CREATE POLICY "Admin pode deletar hour_transactions"
ON hour_transactions FOR DELETE
USING (auth.jwt() ->> 'role' = 'admin');
