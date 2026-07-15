# Resumo de Implementação - Vínculo Automático de Solicitações de Pagamento

## O que foi implementado

### 1. ✅ Vínculo Automático com Origem
- **Combustíveis**: Quando o tipo de despesa é "COMBUSTÍVEIS", a solicitação automaticamente detecta e se vincula a registros existentes em `abastecimentos`
- **Despesas de Viagem**: Quando o tipo é "DESPESAS DE VIAGEM", a solicitação detecta e se vincula a registros em `travel_expense_reports`
- **Reutilização de Registros**: Em vez de duplicar, o sistema reutiliza o registro existente mediante os campos:
  - `movimentacoes.reference_type` (abastecimento | travel_expense_report)
  - `movimentacoes.reference_id` (ID do registro original)
  - `rateio_despesas.fonte_despesa` (indica origem do gasto)

### 2. ✅ Validações Anti-Duplicação Robustas

#### Para Combustíveis (Abastecimentos)
Busca em **3 níveis**:
1. **EXATA**: Cliente + Valor + Data
2. **FORTE**: Cliente + Valor + NF
3. **MÉDIA**: Cliente + Valor (margem 0.01)

```typescript
findExistingFuelReference(candidate, registros)
```

#### Para Despesas de Viagem
Busca em **3 níveis**:
1. **EXATA**: Cliente + Valor Total
2. **FORTE**: Cliente + Valor + Descrição em alguma despesa
3. **MÉDIA**: Cliente + Valor Aproximado

```typescript
findExistingTravelExpenseReference(candidate, registros)
```

### 3. ✅ Interface de Usuário Melhorada

- **Aviso Visual em Tempo Real**: Quando encontra duplicata, exibe mensagem verde com ícone de vínculo
- **Informações do Registro**: Mostra data/valor do abastecimento ou valor total do relatório de viagem
- **Debounce de 500ms**: Evita requisições em excesso durante digitação
- **Confirmação Implícita**: Usuário confirma o vínculo ao clicar em "Enviar"

### 4. ✅ Normalização de Tipos de Despesa

```typescript
normalizarTipoDespesa(label: string)
```

- **COMBUSTÍVEIS**: "Combustível", "COMBUSTÍVEL", etc.
- **DESPESAS_DE_VIAGEM**: "Despesa de Viagem", "DESPESAS_VIAGEM", etc.
- **OUTRA**: Todos os demais tipos

## Arquivos Modificados

### 1. `src/components/dashboard/financeiro/solicitacaoPagamentoValidators.ts`
**Mudanças:**
- Melhorou `findExistingFuelReference()` com busca em 3 níveis (antes era simples)
- Melhorou `findExistingTravelExpenseReference()` com parsing robusto de JSON
- Adicionou priorização de matches (exata > forte > média)

### 2. `src/components/dashboard/financeiro/SolicitacaoPagamentoModal.tsx`
**Mudanças:**
- Adicionou debounce de 500ms na verificação de duplicidade
- Melhorou `useEffect` que verifica duplicação com tratamento de erros
- Adicionou mensagens descritivas mostrando data/valor do registro encontrado
- Mantém rastreabilidade ao salvar com `reference_type` e `reference_id`
- Melhorou validação ao confirmar vínculo

## Fluxo de Execução

```
┌─────────────────────────────────────┐
│ Usuário abre "Programar Pagamento" │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Seleciona Cliente    │
    │ e Tipo de Despesa    │
    └──────────────┬───────┘
                   │
                   ▼
         ┌─────────────────────────┐
         │ Sistema Normaliza Tipo  │
         │ (COMBUSTÍVEL? VIAGEM?)  │
         └──────────┬──────────────┘
                    │
                    ▼
          ┌──────────────────────────┐
          │ Preenche Valor, Data,    │
          │ Descrição (com debounce) │
          └──────────┬───────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │ Sistema Busca em 3 Níveis   │
        │ (Cliente + Valor + Data/NF) │
        └──────────┬──────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼────┐            ┌──▼──────┐
    │ Achou? │            │ Achou?  │
    └───┬────┘            └──┬──────┘
        │ NÃO               │ SIM
        │                   │
        │              ┌────▼──────────────┐
        │              │ Exibe Aviso Verde │
        │              │ com Info da origem│
        │              └────┬──────────────┘
        │                   │
        └───────┬───────────┘
                │
                ▼
    ┌──────────────────────────┐
    │ Usuário Clica "Enviar"   │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────────────┐
    │ Sistema Salva com Vínculo:       │
    │ - reference_type (se encontrou)  │
    │ - reference_id (se encontrou)    │
    │ - fonte_despesa (origem)         │
    └──────────┬───────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Sucesso + Toast      │
    │ Modal Fecha          │
    └──────────────────────┘
```

