# Sistema de Vínculo Automático de Solicitações de Pagamento

## Visão Geral

O sistema de solicitações de pagamento agora possui um mecanismo robusto de vínculo automático com registros existentes de combustíveis (abastecimentos) e despesas de viagem, evitando duplicação de registros e mantendo rastreabilidade completa da origem dos gastos.

## Funcionalidades Implementadas

### 1. Detecção Automática de Duplicatas

Quando uma solicitação de pagamento é criada com tipo de despesa "COMBUSTÍVEIS" ou "DESPESAS DE VIAGEM", o sistema:

- **Busca automaticamente** em registros existentes de `abastecimentos` ou `travel_expense_reports`
- **Aplica validações multi-nível** para encontrar correspondências (exata, forte, média)
- **Exibe avisos visuais** ao usuário quando encontra um registro similar
- **Reutiliza o registro existente** em vez de duplicar

### 2. Algoritmo de Busca de Combustíveis

O sistema busca por correspondência em três níveis:

1. **EXATA**: Cliente + Valor + Data
   - Tem a maior prioridade
   - Indica que é muito provável ser o mesmo abastecimento

2. **FORTE**: Cliente + Valor + NF (Nota Fiscal)
   - Segunda prioridade
   - Busca especificamente por número de NF

3. **MÉDIA**: Cliente + Valor (com tolerância de 0,01)
   - Fallback para casos onde data/NF não estão disponíveis
   - Usa margem de tolerância para valores aproximados

**Arquivo**: `src/components/dashboard/financeiro/solicitacaoPagamentoValidators.ts`

```typescript
findExistingFuelReference(candidate, registros): FuelCandidate | null
```

### 3. Algoritmo de Busca de Despesas de Viagem

Busca por correspondência em três níveis:

1. **EXATA**: Cliente + Valor Total do Relatório
   - Match direto com o total do relatório

2. **FORTE**: Cliente + Valor + Descrição em Alguma Despesa
   - Busca a descrição dentro das despesas individuais do relatório
   - Valida se o valor também corresponde

3. **MÉDIA**: Cliente + Valor Aproximado
   - Fallback para casos onde descrição não é clara

**Arquivo**: `src/components/dashboard/financeiro/solicitacaoPagamentoValidators.ts`

```typescript
findExistingTravelExpenseReference(candidate, registros): TravelExpenseCandidate | null
```

### 4. Fluxo de Validação em Tempo Real

No componente `SolicitacaoPagamentoModal.tsx`:

1. **Debounce de 500ms** - Para evitar requisições em excesso enquanto o usuário digita
2. **Verificação automática** - Acionada quando muda: cliente, tipo de despesa, valor, data ou descrição
3. **Exibição de aviso** - Mostra mensagem verde quando encontra um registro existente
4. **Confirmação implícita** - Ao clicar em "Salvar", o usuário confirma o vínculo

### 5. Vínculo nos Registros

Quando uma solicitação é salva com uma referência encontrada:

#### Na tabela `movimentacoes`:
```typescript
{
  reference_type: "abastecimento" | "travel_expense_report",
  reference_id: "<id_do_registro_original>",
  // ... outros campos
}
```

#### Na tabela `rateio_despesas`:
```typescript
{
  fonte_despesa: "abastecimento" | "travel_expense_report",
  // ... outros campos (mantém rastreabilidade)
}
```

#### Na tabela `contas_apagar`:
```typescript
{
  // Armazena metadados sobre a origem
  // ... outros campos
}
```

## Fluxo de Uso

### Cenário 1: Combustível (Abastecimento)

1. Usuário abre "Programar Pagamento"
2. Seleciona Cliente e tipo "COMBUSTÍVEIS"
3. Preenche Valor, Data, Descrição
4. Sistema busca automaticamente em `abastecimentos`
5. Se encontra correspondência:
   - Exibe aviso verde: "✓ Abastecimento encontrado: O registro será reutilizado..."
   - Mostra data e valor do abastecimento existente
6. Usuário clica "Enviar"
7. Sistema vincula `reference_type="abastecimento"` e `reference_id=<id>`

### Cenário 2: Despesa de Viagem

1. Usuário abre "Programar Pagamento"
2. Seleciona Cliente e tipo "DESPESAS DE VIAGEM"
3. Preenche Valor, Descrição (ex: "Hotel em São Paulo")
4. Sistema busca em `travel_expense_reports`
5. Se encontra correspondência:
   - Exibe aviso verde: "✓ Relatório de viagem encontrado..."
   - Mostra valor total do relatório
