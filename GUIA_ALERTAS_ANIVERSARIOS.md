# Sistema de Alertas de Aniversários - Guia de Implementação

## Visão Geral

Este guia descreve como o novo sistema de alertas de aniversários foi implementado. O sistema permite que todos os usuários recebam notificações sobre aniversários de tripulantes, funcionários, contatos e clientes, podendo gerenciar essas notificações individualmente.

## Arquivos Criados

### 1. Hook: `src/hooks/useAnniversaryAlerts.ts`
**Responsabilidade**: Gerenciar toda a lógica de alertas de aniversários.

**Funcionalidades**:
- Busca alertas do banco de dados
- Filtra alertas baseado nas preferências do usuário
- Permite descartar ou reconhecer alertas
- Escuta mudanças em tempo real
- Atualiza a cada 30 minutos via polling

**Métodos Principais**:
```typescript
// Busca todos os alertas
useAnniversaryAlerts(userId)

// Descartar um alerta
dismissAlert(alertId: string)

// Marcar como visto
acknowledgeAlert(alertId: string)

// Obter aniversários de hoje
getTodaysBirthdays()

// Obter próximos aniversários (7 dias)
getUpcomingBirthdays()

// Obter todos próximos (30 dias)
getAllUpcoming()
```

### 2. Componente: `src/components/alerts/AnniversaryAlertDialog.tsx`
**Responsabilidade**: Exibir um modal com detalhes do aniversário.

**Características**:
- Mostra nome, data de nascimento e idade
- Mensagem de felicitação
- Botões: Descartar e Marcar como Visto
- Design responsivo com cores diferentes
- Destaque especial para aniversários de hoje

### 3. Componente: `src/components/alerts/AnniversaryAlertsContainer.tsx`
**Responsabilidade**: Exibir notificações de aniversários na tela.

**Características**:
- Notificações em estilo toast no topo da tela
- Aniversários de hoje destacados em rosa/pink
- Próximos aniversários em azul
- Cada notificação é clicável e abre o modal
- Ordenação: hoje primeiro, depois por data próxima

### 4. Contexto: `src/contexts/AnniversaryAlertsContext.tsx`
**Responsabilidade**: Prover o contexto global dos alertas.

**Características**:
- Encapsula o componente `AnniversaryAlertsContainer`
- Permite acesso às funcionalidades em qualquer parte da aplicação

### 5. Integração no App: `src/App.tsx`
**Mudanças**:
- Adicionado import do `AnniversaryAlertsProvider`
- Provider envolvido nos demais providers

## Como Funciona

### Fluxo de Execução

1. **Carregamento**: Quando um usuário entra na aplicação
2. **Fetch Inicial**: O hook busca todos os aniversários nos próximos 60 dias
3. **Filtragem**: Alertas são filtrados baseado nas preferências do usuário
4. **Exibição**: Os alertas aparecem como notificações (hoje em destaque)
5. **Interação**: Usuário clica para abrir o modal
6. **Ação**: Usuário escolhe descartar ou marcar como visto
7. **Persistência**: A ação é salva no banco

### Preferências do Usuário

Cada usuário pode ter diferentes ações para cada aniversário:
- **dismissed**: Alerta foi descartado
- **acknowledged**: Alerta foi marcado como visto

As preferências são armazenadas em `user_anniversary_preferences` e são únicas por usuário + alerta.

## Estrutura de Dados

### Tabela: `anniversary_alerts`
```sql
- id: UUID (primary key)
- person_id: UUID (ID da pessoa)
- person_type: 'crew_member', 'employee', 'contact', 'client'
- person_name: nome da pessoa
- birth_date: data de nascimento
- days_until_birthday: dias até o aniversário
- is_today: booleano indicando se é hoje
- is_upcoming: booleano indicando se é nos próximos 60 dias
- created_at: quando foi criado
- updated_at: quando foi atualizado
```

### Tabela: `user_anniversary_preferences`
```sql
- id: UUID (primary key)
- user_id: UUID (referencia usuario)
- alert_id: UUID (referencia o alerta)
- action: 'dismissed' ou 'acknowledged'
- acknowledged_at: timestamp quando reconheceu
- created_at: quando foi criado
- updated_at: quando foi atualizado
- UNIQUE(user_id, alert_id)
```

## Configuração do Banco de Dados

### 1. Criar as tabelas

Execute o script SQL fornecido:

```bash
# No Supabase SQL Editor:
# Cole o conteúdo de: setup-anniversary-alerts.sql
# Clique em Run
```

