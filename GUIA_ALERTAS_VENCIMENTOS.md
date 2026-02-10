# Sistema de Alertas de Vencimentos - Guia de Implementação

## Visão Geral

Este guia descreve como o novo sistema de alertas de vencimentos foi implementado. O sistema permite que todos os usuários recebam notificações sobre vencimentos (CMA, licenças, manutenção, documentos, etc.) e gerenciem essas notificações individualmente através de ações como "Descartar" ou "Agendar para depois".

## Arquivos Criados

### 1. Hook: `src/hooks/useExpirationAlerts.ts`
**Responsabilidade**: Gerenciar toda a lógica de alertas de vencimentos.

**Funcionalidades**:
- Busca alertas do banco de dados
- Filtra alertas baseado nas preferências do usuário (snooze, dismissed)
- Permite descartar ou agendar alertas novamente
- Escuta mudanças em tempo real (Realtime Subscriptions)
- Atualiza a cada 5 minutos via polling

**Métodos Principais**:
```typescript
// Busca todos os alertas
useExpirationAlerts(userId)

// Descartar um alerta
dismissAlert(alertId: string)

// Agendar para depois (snooze)
snoozeAlert(alertId: string, daysToSnooze: number)

// Filtrar por severidade
getAlertsBySeverity(severity: 'info' | 'warning' | 'critical' | 'expired')

// Filtrar por tipo
getAlertsByType(type: 'cma' | 'license' | 'maintenance' | 'document')
```

### 2. Componente: `src/components/alerts/ExpirationAlertDialog.tsx`
**Responsabilidade**: Exibir um modal com detalhes do alerta.

**Características**:
- Mostra título, descrição e data de vencimento
- Permite escolher período de snooze (1, 3, 7, 14, 30 dias)
- Botões para descartar ou agendar
- Design responsivo com cores diferentes por severidade
- Lembrança de que cada usuário gerencia individualmente seus alertas

**Severidades e cores**:
- 🔴 **Vencido** (Vermelho): Itens que já venceram
- 🟠 **Crítico** (Laranja): Vence em 15 dias ou menos
- 🟡 **Atenção** (Amarelo): Vence em 30 dias
- 🔵 **Informação** (Azul): Vence em 60 dias ou mais

### 3. Componente: `src/components/alerts/ExpirationAlertsContainer.tsx`
**Responsabilidade**: Exibir notificações de alertas na tela.

**Características**:
- Mostra notificações em estilo toast no topo da tela
- Agrupa alertas por severidade
- Cada notificação é clicável e abre o modal
- Animações suaves
- Desaparece automaticamente quando descartadas ou agendadas

### 4. Contexto: `src/contexts/ExpirationAlertsContext.tsx`
**Responsabilidade**: Prover o contexto global dos alertas.

**Características**:
- Encapsula o componente `ExpirationAlertsContainer`
- Permite acesso às funcionalidades de alertas em qualquer parte da aplicação

### 5. Integração no App: `src/App.tsx`
**Mudanças**:
- Adicionado import do `ExpirationAlertsProvider`
- Provider envolvido nos demais providers para estar disponível globalmente
- Localizado após `VencimentosSyncProvider`

## Como Funciona

### Fluxo de Execução

1. **Carregamento**: Quando um usuário entra na aplicação, o `ExpirationAlertsProvider` inicializa
2. **Fetch Inicial**: O hook busca todos os alertas no banco e as preferências do usuário
3. **Filtragem**: Alertas são filtrados removendo os que foram descartados ou agendados (snooze)
4. **Exibição**: Os alertas filtrados aparecem como notificações na tela
5. **Interação**: Usuário clica em um alerta para abrir o modal
6. **Ação**: Usuário escolhe descartar ou agendar para depois
7. **Persistência**: A ação é salva no banco de dados na tabela `user_alert_preferences`

### Preferências do Usuário

Cada usuário pode ter diferentes ações para o mesmo alerta:
- **dismissed**: Alerta foi descartado e não aparecerá mais
- **snoozed**: Alerta foi agendado para reaparecer em uma data específica

As preferências são armazenadas na tabela `user_alert_preferences` e são únicas por usuário + alerta (UNIQUE constraint).

## Estrutura de Dados

### Tabela: `expiration_alerts`
```sql
- id: UUID (primary key)
- alert_type: 'cma', 'license', 'maintenance', 'document'
- reference_id: UUID (referencia o item que vence)
- reference_table: nome da tabela (crew_licenses, maintenance_items, etc)
- title: título do alerta
- description: descrição detalhada
- entity_name: nome da entidade (tripulante, aeronave, etc)
- expiry_date: data de vencimento
- days_until_expiry: dias até vencimento (positivo ou negativo)
- severity: 'info', 'warning', 'critical', 'expired'
- created_at: quando o alerta foi criado
- updated_at: quando o alerta foi atualizado
```

### Tabela: `user_alert_preferences`
```sql
- id: UUID (primary key)
- user_id: UUID (referencia usuario autenticado)
- alert_id: UUID (referencia o alerta)
- action: 'dismissed' ou 'snoozed'
- snoozed_until: data até quando o alerta está agendado (NULL se dismissed)
- created_at: quando a preferência foi criada
- updated_at: quando foi atualizada
- UNIQUE(user_id, alert_id) - garante uma preferência por usuario+alerta
```

## Configuração do Banco de Dados

### 1. Criar as tabelas

Use o script SQL fornecido no início do documento:

```sql
CREATE TABLE public.expiration_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  reference_table TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity_name TEXT,
  expiry_date DATE NOT NULL,
  days_until_expiry INTEGER NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES public.expiration_alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'dismissed',
  snoozed_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, alert_id)
);
```

### 2. Habilitar Row Level Security (RLS)

