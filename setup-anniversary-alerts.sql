-- ============================================================================
-- SETUP: Tabelas de Alertas de Aniversários
-- Criado para: Portal ShareBrasil
-- Data: 2025-02-10
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELAS
-- ============================================================================

-- Tabela de alertas de aniversários
CREATE TABLE IF NOT EXISTS public.anniversary_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('crew_member', 'employee', 'contact', 'client')),
  person_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  days_until_birthday INTEGER NOT NULL,
  is_today BOOLEAN NOT NULL DEFAULT false,
  is_upcoming BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, person_type)
);

-- Tabela de preferências de alertas de aniversário por usuário
CREATE TABLE IF NOT EXISTS public.user_anniversary_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES public.anniversary_alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'acknowledged' CHECK (action IN ('dismissed', 'acknowledged')),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, alert_id)
);

-- ============================================================================
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.anniversary_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_anniversary_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CRIAR POLICIES DE SEGURANÇA
-- ============================================================================

-- Policy para anniversary_alerts
-- Todos os usuários autenticados podem visualizar todos os alertas
CREATE POLICY "All authenticated users can view anniversary alerts" ON public.anniversary_alerts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usuários autenticados podem gerenciar alertas
CREATE POLICY "Authenticated users can manage anniversary alerts" ON public.anniversary_alerts
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Policy para user_anniversary_preferences
-- Usuários podem gerenciar apenas suas próprias preferências
CREATE POLICY "Users manage own anniversary alert preferences" ON public.user_anniversary_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own anniversary alert preferences insert" ON public.user_anniversary_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own anniversary alert preferences update" ON public.user_anniversary_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own anniversary alert preferences delete" ON public.user_anniversary_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para anniversary_alerts
CREATE INDEX IF NOT EXISTS idx_anniversary_alerts_person ON public.anniversary_alerts(person_id, person_type);
CREATE INDEX IF NOT EXISTS idx_anniversary_alerts_days ON public.anniversary_alerts(days_until_birthday);
CREATE INDEX IF NOT EXISTS idx_anniversary_alerts_today ON public.anniversary_alerts(is_today) WHERE is_today = true;
CREATE INDEX IF NOT EXISTS idx_anniversary_alerts_upcoming ON public.anniversary_alerts(is_upcoming) WHERE is_upcoming = true;

-- Índices para user_anniversary_preferences
CREATE INDEX IF NOT EXISTS idx_user_anniversary_prefs_user ON public.user_anniversary_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_anniversary_prefs_alert ON public.user_anniversary_preferences(alert_id);
CREATE INDEX IF NOT EXISTS idx_user_anniversary_prefs_action ON public.user_anniversary_preferences(action);

-- ============================================================================
-- 5. FUNÇÃO PARA ATUALIZAR ALERTAS DE ANIVERSÁRIOS AUTOMATICAMENTE
-- ============================================================================

-- Essa função verifica aniversários de tripulantes e funcionários
-- Deve ser executada diariamente (de preferência à meia-noite)
CREATE OR REPLACE FUNCTION public.refresh_anniversary_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  days_remaining INTEGER;
  is_today BOOLEAN;
  is_upcoming BOOLEAN;
  next_birthday DATE;
