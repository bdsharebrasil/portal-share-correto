# Documentação - Financeiro Sócios

## Estrutura do Banco de Dados

O módulo "Financeiro Sócios" utiliza 3 tabelas principais para gerenciar contas, transações e despesas dos parceiros (sócios) dos clientes.

---

## 1. Tabela: `partner_accounts`

**Descrição:** Armazena as contas e saldos dos parceiros/sócios de cada cliente.

### Campos:
- `id` (UUID) - Chave primária
- `client_id` (UUID) - Referência ao cliente (FK: clients.id)
- `partner_cpf` (TEXT) - CPF do parceiro
- `partner_name` (TEXT) - Nome do parceiro
- `current_balance` (NUMERIC 10,2) - Saldo atual (padrão: 0.00)
- `total_deposited` (NUMERIC 10,2) - Total depositado (padrão: 0.00)
- `total_spent` (NUMERIC 10,2) - Total gasto (padrão: 0.00)
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

### Constraints:
- **PK:** partner_accounts_pkey (id)
- **UNIQUE:** unique_partner_per_client (client_id, partner_cpf)
- **FK:** partner_accounts_client_id_fkey → clients(id)

### Índices:
- `idx_partner_accounts_client` - Busca por cliente
- `idx_partner_accounts_cpf` - Busca por CPF

### Uso no Código:
```typescript
// Hook: useFinanceiroSocios.ts
useSocioAccounts(clientId) // Busca todas as contas de um cliente
useAddDeposit() // Registra novo depósito e atualiza saldo
```

---

## 2. Tabela: `partner_expenses`

**Descrição:** Armazena as despesas atribuídas aos parceiros.

### Campos:
- `id` (UUID) - Chave primária
- `client_id` (UUID) - Referência ao cliente (FK: clients.id)
- `aircraft_id` (UUID) - Referência à aeronave (FK: aircraft.id) - OPCIONAL
- `expense_type` (TEXT) - Tipo de despesa (combustivel, manutencao, hangar, seguro, etc)
- `description` (TEXT) - Descrição da despesa
- `total_amount` (NUMERIC 10,2) - Valor total
- `assigned_partner_cpf` (TEXT) - CPF do parceiro atribuído - OPCIONAL
- `assigned_partner_name` (TEXT) - Nome do parceiro atribuído - OPCIONAL
- `status` (TEXT) - Status (pending, paid) - padrão: 'pending'
- `due_date` (DATE) - Data de vencimento - OPCIONAL
- `paid_date` (DATE) - Data de pagamento - OPCIONAL
- `supplier_name` (TEXT) - Nome do fornecedor - OPCIONAL
- `invoice_number` (TEXT) - Número da nota fiscal - OPCIONAL
- `invoice_url` (TEXT) - URL da nota fiscal - OPCIONAL
- `payment_method` (TEXT) - Método de pagamento - OPCIONAL
- `notes` (TEXT) - Observações - OPCIONAL
- `created_by` (TEXT) - Criado por - OPCIONAL
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

### Constraints:
- **PK:** partner_expenses_pkey (id)
- **FK:** partner_expenses_client_id_fkey → clients(id)
- **FK:** partner_expenses_aircraft_id_fkey → aircraft(id)

### Índices:
- `idx_partner_exp_client` - Busca por cliente
- `idx_partner_exp_partner` - Busca por parceiro
- `idx_partner_exp_status` - Busca por status
- `idx_partner_exp_date` - Busca por data de vencimento

### Uso no Código:
```typescript
// Hook: useFinanceiroSocios.ts
useSocioExpenses(clientId, filters) // Busca despesas do cliente
useCreateExpense() // Cria nova despesa
usePayExpense() // Marca despesa como paga
```

---

## 3. Tabela: `partner_transactions`

**Descrição:** Histórico de todas as transações (depósitos e pagamentos) dos parceiros.

