-- ============================================================================
-- SETUP: Tabelas de Alertas de Vencimentos
-- Criado para: Portal ShareBrasil
-- Data: 2025-02-10
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELAS
-- ============================================================================

-- Tabela de alertas de vencimentos
CREATE TABLE IF NOT EXISTS public.expiration_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('cma', 'license', 'maintenance', 'document')),
  reference_id UUID NOT NULL,
  reference_table TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity_name TEXT,
  expiry_date DATE NOT NULL,
  days_until_expiry INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de preferências de alertas por usuário
CREATE TABLE IF NOT EXISTS public.user_alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES public.expiration_alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'dismissed' CHECK (action IN ('dismissed', 'snoozed')),
  snoozed_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, alert_id)
);

-- ============================================================================
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.expiration_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CRIAR POLICIES DE SEGURANÇA
-- ============================================================================

-- Policy para expiration_alerts
-- Todos os usuários autenticados podem visualizar todos os alertas
CREATE POLICY "All authenticated users can view alerts" ON public.expiration_alerts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usuários autenticados podem gerenciar alertas (insert, update, delete)
-- Em produção, considere restringir para apenas admins
CREATE POLICY "Authenticated users can manage alerts" ON public.expiration_alerts
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policy para user_alert_preferences
-- Usuários podem gerenciar apenas suas próprias preferências
CREATE POLICY "Users manage own alert preferences" ON public.user_alert_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own alert preferences insert" ON public.user_alert_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own alert preferences update" ON public.user_alert_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own alert preferences delete" ON public.user_alert_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para expiration_alerts
CREATE INDEX IF NOT EXISTS idx_expiration_alerts_expiry ON public.expiration_alerts(expiry_date);
CREATE INDEX IF NOT EXISTS idx_expiration_alerts_type ON public.expiration_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_expiration_alerts_severity ON public.expiration_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_expiration_alerts_reference ON public.expiration_alerts(reference_id, reference_table);

