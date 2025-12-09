# 📋 Fluxo de Conciliação Bancária - Documentação Atualizada

## 🎯 Visão Geral

A lógica de conciliação bancária foi refatorada para ser **completamente genérica** e funcionar com qualquer categoria de conciliação, não apenas com clientes e colaboradores.

## 🔄 Fluxo Completo

```
CONCILIAÇÃO BANCÁRIA → STATUS "ENVIADO" → CONTA A PAGAR/RECEBER
                    ↓
                    STATUS "CONFERIDO/PAGO" → FLUXO DE CAIXA → MARCA COMO FINALIZADO
```

### 1️⃣ **Criar Conciliação**
- Acesso: `Financeiro → Conciliação Bancária`
- Seleciona: Cliente/Colaborador, Aeronave, Valor, Categoria, etc.
- Status inicial: **PENDENTE**

### 2️⃣ **Marcar como ENVIADO** 
**Ação:** Clica no botão "Enviar por Email"

**O que acontece automaticamente:**
1. Status muda para **ENVIADO** em `bank_reconciliations`
2. **CRIA automaticamente** uma conta a receber ou a pagar:
   - ✅ **Se CLIENTE**: Cria `contas_areceber` com status "pendente"
   - ✅ **Se COLABORADOR**: Cria `contas_apagar` com status "recebida"
3. A conta fica vinculada à conciliação via `banco_conciliacao_id`

**Validações:**
- ✅ Impede duplicação verificando se conta já existe
- ✅ Valida CNPJ/CPF do cliente/colaborador
- ✅ Gera número sequencial automático (CR-XXXX/YY ou CP-XXXX/YY)

### 3️⃣ **Marcar como CONFERIDO/PAGO**
**Ação:** Clica no botão "Conferido" (cliente) ou "Pago" (colaborador)

**Campos Obrigatórios:**
- ✅ Conta Bancária (qual banco recebeu/pagou)
- ⚠️ Comprovante (opcional, para auditoria)

**O que acontece automaticamente:**
1. Status muda para **CONFERIDO** (cliente) ou **PAGO** (colaborador) em `bank_reconciliations`
2. **CRIA entrada no Fluxo de Caixa** (`controle_bancario`):
   - **Tipo Entrada** para clientes (dinheiro que entrou)
   - **Tipo Saída** para colaboradores (dinheiro que saiu)
3. Registra referência: `REC-{id}` ou `PAG-{id}`
4. Registra conta bancária e comprovante

**Validações:**
- ✅ Impede duplicação verificando referência
- ✅ Obriga seleção de banco
- ✅ Valida upload de comprovante

### 4️⃣ **Sincronização com Contas a Pagar/Receber**

**Quando marca como PAGO/RECEBIDO em Contas:**

Se veio de uma conciliação:
1. Status muda para **PAGA** (a pagar) ou **RECEBIDO** (a receber)
2. **Sincroniza automaticamente** status na conciliação para **PAGO/CONFERIDO**
3. **CRIA entrada no Fluxo de Caixa** via função RPC

```
Contas a Pagar/Receber → Marcar como PAGO/RECEBIDO 
                      → Atualiza status conciliação
                      → Cria Fluxo de Caixa
```

## 📊 Tabelas Envolvidas

| Tabela | Descrição |
|--------|-----------|
| `bank_reconciliations` | Conciliações bancárias (cliente/colaborador) |
| `contas_areceber` | Contas a receber (clientes) |
| `contas_apagar` | Contas a pagar (colaboradores) |
| `controle_bancario` | Fluxo de caixa (entradas/saídas) |
| `contas_bancarias` | Contas bancárias cadastradas |

## 🔗 Relacionamentos

```
bank_reconciliations
├── client_id → clients
├── receiver_id → user_profiles
├── aircraft_id → aircraft
└── banco_conciliacao_id ← contas_areceber & contas_apagar
    ├── quando status = "enviado" → cria conta
    └── quando status = "conferido/pago" → cria fluxo_caixa
```

## 🛠️ Funções Utilitárias (`src/lib/reconciliation-utils.ts`)

### `createContaAReceber(reconciliation, userId)`
Cria automaticamente conta a receber para conciliação de cliente.
- Validações: CNPJ, cliente existe
- Impede duplicação
- Retorna ID da conta criada

### `createContaAPagar(reconciliation, userId)`
Cria automaticamente conta a pagar para conciliação de colaborador.
- Validações: CPF, colaborador existe
- Impede duplicação
- Retorna ID da conta criada

### `createFluxoCaixaEntry(reconciliation, status, contaBancaria, comprovanteUrl, userId)`
Cria entrada no fluxo de caixa quando status é final.
- Valida status final (conferido para cliente, pago para colaborador)
- Impede duplicação verificando referência
- Registra banco e comprovante