BEGIN
  -- ===== PROCESSAR TRIPULANTES =====
  FOR rec IN
    SELECT 
      cm.id,
      cm.birth_date,
      cm.full_name,
      'crew_member'::TEXT as person_type
    FROM crew_members cm
    WHERE cm.birth_date IS NOT NULL
  LOOP
    -- Calcular próximo aniversário
    next_birthday := DATE_TRUNC('year', CURRENT_DATE)::DATE + (EXTRACT(MONTH FROM rec.birth_date)::TEXT || '-' || EXTRACT(DAY FROM rec.birth_date)::TEXT)::INTERVAL;
    
    -- Se já passou este ano, próximo será no ano que vem
    IF next_birthday < CURRENT_DATE THEN
      next_birthday := next_birthday + '1 year'::INTERVAL;
    END IF;
    
    days_remaining := (next_birthday - CURRENT_DATE)::INTEGER;
    is_today := days_remaining = 0;
    is_upcoming := days_remaining >= 0 AND days_remaining <= 60;
    
    -- Inserir ou ignorar se já existe
    INSERT INTO anniversary_alerts (
      person_id,
      person_type,
      person_name,
      birth_date,
      days_until_birthday,
      is_today,
      is_upcoming,
      updated_at
    )
    VALUES (
      rec.id,
      rec.person_type,
      rec.full_name,
      rec.birth_date,
      days_remaining,
      is_today,
      is_upcoming,
      now()
    )
    ON CONFLICT (person_id, person_type) DO NOTHING;
    
    -- Atualizar alerta existente
    UPDATE anniversary_alerts
    SET 
      days_until_birthday = days_remaining,
      is_today = is_today,
      is_upcoming = is_upcoming,
      updated_at = now()
    WHERE person_id = rec.id
      AND person_type = rec.person_type;
  END LOOP;

  -- ===== PROCESSAR FUNCIONÁRIOS =====
  FOR rec IN
    SELECT 
      em.id,
      em.date_of_birth,
      em.full_name,
      'employee'::TEXT as person_type
    FROM employees em
    WHERE em.date_of_birth IS NOT NULL
  LOOP
    -- Calcular próximo aniversário
    next_birthday := DATE_TRUNC('year', CURRENT_DATE)::DATE + (EXTRACT(MONTH FROM rec.date_of_birth)::TEXT || '-' || EXTRACT(DAY FROM rec.date_of_birth)::TEXT)::INTERVAL;
    
    -- Se já passou este ano, próximo será no ano que vem
    IF next_birthday < CURRENT_DATE THEN
      next_birthday := next_birthday + '1 year'::INTERVAL;
    END IF;
    
    days_remaining := (next_birthday - CURRENT_DATE)::INTEGER;
    is_today := days_remaining = 0;
    is_upcoming := days_remaining >= 0 AND days_remaining <= 60;
    
    INSERT INTO anniversary_alerts (
      person_id,
      person_type,
      person_name,
      birth_date,
      days_until_birthday,
      is_today,
      is_upcoming,
      updated_at
    )
    VALUES (
      rec.id,
      rec.person_type,
      rec.full_name,
      rec.date_of_birth,
      days_remaining,
      is_today,
      is_upcoming,
      now()
    )
    ON CONFLICT (person_id, person_type) DO NOTHING;
    
    UPDATE anniversary_alerts
    SET 
      days_until_birthday = days_remaining,
      is_today = is_today,
      is_upcoming = is_upcoming,
      updated_at = now()
    WHERE person_id = rec.id
      AND person_type = rec.person_type;
  END LOOP;

  -- ===== LIMPAR ALERTAS EXPIRADOS =====
  -- Remover alertas de aniversários que já passaram há mais de 1 dia
  DELETE FROM anniversary_alerts
  WHERE days_until_birthday < -1;

  RAISE NOTICE 'Função refresh_anniversary_alerts executada com sucesso em %', now();
END;
$$;

-- ============================================================================
-- 6. TRIGGER PARA ATUALIZAR ALERTAS AUTOMATICAMENTE
-- ============================================================================

-- Executar a função quando crew_members mudar
CREATE OR REPLACE TRIGGER trigger_refresh_anniversary_alerts_on_crew_member
AFTER INSERT OR UPDATE OR DELETE ON crew_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_anniversary_alerts();

-- Executar a função quando employees mudar
CREATE OR REPLACE TRIGGER trigger_refresh_anniversary_alerts_on_employee
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_anniversary_alerts();

-- ============================================================================
-- 7. OPERAÇÕES ÚTEIS
-- ============================================================================

-- Para executar a função manualmente:
-- SELECT refresh_anniversary_alerts();

-- Para ver alertas de hoje:
-- SELECT * FROM anniversary_alerts WHERE is_today = true;

-- Para ver alertas dos próximos 7 dias:
-- SELECT * FROM anniversary_alerts WHERE days_until_birthday > 0 AND days_until_birthday <= 7 ORDER BY days_until_birthday;

-- Para ver preferências do usuário:
-- SELECT * FROM user_anniversary_preferences WHERE user_id = 'seu-user-id';

-- ============================================================================
-- 8. VERIFICAÇÃO
-- ============================================================================

-- Verificar se as tabelas foram criadas
-- \dt public.anniversary_alerts
-- \dt public.user_anniversary_preferences

-- Verificar as policies
-- \dp public.anniversary_alerts
-- \dp public.user_anniversary_preferences

-- Verificar os índices
-- \di public.idx_anniversary_*

RAISE NOTICE 'Setup de alertas de aniversários completado com sucesso!';