-- Índices para user_alert_preferences
CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_user ON public.user_alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_alert ON public.user_alert_preferences(alert_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_action ON public.user_alert_preferences(action);
CREATE INDEX IF NOT EXISTS idx_user_alert_prefs_snoozed ON public.user_alert_preferences(snoozed_until)
  WHERE action = 'snoozed' AND snoozed_until IS NOT NULL;

-- ============================================================================
-- 5. FUNÇÃO PARA ATUALIZAR ALERTAS AUTOMATICAMENTE
-- ============================================================================

-- Essa função verifica as licenças de tripulantes e cria/atualiza alertas
-- Deve ser executada periodicamente (por exemplo, diariamente)
CREATE OR REPLACE FUNCTION public.refresh_expiration_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  days_remaining INTEGER;
  alert_severity TEXT;
  alert_title TEXT;
  alert_desc TEXT;
BEGIN
  -- ===== PROCESSAR CMA DE TRIPULANTES =====
  FOR rec IN
    SELECT 
      cl.id,
      cl.validade_cma,
      cl.license_type,
      cl.CMA,
      cm.full_name
    FROM crew_licenses cl
    JOIN crew_members cm ON cm.id = cl.crew_member_id
    WHERE cl.validade_cma IS NOT NULL
  LOOP
    days_remaining := (rec.validade_cma - CURRENT_DATE);
    
    -- Criar alertas apenas para itens vencendo em até 60 dias
    IF days_remaining <= 60 THEN
      -- Determinar severidade baseado em dias restantes
      IF days_remaining < 0 THEN
        alert_severity := 'expired';
        alert_title := 'CMA VENCIDO - ' || rec.full_name;
        alert_desc := 'O CMA do tripulante ' || rec.full_name || ' venceu há ' || ABS(days_remaining) || ' dias.';
      ELSIF days_remaining <= 15 THEN
        alert_severity := 'critical';
        alert_title := 'CMA Crítico - ' || rec.full_name;
        alert_desc := 'O CMA do tripulante ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      ELSIF days_remaining <= 30 THEN
        alert_severity := 'warning';
        alert_title := 'CMA Atenção - ' || rec.full_name;
        alert_desc := 'O CMA do tripulante ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      ELSE
        alert_severity := 'info';
        alert_title := 'CMA Info - ' || rec.full_name;
        alert_desc := 'O CMA do tripulante ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      END IF;

      -- Inserir ou ignorar se já existe
      INSERT INTO expiration_alerts (
        alert_type,
        reference_id,
        reference_table,
        title,
        description,
        entity_name,
        expiry_date,
        days_until_expiry,
        severity,
        updated_at
      )
      VALUES (
        'cma',
        rec.id,
        'crew_licenses',
        alert_title,
        alert_desc,
        rec.full_name,
        rec.validade_cma,
        days_remaining,
        alert_severity,
        now()
      )
      ON CONFLICT DO NOTHING;
      
      -- Atualizar alerta existente
      UPDATE expiration_alerts
      SET 
        title = alert_title,
        description = alert_desc,
        days_until_expiry = days_remaining,
        severity = alert_severity,
        updated_at = now()
      WHERE reference_id = rec.id
        AND reference_table = 'crew_licenses'
        AND alert_type = 'cma';
    END IF;
  END LOOP;

  -- ===== PROCESSAR LICENÇAS DE TRIPULANTES =====
  FOR rec IN
    SELECT 
      cl.id,
      cl.expiry_date,
      cl.license_type,
      cm.full_name
    FROM crew_licenses cl
    JOIN crew_members cm ON cm.id = cl.crew_member_id
    WHERE cl.expiry_date IS NOT NULL
  LOOP
    days_remaining := (rec.expiry_date - CURRENT_DATE);
    
    IF days_remaining <= 60 THEN
      IF days_remaining < 0 THEN
        alert_severity := 'expired';
        alert_title := rec.license_type || ' VENCIDA - ' || rec.full_name;
        alert_desc := 'A habilitação ' || rec.license_type || ' de ' || rec.full_name || ' venceu há ' || ABS(days_remaining) || ' dias.';
      ELSIF days_remaining <= 15 THEN
        alert_severity := 'critical';
        alert_title := rec.license_type || ' Crítica - ' || rec.full_name;
        alert_desc := 'A habilitação ' || rec.license_type || ' de ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      ELSIF days_remaining <= 30 THEN
        alert_severity := 'warning';
        alert_title := rec.license_type || ' Atenção - ' || rec.full_name;
        alert_desc := 'A habilitação ' || rec.license_type || ' de ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      ELSE
        alert_severity := 'info';
        alert_title := rec.license_type || ' Info - ' || rec.full_name;
        alert_desc := 'A habilitação ' || rec.license_type || ' de ' || rec.full_name || ' vence em ' || days_remaining || ' dias.';
      END IF;

      INSERT INTO expiration_alerts (
        alert_type,
        reference_id,
        reference_table,
        title,
        description,
        entity_name,
        expiry_date,
        days_until_expiry,
        severity,
        updated_at
      )
      VALUES (
        'license',
        rec.id,
        'crew_licenses',
        alert_title,
        alert_desc,
        rec.full_name,
        rec.expiry_date,
        days_remaining,
        alert_severity,
        now()
      )
      ON CONFLICT DO NOTHING;

      UPDATE expiration_alerts
      SET 
        title = alert_title,
        description = alert_desc,
        days_until_expiry = days_remaining,
        severity = alert_severity,
        updated_at = now()
      WHERE reference_id = rec.id
        AND reference_table = 'crew_licenses'
        AND alert_type = 'license';
    END IF;
  END LOOP;

  -- ===== LIMPAR ALERTAS ANTIGOS =====
  -- Remover alertas de itens que vencerão em mais de 60 dias
  DELETE FROM expiration_alerts
  WHERE (expiry_date - CURRENT_DATE) > 60
    AND alert_type IN ('cma', 'license');

  RAISE NOTICE 'Função refresh_expiration_alerts executada com sucesso em %', now();
END;
$$;

-- ============================================================================
-- 6. TRIGGER PARA ATUALIZAR ALERTAS AUTOMATICAMENTE
-- ============================================================================

-- Executar a função quando crew_licenses mudar
CREATE OR REPLACE TRIGGER trigger_refresh_expiration_alerts_on_crew_license
AFTER INSERT OR UPDATE OR DELETE ON crew_licenses
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_expiration_alerts();

-- ============================================================================
-- 7. OPERAÇÕES ÚTEIS
-- ============================================================================

-- Para executar a função manualmente:
-- SELECT refresh_expiration_alerts();

-- Para ver alertas ativos (não descartados):
-- SELECT a.* FROM expiration_alerts a
-- LEFT JOIN user_alert_preferences p ON a.id = p.alert_id
-- WHERE p.id IS NULL OR (p.action = 'snoozed' AND p.snoozed_until > CURRENT_DATE);

-- Para ver preferências do usuário:
-- SELECT * FROM user_alert_preferences WHERE user_id = 'seu-user-id';

-- ============================================================================
-- 8. VERIFICAÇÃO
-- ============================================================================

-- Verificar se as tabelas foram criadas
-- \dt public.expiration_alerts
-- \dt public.user_alert_preferences

-- Verificar as policies
-- \dp public.expiration_alerts
-- \dp public.user_alert_preferences

-- Verificar os índices
-- \di public.idx_*

RAISE NOTICE 'Setup de alertas de vencimentos completado com sucesso!';
