-- ============================================================================
-- SCRIPT COMPLETO PARA CONSOLIDAR HISTÓRICO DE RATEIO
-- ============================================================================
-- Copie este script inteiro e execute no Supabase SQL Editor
-- Dashboard > SQL Editor > Colar tudo > Executar
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA historico_rateio_consolidado (se não existir)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.historico_rateio_consolidado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referências
    bank_transaction_id UUID,
    bank_reconciliation_id UUID REFERENCES public.bank_reconciliations(id) ON DELETE SET NULL,
    lancamento_rateio_id UUID,
    
    -- Dados da aeronave
    aeronave_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
    aeronave_registro VARCHAR(20) NOT NULL,
    
    -- Dados do cliente (sócio)
    cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    cliente_nome VARCHAR(255) NOT NULL,
    
    -- Datas
    data_competencia DATE NOT NULL,
    data_pagamento DATE NOT NULL,
    data_conciliacao TIMESTAMP DEFAULT NOW(),
    
    -- Horas e percentual
    horas_voadas NUMERIC(10, 2) DEFAULT 0,
    horas_totais_aeronave NUMERIC(10, 2),
    percentual_uso NUMERIC(5, 2),
    percentual_participacao NUMERIC(5, 2),
    
    -- Categoria
    categoria_id UUID REFERENCES public.categorias_movimentacao(id),
    categoria_nome VARCHAR(255),
    categoria_grupo VARCHAR(100),
    
    -- Descrição e valores
    descricao TEXT,
    documento_fiscal VARCHAR(100),
    observacao TEXT,
    
    valor_total_lancamento NUMERIC(12, 2) NOT NULL,
    valor_rateado NUMERIC(12, 2) NOT NULL,
    valor_pago NUMERIC(12, 2) NOT NULL,
    
    -- Tipo e status
    tipo_rateio VARCHAR(50),
    foi_reembolso BOOLEAN DEFAULT FALSE,
    reembolso_id UUID,
    status VARCHAR(50) DEFAULT 'consolidado',
    
    -- Auditoria
    consolidado_por UUID REFERENCES public.auth.users(id),
    consolidado_em TIMESTAMP DEFAULT NOW(),
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_historico_cliente ON public.historico_rateio_consolidado(cliente_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_historico_aeronave ON public.historico_rateio_consolidado(aeronave_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_historico_status ON public.historico_rateio_consolidado(status);
CREATE INDEX IF NOT EXISTS idx_historico_categoria_grupo ON public.historico_rateio_consolidado(categoria_grupo);
CREATE INDEX IF NOT EXISTS idx_historico_data_competencia ON public.historico_rateio_consolidado(data_competencia);
CREATE INDEX IF NOT EXISTS idx_historico_foi_reembolso ON public.historico_rateio_consolidado(foi_reembolso);

-- ============================================================================
-- 2. FUNÇÃO PRINCIPAL: Consolidar rateio_despesas para histórico
-- ============================================================================
-- Descrição: Lê dados de rateio_despesas e cria registros em historico_rateio_consolidado
-- Inclui:
--   - Dados de cada sócio/cliente
--   - Calcula percentual_participacao baseado em horas voadas
--   - Filtra apenas categorias: REEMBOLSOS, Despesas Aeronave, RECEITAS OPERACIONAIS, DESPESAS REEMBOLSÁVEIS
--   - Busca horas voadas do cliente/aeronave
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_despesas_para_historico(
    p_bank_reconciliation_id UUID,
    p_consolidado_por UUID DEFAULT NULL
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_historico_ids UUID[] := ARRAY[]::UUID[];
    v_banco_rec RECORD;
    v_rateio RECORD;
    v_cliente_data RECORD;
    v_categoria_data RECORD;
    v_aeronave_data RECORD;
    v_horas_voadas NUMERIC;
    v_horas_totais NUMERIC;
    v_percentual_uso NUMERIC;
    v_percentual_participacao NUMERIC;
    v_historico_id UUID;
    v_foi_reembolso BOOLEAN;
    v_categoria_grupos TEXT[] := ARRAY['REEMBOLSOS', 'Despesas Aeronave', 'RECEITAS OPERACIONAIS', 'DESPESAS REEMBOLSÁVEIS'];
BEGIN
    -- 1. Buscar dados do banco_reconciliations
    SELECT * INTO v_banco_rec
    FROM public.bank_reconciliations
    WHERE id = p_bank_reconciliation_id;
    
    IF v_banco_rec IS NULL THEN
        RAISE EXCEPTION 'bank_reconciliation não encontrado: %', p_bank_reconciliation_id;
    END IF;
    
    -- 2. Processar cada rateio dessa despesa
    FOR v_rateio IN
        SELECT 
            rd.id,
            rd.despesa_id,
            rd.client_id,
            rd.client_name,
            rd.aeronave_id,
            rd.aeronave_registro,
            rd.percentual,
            rd.valor,
            rd.valor_rateado,
            rd.status,
            rd.data_vencimento,
            rd.categoria_id,
            rd.boleto,
            rd.nota_fiscal,
            rd.observacoes,
            rd.created_at
        FROM public.rateio_despesas rd
        WHERE rd.despesa_id = p_bank_reconciliation_id
    LOOP
        -- 3. Buscar dados do cliente
        SELECT id, company_name INTO v_cliente_data
        FROM public.clients
        WHERE id = v_rateio.client_id;
        
        IF v_cliente_data IS NULL THEN
            RAISE WARNING 'Cliente não encontrado: %', v_rateio.client_id;
            CONTINUE;
        END IF;
        
        -- 4. Buscar dados da categoria
        SELECT id, nome, grupo_categoria, reembolsavel INTO v_categoria_data
        FROM public.categorias_movimentacao
        WHERE id = v_rateio.categoria_id;
        
        IF v_categoria_data IS NULL THEN
            RAISE WARNING 'Categoria não encontrada: %', v_rateio.categoria_id;
            CONTINUE;
        END IF;
        
        -- 5. Validar se categoria está nos grupos permitidos
        IF NOT (v_categoria_data.grupo_categoria = ANY(v_categoria_grupos)) THEN
            RAISE WARNING 'Categoria % (grupo: %) não está nos grupos permitidos, pulando...', 
                         v_categoria_data.nome, v_categoria_data.grupo_categoria;
            CONTINUE;
        END IF;
        
        -- 6. Buscar dados da aeronave
        SELECT id, registration INTO v_aeronave_data
        FROM public.aircraft
        WHERE id = v_rateio.aeronave_id;
        
        IF v_aeronave_data IS NULL THEN
            RAISE WARNING 'Aeronave não encontrada: %', v_rateio.aeronave_id;
            CONTINUE;
        END IF;
        
        -- 7. Calcular horas voadas do cliente nessa aeronave (mês da competência)
        SELECT COALESCE(SUM(horas_voadas), 0) INTO v_horas_voadas
        FROM public.horas_voo
        WHERE cliente_id = v_rateio.client_id
        AND aeronave_id = v_rateio.aeronave_id
        AND EXTRACT(YEAR FROM data_voo) = EXTRACT(YEAR FROM v_rateio.data_vencimento)
        AND EXTRACT(MONTH FROM data_voo) = EXTRACT(MONTH FROM v_rateio.data_vencimento);
        
        -- 8. Calcular total de horas da aeronave no período
        SELECT COALESCE(SUM(horas_voadas), 0) INTO v_horas_totais
        FROM public.horas_voo
        WHERE aeronave_id = v_rateio.aeronave_id
        AND EXTRACT(YEAR FROM data_voo) = EXTRACT(YEAR FROM v_rateio.data_vencimento)
        AND EXTRACT(MONTH FROM data_voo) = EXTRACT(MONTH FROM v_rateio.data_vencimento);
        
        -- 9. Calcular percentual de uso
        IF v_horas_totais > 0 AND v_horas_voadas > 0 THEN
            v_percentual_uso := ROUND((v_horas_voadas / v_horas_totais) * 100, 2);
            v_percentual_participacao := ROUND((v_horas_voadas / v_horas_totais) * 100, 2);
        ELSE
            v_percentual_uso := 0;
            v_percentual_participacao := 0;
        END IF;
        
        -- 10. Verificar se é reembolso
        v_foi_reembolso := COALESCE(v_categoria_data.reembolsavel, FALSE);
        
        -- 11. Inserir no histórico consolidado
        INSERT INTO public.historico_rateio_consolidado (
            bank_transaction_id,
            bank_reconciliation_id,
            lancamento_rateio_id,
            aeronave_id,
            aeronave_registro,
            cliente_id,
            cliente_nome,
            data_competencia,
            data_pagamento,
            data_conciliacao,
            horas_voadas,
            horas_totais_aeronave,
            percentual_uso,
            percentual_participacao,
            categoria_id,
            categoria_nome,
            categoria_grupo,
            descricao,
            documento_fiscal,
            observacao,
            valor_total_lancamento,
            valor_rateado,
            valor_pago,
            tipo_rateio,
            foi_reembolso,
            status,
            consolidado_por,
            consolidado_em,
            criado_em,
            atualizado_em
        ) VALUES (
            v_banco_rec.id,
            p_bank_reconciliation_id,
            v_rateio.id,
            v_rateio.aeronave_id,
            v_rateio.aeronave_registro,
            v_rateio.client_id,
            v_rateio.client_name,
            DATE_TRUNC('month', v_rateio.data_vencimento)::DATE,
            COALESCE(v_rateio.data_vencimento, CURRENT_DATE),
            NOW(),
            COALESCE(v_horas_voadas, 0),
            v_horas_totais,
            v_percentual_uso,
            v_percentual_participacao,
            v_rateio.categoria_id,
            v_categoria_data.nome,
            v_categoria_data.grupo_categoria,
            v_banco_rec.description,
            v_rateio.nota_fiscal,
            v_rateio.observacoes,
            v_rateio.valor,
            v_rateio.valor_rateado,
            v_rateio.valor_rateado,
            'rateio_despesas',
            v_foi_reembolso,
            'consolidado',
            COALESCE(p_consolidado_por, auth.uid()),
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO v_historico_id;
        
        -- 12. Adicionar ID ao array de retorno
        v_historico_ids := array_append(v_historico_ids, v_historico_id);
        
        -- 13. Atualizar status do rateio_despesas para 'pago'
        UPDATE public.rateio_despesas
        SET status = 'pago', updated_at = NOW()
        WHERE id = v_rateio.id;
        
        RAISE NOTICE '✅ Consolidado rateio % para cliente % (% horas)', 
                     v_rateio.id, v_cliente_data.company_name, v_horas_voadas;
    END LOOP;
    
    -- 14. Atualizar status do bank_reconciliation para 'consolidado'
    UPDATE public.bank_reconciliations
    SET status = 'consolidado', updated_at = NOW()
    WHERE id = p_bank_reconciliation_id;
    
    RETURN v_historico_ids;
END;
$$;

-- ============================================================================
-- 3. TRIGGER AUTOMÁTICO: Consolidar quando bank_reconciliations é criado/atualizado
-- ============================================================================
-- Este trigger dispara automaticamente a consolidação quando o status muda
CREATE OR REPLACE FUNCTION public.trigger_consolidar_rateio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result UUID[];
BEGIN
    -- Disparar consolidação apenas se:
    -- 1. É tipo_documento = 'rateio' 
    -- 2. Status mudou para 'consolidado' ou 'pago'
    -- 3. Tem rateios pendentes
    
    IF NEW.tipo_documento = 'rateio' AND (NEW.status = 'consolidado' OR NEW.status = 'pago') THEN
        -- Verificar se tem rateios
        IF EXISTS (
            SELECT 1 FROM public.rateio_despesas 
            WHERE despesa_id = NEW.id AND status != 'pago'
        ) THEN
            SELECT public.consolidar_despesas_para_historico(NEW.id, auth.uid()) INTO v_result;
            RAISE NOTICE '🔄 Consolidação automática iniciada para bank_reconciliation %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_consolidar_rateio_on_update ON public.bank_reconciliations;
CREATE TRIGGER trigger_consolidar_rateio_on_update
AFTER UPDATE ON public.bank_reconciliations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_consolidar_rateio();

-- ============================================================================
-- 4. FUNÇÃO DE LEITURA: Obter histórico por cliente (para o dashboard)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.obter_historico_cliente(
    p_cliente_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS TABLE (
    id UUID,
    aeronave_registro VARCHAR,
    categoria_nome VARCHAR,
    categoria_grupo VARCHAR,
    data_competencia DATE,
    data_pagamento DATE,
    horas_voadas NUMERIC,
    percentual_participacao NUMERIC,
    valor_rateado NUMERIC,
    foi_reembolso BOOLEAN,
    descricao TEXT,
    status VARCHAR
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        hrc.id,
        hrc.aeronave_registro,
        hrc.categoria_nome,
        hrc.categoria_grupo,
        hrc.data_competencia,
        hrc.data_pagamento,
        hrc.horas_voadas,
        hrc.percentual_participacao,
        hrc.valor_rateado,
        hrc.foi_reembolso,
        hrc.descricao,
        hrc.status
    FROM public.historico_rateio_consolidado hrc
    WHERE hrc.cliente_id = p_cliente_id
    AND hrc.data_competencia BETWEEN p_data_inicio AND p_data_fim
    AND hrc.status = 'consolidado'
    ORDER BY hrc.data_competencia DESC, hrc.data_pagamento DESC;
$$;

-- ============================================================================
-- 5. CONSOLIDAR DADOS HISTÓRICOS EXISTENTES (executar uma vez)
-- ============================================================================
-- Isso vai preencher o histórico com rateios_despesas que já existem
DO $$
DECLARE
    v_br_id UUID;
    v_count INT;
BEGIN
    -- Encontrar todos os bank_reconciliations com tipo_documento = 'rateio'
    FOR v_br_id IN
        SELECT id FROM public.bank_reconciliations 
        WHERE tipo_documento = 'rateio'
        AND status IN ('consolidado', 'pago')
        AND id NOT IN (SELECT DISTINCT bank_reconciliation_id FROM public.historico_rateio_consolidado WHERE bank_reconciliation_id IS NOT NULL)
    LOOP
        PERFORM public.consolidar_despesas_para_historico(v_br_id);
        RAISE NOTICE '🔄 Consolidado histórico para bank_reconciliation: %', v_br_id;
    END LOOP;
    
    SELECT COUNT(*) INTO v_count FROM public.historico_rateio_consolidado;
    RAISE NOTICE '✅ Consolidação histórica concluída! Total de registros: %', v_count;
END;
$$;

-- ============================================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================================
-- Visualizar resumo do que foi consolidado
SELECT 
    COUNT(*) as total_registros,
    COUNT(DISTINCT cliente_id) as total_clientes,
    COUNT(DISTINCT aeronave_id) as total_aeronaves,
    COUNT(DISTINCT categoria_grupo) as total_categorias,
    SUM(valor_rateado) as valor_total_consolidado,
    SUM(CASE WHEN foi_reembolso THEN 1 ELSE 0 END) as total_reembolsos
FROM public.historico_rateio_consolidado;

-- Mostrar amostra dos dados consolidados
SELECT 
    cliente_nome,
    aeronave_registro,
    categoria_grupo,
    data_competencia,
    horas_voadas,
    percentual_participacao,
    valor_rateado,
    foi_reembolso
FROM public.historico_rateio_consolidado
ORDER BY data_competencia DESC
LIMIT 10;
