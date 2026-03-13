-- Adicionar novos status ao ciclo de voo: 'pago' e 'enviado_ao_cliente'
-- Assumindo que a coluna status é uma enum ou check constraint

-- Se for uma enum PostgreSQL, use:
-- ALTER TYPE flight_cycle_status ADD VALUE 'pago';
-- ALTER TYPE flight_cycle_status ADD VALUE 'enviado_ao_cliente';

-- Se for uma coluna text com check constraint, adicione os valores à constraint
-- Primeiro, verificar a constraint atual e atualizá-la

-- Para simplificar, assumindo que é uma coluna text sem constraint rígida,
-- mas para garantir compatibilidade, vamos adicionar uma migration que verifica e atualiza

DO $$
BEGIN
    -- Verificar se a enum existe e adicionar valores se necessário
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'flight_cycle_status') THEN
        -- Adicionar valores à enum se não existirem
        BEGIN
            ALTER TYPE flight_cycle_status ADD VALUE IF NOT EXISTS 'pago';
        EXCEPTION WHEN OTHERS THEN
            -- Valor já existe, ignorar
            NULL;
        END;

        BEGIN
            ALTER TYPE flight_cycle_status ADD VALUE IF NOT EXISTS 'enviado_ao_cliente';
        EXCEPTION WHEN OTHERS THEN
            -- Valor já existe, ignorar
            NULL;
        END;
    END IF;
END $$;