6. Usuário clica "Enviar"
7. Sistema vincula `reference_type="travel_expense_report"` e `reference_id=<id>`

### Cenário 3: Sem Duplicata

1. Se o tipo de despesa for "OUTRA" (não é combustível nem viagem)
   - Sem busca de duplicata
   - Cria registro normalmente com `reference_type=null`

2. Se tipo for combustível/viagem mas não encontrar correspondência:
   - Cria registro novo com `reference_type=null`
   - Sem aviso de duplicata

## Campos de Configuração

### Tipos de Despesa Reconhecidos

O sistema normaliza nomes de tipos de despesa:

- **COMBUSTÍVEIS**: Qualquer tipo contendo "COMBUST" (ex: "Combustível", "COMBUSTÍVEL")
- **DESPESAS DE VIAGEM**: Contém "DESPESA" E "VIAGEM" (ex: "Despesa de Viagem", "DESPESAS_VIAGEM")
- **OUTRA**: Todos os demais (ex: "Manutenção", "Hotel", "Consultoria")

**Função de Normalização**:
```typescript
normalizarTipoDespesa(label: string): TipoDespesaCategoria
```

## API de Dados

### Tabelas Envolvidas

| Tabela | Função |
|--------|--------|
| `clientes` | Seleção de cliente na solicitação |
| `abastecimentos` | Busca de combustíveis existentes |
| `travel_expense_reports` | Busca de despesas de viagem |
| `movimentacoes` | Armazena referência (`reference_type`, `reference_id`) |
| `rateio_despesas` | Armazena origem (`fonte_despesa`) |
| `contas_apagar` | Registra conta a pagar |
| `contas_areceber` | Se marcado como reembolsável |

### Campos Críticos

#### `abastecimentos`
- `id`: ID único
- `id_clientes`: Cliente associado
- `valor_total`: Valor do abastecimento
- `data`: Data do abastecimento
- `nf`: Número de nota fiscal

#### `travel_expense_reports`
- `id`: ID único
- `clientes_id`: Cliente associado
- `total_valor`: Valor total do relatório
- `despesas`: JSON array com itens de despesa

## Limitações e Considerações

1. **Busca limitada a 50 registros** - Para otimizar performance, a busca se restringe aos últimos 50 registros de cada tipo
2. **Tolerância de valor** - Usa margem de 0.01 para comparação de valores (centavos)
3. **Case-insensitive** - Comparações de texto ignoram maiúsculas/minúsculas
4. **Sem deduplicação forçada** - O sistema avisa, mas permite que o usuário crie duplicatas se confirmar

## Troubleshooting

### A busca não está encontrando um abastecimento que existe

**Causas possíveis:**
1. Abastecimento é de outro cliente
2. Valor diferente (diferença > 0.01)
3. Data diferente (quando busca por correspondência EXATA)
4. Abastecimento foi criado há mais de 50 registros atrás

**Solução:**
- Verificar cliente selecionado
- Verificar valor exato do abastecimento
- Se necessário, aumentar limite de registros em `findExistingFuelReference`

### Sistema não está criando o vínculo

**Causas possíveis:**
1. Tipo de despesa não está normalizado corretamente
2. Validação falha antes de salvar
3. Erro ao gravar em `movimentacoes`

**Solução:**
- Verificar console para mensagens de erro
- Validar que `reference_type` está sendo salvo em `movimentacoes`
- Verificar logs de requisição ao Supabase

## Melhorias Futuras

1. **Integração com UI Cotista** - Adicionar seção em "Financeiro Cotista" mostrando vínculos
2. **Webhook de sincronização** - Quando abastecimento é marcado como pago, atualizar solicitação
3. **Busca de NF** - Adicionar campo de NF para busca mais precisa
4. **Histórico de referências** - Mostrar qual solicitação foi vinculada a qual origem
5. **Bulk linking** - Vincular múltiplas solicitações de uma vez
6. **Configuração de tolerância** - Permitir admin configurar margem de tolerância

## Contato / Dúvidas

Para dúvidas sobre implementação ou bugs, abra uma issue referenciando `SOLICITACAO_PAGAMENTO_LINKING.md`.