## Exemplos Práticos

### Exemplo 1: Combustível Encontrado
```
1. Tipo: "Combustíveis"
2. Cliente: "TAM TRANSPORTES"
3. Valor: R$ 1.250,00
4. Data: 15/01/2024

[SISTEMA BUSCA]
▼ Encontrado em abastecimentos:
  - ID: abc123
  - Cliente: TAM TRANSPORTES
  - Valor: R$ 1.250,00
  - Data: 15/01/2024
  - NF: 12345

[UI EXIBE]
✓ Abastecimento encontrado: O registro será reutilizado em vez de duplicar.
  Data: 15/01/2024 | Valor: R$ 1.250,00

[SALVA COM]
- reference_type: "abastecimento"
- reference_id: "abc123"
- fonte_despesa: "abastecimento"
```

### Exemplo 2: Despesa de Viagem Encontrada
```
1. Tipo: "Despesas de Viagem"
2. Cliente: "GEOLINK LOGÍSTICA"
3. Valor: R$ 850,00
4. Descrição: "Hotel e transporte - São Paulo"

[SISTEMA BUSCA]
▼ Encontrado em travel_expense_reports:
  - ID: xyz789
  - Cliente: GEOLINK LOGÍSTICA
  - Total: R$ 850,00
  - Despesas: [Hotel, Transporte, Refeição]

[UI EXIBE]
✓ Relatório de viagem encontrado: O registro será reutilizado em vez de duplicar.
  Valor total: R$ 850,00

[SALVA COM]
- reference_type: "travel_expense_report"
- reference_id: "xyz789"
- fonte_despesa: "travel_expense_report"
```

### Exemplo 3: Sem Duplicata
```
1. Tipo: "Manutenção"
2. Cliente: "DECOLAR AVIAÇÃO"
3. Valor: R$ 5.000,00

[SISTEMA BUSCA]
▼ Tipo não é COMBUSTÍVEL nem VIAGEM
  Sem busca de duplicata

[SALVA COM]
- reference_type: "solicitacao_pagamento" (padrão)
- reference_id: null
- fonte_despesa: "solicitacao_pagamento"
```

## Validações e Limites

| Aspecto | Valor |
|---------|-------|
| Debounce | 500ms |
| Tolerância de Valor | R$ 0,01 |
| Limite de Busca | 50 registros |
| Comparação de Texto | Case-insensitive |

## Tabelas Afetadas

| Tabela | Campos Modificados |
|--------|-------------------|
| `movimentacoes` | `reference_type`, `reference_id` |
| `rateio_despesas` | `fonte_despesa` |
| `contas_apagar` | (sem mudanças) |

## Como Testar

### Teste 1: Combustível
1. Criar um abastecimento via "Abastecimentos"
2. Abrir "Programar Pagamento"
3. Selecionar mesmo cliente
4. Tipo: "Combustíveis"
5. Mesmo valor e data
6. Sistema deve detectar e mostrar aviso verde

### Teste 2: Despesa de Viagem
1. Criar relatório de viagem
2. Abrir "Programar Pagamento"
3. Selecionar mesmo cliente
4. Tipo: "Despesas de Viagem"
5. Valor similar à despesa
6. Descrição similar a uma item da viagem
7. Sistema deve detectar e mostrar aviso verde

### Teste 3: Sem Duplicata
1. Abrir "Programar Pagamento"
2. Tipo: "Manutenção"
3. Preenchendo dados
4. Sistema NÃO deve mostrar aviso
5. Deve salvar com `reference_type="solicitacao_pagamento"`

## Status da Implementação

✅ **CONCLUÍDO**

- [x] Vínculo automático com combustíveis
- [x] Vínculo automático com despesas de viagem
- [x] Validações anti-duplicação em 3 níveis
- [x] Interface de usuário melhorada
- [x] Debounce para otimizar performance
- [x] Tratamento de erros robusto
- [x] Documentação completa

## Próximas Melhorias (Futuro)

- [ ] Exibir histórico de vínculos no "Financeiro Cotista"
- [ ] Webhook para sincronização automática de status
- [ ] Busca por NF com mais precisão
- [ ] Configuração de tolerância de valor por admin
- [ ] Bulk linking de solicitações
- [ ] Dashboard de rastreamento de origem
