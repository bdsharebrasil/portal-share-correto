-- Remover policies existentes
DROP POLICY IF EXISTS "Enable read access for all users" ON logbook_months;
DROP POLICY IF EXISTS "Usuários podem ler diários" ON logbook_months;
DROP POLICY IF EXISTS "Semente admin/gestor/piloto chefe podem editar e fechar" ON logbook_months;

-- Policy SELECT: Todos autenticados podem LER
CREATE POLICY "Usuários autenticados podem ler diários" 
ON logbook_months 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Policy UPDATE: Apenas admin, gestor_master, piloto_chefe e operacoes podem EDITAR
CREATE POLICY "Admin/Gestor/Piloto pode editar diários" 
ON logbook_months 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'piloto_chefe', 'gestor_master', 'operacoes')
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'piloto_chefe', 'gestor_master', 'operacoes')
);

-- Policy INSERT: Apenas admin, gestor_master, piloto_chefe e operacoes podem CRIAR
CREATE POLICY "Admin/Gestor/Piloto pode criar diários" 
ON logbook_months 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'piloto_chefe', 'gestor_master', 'operacoes')
);

-- Policy DELETE: Admin e gestor_master podem DELETAR
CREATE POLICY "Admin e gestor_master podem deletar diários"
ON logbook_months
FOR DELETE
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master')
);
