-- ============================================================================
-- RLS POLICIES - FINANCEIRO SÓCIOS
-- ============================================================================
-- Políticas de Row Level Security para partner_accounts, partner_expenses e partner_transactions
-- Roles: ADMIN, GESTOR_MASTER, FINANCEIRO_MASTER (CRUD completo)
--        CLIENTE (apenas SELECT/visualização)
-- ============================================================================

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.partner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTNER_ACCOUNTS POLICIES
-- ============================================================================

-- Admin, Gestor Master, Financeiro Master: SELECT (Visualizar)
CREATE POLICY partner_accounts_select_admin 
ON public.partner_accounts 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Cliente: SELECT (Visualizar apenas seus próprios dados)
CREATE POLICY partner_accounts_select_cliente 
ON public.partner_accounts 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' = 'cliente'
  AND client_id = (
    SELECT id FROM auth.users WHERE id = auth.uid()
  )
);

-- Admin, Gestor Master, Financeiro Master: INSERT
CREATE POLICY partner_accounts_insert_admin 
ON public.partner_accounts 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: UPDATE
CREATE POLICY partner_accounts_update_admin 
ON public.partner_accounts 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: DELETE
CREATE POLICY partner_accounts_delete_admin 
ON public.partner_accounts 
FOR DELETE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- ============================================================================
-- PARTNER_EXPENSES POLICIES
-- ============================================================================

-- Admin, Gestor Master, Financeiro Master: SELECT
CREATE POLICY partner_expenses_select_admin 
ON public.partner_expenses 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Cliente: SELECT (apenas seus próprios gastos via partner_accounts.client_id)
CREATE POLICY partner_expenses_select_cliente 
ON public.partner_expenses 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' = 'cliente'
  AND account_id IN (
    SELECT id FROM public.partner_accounts 
    WHERE client_id = (SELECT id FROM auth.users WHERE id = auth.uid())
  )
);

-- Admin, Gestor Master, Financeiro Master: INSERT
CREATE POLICY partner_expenses_insert_admin 
ON public.partner_expenses 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: UPDATE
CREATE POLICY partner_expenses_update_admin 
ON public.partner_expenses 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: DELETE
CREATE POLICY partner_expenses_delete_admin 
ON public.partner_expenses 
FOR DELETE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- ============================================================================
-- PARTNER_TRANSACTIONS POLICIES
-- ============================================================================

-- Admin, Gestor Master, Financeiro Master: SELECT
CREATE POLICY partner_transactions_select_admin 
ON public.partner_transactions 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Cliente: SELECT (apenas suas próprias transações)
CREATE POLICY partner_transactions_select_cliente 
ON public.partner_transactions 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' = 'cliente'
  AND account_id IN (
    SELECT id FROM public.partner_accounts 
    WHERE client_id = (SELECT id FROM auth.users WHERE id = auth.uid())
  )
);

-- Admin, Gestor Master, Financeiro Master: INSERT
CREATE POLICY partner_transactions_insert_admin 
ON public.partner_transactions 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: UPDATE
CREATE POLICY partner_transactions_update_admin 
ON public.partner_transactions 
FOR UPDATE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
)
WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- Admin, Gestor Master, Financeiro Master: DELETE
CREATE POLICY partner_transactions_delete_admin 
ON public.partner_transactions 
FOR DELETE 
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master')
);

-- ============================================================================
-- RESUMO DAS POLÍTICAS
-- ============================================================================
-- 
-- PARTNER_ACCOUNTS:
--   ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER: SELECT, INSERT, UPDATE, DELETE
--   CLIENTE: SELECT (apenas seus próprios dados)
--
-- PARTNER_EXPENSES:
--   ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER: SELECT, INSERT, UPDATE, DELETE
--   CLIENTE: SELECT (apenas gastos de suas contas)
--
-- PARTNER_TRANSACTIONS:
--   ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER: SELECT, INSERT, UPDATE, DELETE
--   CLIENTE: SELECT (apenas transações de suas contas)
--
-- ============================================================================
-- NOTAS DE IMPLEMENTAÇÃO
-- ============================================================================
--
-- 1. Certifique-se que auth.users tem a coluna 'role' ou que está usando JWT claims
--    Se usar JWT claims, você já pode executar as políticas acima.
--
-- 2. Se usar coluna 'role' na tabela users, ajuste a query conforme necessário:
--    auth.jwt() ->> 'role' → (SELECT role FROM auth.users WHERE id = auth.uid())
--
-- 3. Os JWTs devem conter a claim 'role' com valores:
--    - 'admin'
--    - 'gestor_master'
--    - 'financeiro_master'
--    - 'cliente'
--
-- 4. O client_id deve corresponder ao auth.uid() do usuário cliente
--
-- 5. Para visualizar as políticas criadas, execute:
--    SELECT * FROM pg_policies WHERE tablename LIKE 'partner_%';
--
-- ============================================================================