### 2. Habilitar Row Level Security

Já está incluído no script SQL.

### 3. Criar as Policies

Já estão incluídas no script SQL.

### 4. Criar Índices

Já estão incluídos no script SQL.

### 5. Função para Atualizar Alertas

Já está incluída no script SQL e é acionada automaticamente via trigger.

## Usando o Sistema

### Uso Básico

```typescript
import { useAnniversaryAlerts } from '@/hooks/useAnniversaryAlerts';
import { useAuth } from '@/contexts/AuthContext';

export function MyPage() {
  const { user } = useAuth();
  const { visibleAlerts, dismissAlert } = useAnniversaryAlerts(user?.id || null);

  return (
    <div>
      {visibleAlerts.map(alert => (
        <div key={alert.id}>
          <h3>{alert.person_name}</h3>
          <p>Data: {new Date(alert.birth_date).toLocaleDateString('pt-BR')}</p>
          <button onClick={() => dismissAlert(alert.id)}>Descartar</button>
        </div>
      ))}
    </div>
  );
}
```

### Filtrar Alertas

```typescript
const { getTodaysBirthdays, getUpcomingBirthdays, getAllUpcoming } = useAnniversaryAlerts(userId);

// Apenas de hoje
const today = getTodaysBirthdays();

// Próximos 7 dias
const nextWeek = getUpcomingBirthdays();

// Próximos 30 dias
const nextMonth = getAllUpcoming();
```

## Comportamento Esperado

### Exemplo: Aniversário de Tripulante

1. **José da Silva** faz aniversário em **15 de fevereiro**
2. **14 de fevereiro** (1 dia antes):
   - Alerta é criado/atualizado na tabela
   - Aparece para **todos os usuários** como "Próximo"
3. **15 de fevereiro** (o dia):
   - Alerta é atualizado: `is_today = true`
   - Aparece para todos como "HOJE!" em destaque (rosa)
4. **João** (administrador):
   - Vê o alerta destacado
   - Clica para abrir o modal
   - Escolhe "Descartar"
   - Não vê mais este alerta
5. **Maria** (gerente):
   - Vê o mesmo alerta
   - Clica para abrir o modal
   - Escolhe "Marcar como Visto"
   - Alerta permanece visível (para futuros aniversários)

## Diferenças com Sistema de Vencimentos

| Aspecto | Vencimentos | Aniversários |
|---------|-----------|------------|
| **Ações** | Descartar, Agendar | Descartar, Marcar como Visto |
| **Período** | Até 60 dias | Até 60 dias (próximo aniversário) |
| **Recorrência** | Anual (cada ano) | Anual (cada ano) |
| **Cores** | Vermelho, Laranja, Amarelo, Azul | Rosa (hoje), Azul (próximos) |
| **Ícones** | ⚠️ Alertas | 🎂🎁 Presentes |
| **Prioridade** | Hoje, depois próximos | Hoje em destaque |

## Próximos Passos

1. **Executar Script SQL**
   - Abra Supabase → SQL Editor
   - Cole: setup-anniversary-alerts.sql
   - Execute

2. **Testar Manualmente**
   - Inserir dados de teste
   - Verificar se alertas aparecem

3. **Integrar em Outras Páginas**
   - Use os exemplos fornecidos
   - Mostre aniversários em dashboards
   - Crie widgets especiais

4. **Personalizar Conforme Necessário**
   - Ajuste cores e ícones
   - Adicione mais tipos de pessoa (se necessário)
   - Crie templates de mensagens de felicitação

## Troubleshooting

### Alertas não aparecem
1. Verifique se o script SQL foi executado
2. Verifique se há dados de nascimento na tabela
3. Verifique se `is_upcoming = true`

### RLS error
1. Verifique se RLS está habilitado
2. Verifique as policies

### Dados não atualizando
1. Execute `SELECT refresh_anniversary_alerts();`
2. Ou aguarde o trigger ser acionado

## Performance e Otimizações

### Índices Criados
- `person_id, person_type`: Busca rápida
- `days_until_birthday`: Filtro por intervalo de dias
- `is_today`: Busca de aniversários de hoje
- `is_upcoming`: Busca de próximos aniversários

### Polling vs Realtime
- **Realtime**: Atualizações instantâneas
- **Polling (30 min)**: Fallback e evita overload

## Suporte

Para dúvidas, consulte:
1. Este arquivo (GUIA_ALERTAS_ANIVERSARIOS.md)
2. O arquivo de exemplos (quando criado)
3. Os logs do Supabase
4. O console do navegador