### `getNextStatus(currentStatus, reconciliationType)`
Retorna lista de status válidos baseado no tipo de conciliação.
```javascript
// Cliente
getNextStatus('pendente', 'cliente') // → ['enviado', 'conferido']
getNextStatus('enviado', 'cliente')  // → ['conferido']

// Colaborador
getNextStatus('pendente', 'colaborador') // → ['enviado', 'pago']
getNextStatus('enviado', 'colaborador')  // → ['pago']
```

### `isStatusFinal(status, reconciliationType)`
Verifica se status é final (conciliação finalizada).

### `isStatusEnviado(status)`
Verifica se status é "enviado".

## ✅ Validações e Segurança

| Validação | Onde | Descrição |
|-----------|------|-----------|
| Impede duplicação de contas | StatusUpdateDialog | Verifica `banco_conciliacao_id` |
| Impede duplicação fluxo caixa | createFluxoCaixaEntry | Verifica referência `REC-*` ou `PAG-*` |
| Banco obrigatório ao finalizar | StatusUpdateDialog | Campo obrigatório quando status final |
| CNPJ/CPF válido | createContaAReceber/APagar | Valida dados antes de criar conta |
| Cliente/Colaborador existe | createContaAReceber/APagar | Verifica existência no banco |

## 🔄 Fluxos de Exceção

### Cenário 1: Criar conta manualmente
1. Você pode criar conta a pagar/receber manualmente sem conciliação
2. Nesse caso, `banco_conciliacao_id` fica NULL
3. Ao marcar como pago/recebido, cria fluxo de caixa normalmente

### Cenário 2: Editar status
1. Pode voltar de "conferido" para "enviado"
2. Não deleta fluxo de caixa (para auditoria)
3. Fluxo de caixa fica registrado com status anterior

### Cenário 3: Conciliação de viagem
1. Quando de viagem (contém "RELATORIO DE VIAGEM" na descrição)
2. Sincroniza status automaticamente em `travel_expense_reports`
3. Exemplo: Conciliação "conferido" → Relatório "pago"

## 🚀 Como Usar

### Para Clientes

1. **Criar Conciliação**
   ```
   Financeiro → Conciliação Bancária → Abas "Clientes"
   → Clique "Nova Conciliação" 
   → Selecione Cliente e Aeronave
   ```

2. **Enviar por Email**
   ```
   Ao clicar "Enviar", cria automaticamente:
   - Conta a Receber
   - Com número (CR-0001/24, etc)
   - Com status "pendente"
   ```

3. **Conferir/Receber Pagamento**
   ```
   Clique ícone "Conferido"
   → Selecione Banco
   → (Opcional) Upload Comprovante
   → Clique "Atualizar"
   
   Cria automaticamente:
   - Fluxo de Caixa (ENTRADA)
   - Com referência REC-{id}
   - Com status "confirmado"
   ```

### Para Colaboradores

1. **Criar Conciliação**
   ```
   Financeiro → Conciliação Bancária → Aba "Colaborador"
   → Clique "Nova Conciliação"
   → Selecione Colaborador
   ```

2. **Enviar por Email**
   ```
   Ao clicar "Enviar", cria automaticamente:
   - Conta a Pagar
   - Com número (CP-0001/24, etc)
   - Com status "recebida"
   ```

3. **Marcar como Pago**
   ```
   Clique ícone "Pago"
   → Selecione Banco
   → (Opcional) Upload Comprovante
   → Clique "Atualizar"
   
   Cria automaticamente:
   - Fluxo de Caixa (SAÍDA)
   - Com referência PAG-{id}
   - Com status "confirmado"
   ```

## 🎯 Benefícios da Nova Implementação

✅ **Genérica**: Funciona com qualquer tipo de conciliação (cliente, colaborador, ou futuros)
✅ **Sem Duplicação**: Validações impedem criação dupla de contas/fluxo
✅ **Sincronização**: Manter dados consistentes entre conciliação → conta → fluxo
✅ **Auditoria**: Rastreamento completo via referências
✅ **Flexível**: Pode criar contas manualmente também
✅ **Robusto**: Tratamento de erros e validações em múltiplas camadas

## 📝 Próximos Passos Opcionais

- [ ] Criar RPC para sincronizar fluxo de caixa quando edita contas
- [ ] Adicionar relatório integrado: Conciliação → Conta → Fluxo
- [ ] Adicionar webhooks para notificar quando status muda
- [ ] Criar dashboard unificado de conciliação/fluxo
- [ ] Adicionar validação de valores entre contas e fluxo

---

**Versão:** 2.0 (Refatorado - Genérico)
**Data:** 2024
**Autor:** Sistema de Conciliação Bancária Share Brasil