### Campos:
- `id` (UUID) - Chave primária
- `client_id` (UUID) - Referência ao cliente (FK: clients.id)
- `partner_cpf` (TEXT) - CPF do parceiro
- `partner_name` (TEXT) - Nome do parceiro
- `transaction_type` (TEXT) - Tipo ('deposit' ou 'payment')
- `amount` (NUMERIC 10,2) - Valor da transação
- `balance_before` (NUMERIC 10,2) - Saldo antes da transação
- `balance_after` (NUMERIC 10,2) - Saldo após a transação
- `description` (TEXT) - Descrição - OPCIONAL
- `reference_type` (TEXT) - Tipo de referência ('expense', etc) - OPCIONAL
- `reference_id` (UUID) - ID da despesa/referência - OPCIONAL
- `payment_date` (DATE) - Data da transação - OPCIONAL
- `receipt_url` (TEXT) - URL do comprovante - OPCIONAL
- `notes` (TEXT) - Observações - OPCIONAL
- `created_by` (TEXT) - Criado por - OPCIONAL
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

### Constraints:
- **PK:** partner_transactions_pkey (id)
- **FK:** partner_transactions_client_id_fkey → clients(id)

### Índices:
- `idx_partner_trans_client` - Busca por cliente
- `idx_partner_trans_cpf` - Busca por CPF do parceiro
- `idx_partner_trans_date` - Busca por data
- `idx_partner_trans_type` - Busca por tipo

### Uso no Código:
```typescript
// Hook: useFinanceiroSocios.ts
useSocioTransactions(clientId, filters) // Busca transações do cliente
// Transações são criadas automaticamente ao registrar depósitos ou pagamentos
```

---

## Fluxo de Operações

### 1. Registrar Depósito
```
DepositForm.tsx → useAddDeposit()
  ↓
1. Buscar saldo atual de partner_accounts
2. Calcular novo saldo (balance_before + amount)
3. Criar transação em partner_transactions (type: 'deposit')
4. Atualizar partner_accounts (current_balance, total_deposited)
```

### 2. Criar Despesa
```
ExpenseForm.tsx → useCreateExpense()
  ↓
1. Inserir nova linha em partner_expenses (status: 'pending')
```

### 3. Pagar Despesa
```
ExpensesTable.tsx → usePayExpense()
  ↓
1. Buscar saldo atual de partner_accounts
2. Validar se saldo é suficiente
3. Calcular novo saldo (balance_before - amount)
4. Criar transação em partner_transactions (type: 'payment')
5. Atualizar partner_accounts (current_balance, total_spent)
6. Atualizar partner_expenses (status: 'paid', paid_date)
```

---

## Relacionamentos

```
clients (1) ──→ (N) partner_accounts
                ├─→ partner_cpf → client_partners.cpf
                └─→ id referenciado em partner_transactions

clients (1) ──→ (N) partner_expenses
                ├─→ client_id
                └─→ assigned_partner_cpf → partner_cpf

clients (1) ──→ (N) partner_transactions
                └─→ client_id

aircraft (1) ──→ (N) partner_expenses
                └─→ aircraft_id (opcional)
```

---

## Tipos de Despesa Suportados

```typescript
export const EXPENSE_TYPES = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "hangar", label: "Hangar" },
  { value: "seguro", label: "Seguro" },
  { value: "tripulacao", label: "Tripulação" },
  { value: "outros", label: "Outros" },
];
```

---

## Componentes Relacionados

### Frontend
- **FinanceiroSocios.tsx** - Página principal
- **DepositForm.tsx** - Formulário de depósito
- **ExpenseForm.tsx** - Formulário de despesa
- **PartnerCards.tsx** - Cards de resumo dos sócios
- **TransactionsTable.tsx** - Tabela de transações
- **ExpensesTable.tsx** - Tabela de despesas

### Hooks
- **useFinanceiroSocios.ts** - Hooks principais (useSocioAccounts, useSocioTransactions, etc)
- **useClientPartners.ts** - Busca parceiros de client_partners

### Utilitários
- **lib/formatters.ts** - Formatadores (CPF, dinheiro, etc)

---

## Notas Importantes

1. **Integridade de Dados:** As transações são criadas automaticamente ao registrar depósitos/pagamentos
2. **Saldo em Tempo Real:** O saldo é atualizado em partner_accounts sempre que há uma transação
3. **Histórico Auditável:** Todas as transações ficam registradas em partner_transactions
4. **Validação:** Não é possível pagar uma despesa se o saldo for insuficiente
5. **CPF:** Serve como identificador único do parceiro em combinação com client_id