```sql
ALTER TABLE public.expiration_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;
```

### 3. Criar as Policies

```sql
-- Todos os usuários autenticados podem ver alertas
CREATE POLICY "All authenticated users can view alerts"
ON public.expiration_alerts FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Usuários autenticados podem gerenciar alertas
CREATE POLICY "Authenticated users can manage alerts"
ON public.expiration_alerts FOR ALL
USING (auth.uid() IS NOT NULL);

-- Usuários gerenciam suas próprias preferências
CREATE POLICY "Users manage own alert preferences"
ON public.user_alert_preferences FOR ALL
USING (auth.uid() = user_id);
```

### 4. Criar Índices para Performance

```sql
CREATE INDEX idx_expiration_alerts_expiry ON public.expiration_alerts(expiry_date);
CREATE INDEX idx_expiration_alerts_type ON public.expiration_alerts(alert_type);
CREATE INDEX idx_user_alert_prefs_user ON public.user_alert_preferences(user_id);
CREATE INDEX idx_user_alert_prefs_alert ON public.user_alert_preferences(alert_id);
```

### 5. Função para Atualizar Alertas Automáticamente

Implemente a função `refresh_expiration_alerts()` conforme fornecido no script original. Esta função:
- Verifica licenças de tripulantes (CMA)
- Calcula dias até vencimento
- Define severidade automaticamente
- Cria ou atualiza alertas no banco
- Remove alertas fora do intervalo (> 60 dias)

**Como usar a função**:

```sql
-- Executar manualmente (por exemplo, via cron)
SELECT refresh_expiration_alerts();

-- Ou criar um trigger para rodar automaticamente quando crew_licenses muda
CREATE TRIGGER update_alerts_on_license_change
AFTER INSERT OR UPDATE ON crew_licenses
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_expiration_alerts();
```

## Usando o Sistema

### Para Mostrar Alertas em Qualquer Página

```typescript
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { useAuth } from '@/contexts/AuthContext';

export function MyPage() {
  const { user } = useAuth();
  const { visibleAlerts, dismissAlert, snoozeAlert } = useExpirationAlerts(user?.id || null);

  // visibleAlerts contém apenas os alertas que devem ser mostrados
  // Filtre, ordene ou agrupe conforme necessário
  
  return (
    <div>
      {visibleAlerts.map(alert => (
        <div key={alert.id}>
          <h3>{alert.title}</h3>
          <p>{alert.description}</p>
          <button onClick={() => dismissAlert(alert.id)}>Descartar</button>
          <button onClick={() => snoozeAlert(alert.id, 7)}>Agendar 7 dias</button>
        </div>
      ))}
    </div>
  );
}
```

### Para Filtrar Alertas

```typescript
const { visibleAlerts, getAlertsBySeverity, getAlertsByType } = useExpirationAlerts(userId);

// Apenas alertas críticos
const critical = getAlertsBySeverity('critical');

// Apenas alertas de CMA
const cmaAlerts = getAlertsByType('cma');

// Alertas vencidos
const expired = getAlertsBySeverity('expired');
```

## Comportamento Esperado

### Exemplo: CMA de Tripulante

1. **José da Silva** tem CMA que vence em **16 dias**
2. No dia seguinte (**15 dias restantes**):
   - Um alerta é criado na tabela `expiration_alerts` com severidade **critical**
   - O alerta aparece para **todos os usuários** na tela
3. **João** (administrador):
   - Vê o alerta e clica para abrir o modal
   - Escolhe "Descartar" para não ver mais
   - Sua preferência é salva com action = 'dismissed'
4. **Maria** (gerente):
   - Vê o mesmo alerta
   - Clica para abrir o modal
   - Escolhe "Agendar para 7 dias"
   - Sua preferência é salva com action = 'snoozed' e snoozed_until = data de hoje + 7 dias
5. Próximo dia:
   - Maria não vê mais o alerta (está snoozed)
   - João continua não vendo (foi dismissed)
   - **Pedro** (novo usuário ou que ainda não viu):
     - Vê o alerta normalmente (14 dias restantes agora)

## Troubleshooting

### Alertas não aparecem
1. Verifique se a tabela `expiration_alerts` tem dados
2. Confirme se o usuário está autenticado
3. Verifique se há preferências conflitantes (dismissed = true)
4. Abra o console do navegador e procure por erros

### Alertas desaparecem depois de descartar
Isso é comportamento esperado! O alerta foi descartado (dismissed = true) e só reaparecerá se:
- A preferência for deletada
- Ou a data do snooze passar

### Realtime updates não funcionam
1. Verifique se o Supabase Realtime está habilitado
2. Confirme as policies de RLS estão corretas
3. O polling a cada 5 minutos é o fallback

## Performance e Otimizações

### Índices
Os índices foram criados para:
- `expiry_date`: Buscar alertas próximos do vencimento
- `alert_type`: Filtrar por tipo
- `user_id`: Buscar preferências do usuário
- `alert_id`: Unir alertas com preferências

### Polling vs Realtime
- **Realtime**: Ideal para atualizações instantâneas
- **Polling (5 min)**: Fallback e evita overload
- Combine ambas para melhor UX

### Limpeza de Alertas Antigos
A função `refresh_expiration_alerts()` remove alertas mais de 60 dias antes do vencimento para evitar poluição de dados.

## Próximos Passos

1. **Testar** o sistema com dados reais
2. **Monitorar** a performance com muitos alertas
3. **Ajustar** as severidades conforme necessário
4. **Comunicar** aos usuários sobre o novo sistema
5. **Coletar feedback** e melhorar a UX

## Suporte

Para dúvidas ou problemas, verifique:
1. Os logs do console do navegador
2. Os logs do Supabase
3. O estado das tabelas no banco
4. As policies de RLS estão habilitadas
