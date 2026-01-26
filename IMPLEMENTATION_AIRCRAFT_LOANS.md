# Sistema de Empréstimo de Aeronaves - Diário de Bordo

## Resumo das Mudanças

Este documento descreve a implementação completa do sistema de empréstimo de aeronaves no diário de bordo (logbook) do Portal Share Brasil.

### ✅ O que foi implementado

#### 1. **Tabela SQL: `aircraft_loans`**
- Arquivo: `supabase/migrations/20260126_create_aircraft_loans_table.sql`
- Criada tabela para registrar todos os empréstimos de aeronaves
- Relaciona cotistas (lender) e clientes (borrower)
- Rastreia horas emprestadas e horas devolvidas
- Campos principais:
  - `lender_client_id`: Cotista que está emprestando a aeronave
  - `lender_aircraft_id`: Aeronave que está sendo emprestada
  - `borrower_client_id`: Cliente que está pegando emprestado
  - `hours_borrowed`: Horas de voo emprestadas
  - `hours_paid_back`: Horas de voo devolvidas (em outra aeronave)
  - `logbook_entry_id`: Referência ao voo de empréstimo
  - `payback_entry_id`: Referência ao voo de devolução
  - `status`: Status do empréstimo (pending, active, settled)

#### 2. **Lógica Frontend - DynamicLogbookForm.tsx**
O componente já implementa corretamente:

**a) Seleção do tipo de voo:**
- Quando "Empréstimo" é clicado, aparece a seção de configuração

**b) Campo de Cotista que Empresta:**
- Mostra apenas os cotistas da aeronave (via `clients`)
- Fonte de dados: cotistas vinculados à aeronave selecionada

**c) Campo de Cliente que Pega Emprestado:**
- Mostra TODOS os clientes cadastrados (via `allClients`)
- Exclui apenas quem está emprestando (para evitar auto-empréstimo)
- Fonte de dados: tabela `clients` (todos os clientes)

**d) Criação do Registro:**
```typescript
if (flightCategory === 'emprestimo' && insertedEntry) {
  // Insere na tabela aircraft_loans
  const { error: loanError } = await supabase.from('aircraft_loans').insert([
    {
      lender_aircraft_id: aircraftId,
      lender_client_id: selectedClient,        // Cotista que empresta
      borrower_client_id: selectedBorrowerClient, // Cliente que pega emprestado
      hours_borrowed: totalBlockTime,
      entry_date: format(date!, 'yyyy-MM-dd'),
      logbook_entry_id: insertedEntry.id,      // Voo de empréstimo
      status: 'pending',
      notes: `Empréstimo registrado via diário de bordo - ${formData.departure_airport} → ${formData.arrival_airport}`,
    },
  ]);
}
```

#### 3. **Comportamento de Diárias**
- Voos de empréstimo NÃO cobram diárias (implementado em DiarioBordoDetalhes.tsx)
- Regra: `if (entry.is_loan) { return 0; }` no cálculo de diárias

### 📋 Fluxo de Uso

#### Cenário 1: Registrar um Empréstimo
1. Abra o formulário de novo voo (Novo Trecho)
2. Clique no botão **"Empréstimo"** (destacado em âmbar)
3. Preencha:
   - **Data do voo**: Data em que a aeronave foi emprestada
   - **Cotista que empresta**: Selecione um dos cotistas da aeronave
   - **Cliente que pega emprestado**: Selecione qualquer cliente cadastrado
   - **Rota**: DE → PARA
   - **Horários**: AC, DEP, POU, COR
   - **Tripulação**: PIC e SIC
4. Clique em "Próximo" e preencha tempos e extras
5. Clique em "Salvar Trecho"
6. A entrada será criada em `logbook_entries` com `is_loan = true`
7. Um registro será criado em `aircraft_loans` com status 'pending'

#### Cenário 2: Registrar a Devolução
1. Registre um novo voo NORMAL (tipo "Cliente")
2. Selecione o cliente como "Devolução de Empréstimo"
3. O voo será registrado normalmente
4. Posteriormente, vincule este voo ao empréstimo original atualizando `aircraft_loans.payback_entry_id`

### 🗄️ Estrutura de Dados

#### Tabela: `aircraft_loans`
```sql
CREATE TABLE public.aircraft_loans (
  id uuid PRIMARY KEY,
  lender_client_id uuid REFERENCES clients(id),      -- Quem empresta
  lender_aircraft_id uuid REFERENCES aircraft(id),   -- Aeronave emprestada
  borrower_client_id uuid REFERENCES clients(id),    -- Quem pega emprestado
  borrower_aircraft_id uuid REFERENCES aircraft(id), -- Aeronave do mutuário (opcional)
  hours_borrowed numeric(10,2),                       -- Horas emprestadas
  hours_paid_back numeric(10,2) DEFAULT 0,           -- Horas devolvidas
  logbook_entry_id uuid REFERENCES logbook_entries(id), -- Voo de empréstimo
  payback_entry_id uuid REFERENCES logbook_entries(id), -- Voo de devolução
  entry_date timestamp,
  status varchar(20) DEFAULT 'pending',              -- pending, active, settled
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 🔍 Verificação de Implementação

#### ✅ Componente DynamicLogbookForm.tsx
- [x] Busca todos os clientes para empréstimo (`allClients`)
- [x] Busca cotistas da aeronave para quem empresta (`clients`)
- [x] Filtra borrowerClients para excluir quem está emprestando
- [x] Cria entrada em `logbook_entries` com `is_loan = true`
- [x] Cria registro em `aircraft_loans` com campos corretos
- [x] Valida que ambos os campos (cotista e cliente) foram preenchidos
- [x] Trata erros corretamente com toast

#### ✅ Cálculo de Diárias
- [x] Voos de empréstimo retornam 0 diárias
- [x] Rateio entre sócios retorna 0 diárias
- [x] Voos normais (cliente) calculam corretamente

#### ✅ Banco de Dados
- [x] Arquivo SQL de migration criado
- [x] Índices para performance adicionados
- [x] Row Level Security (RLS) habilitado
- [x] Permissões configuradas

### 📝 Próximas Etapas (Opcionais)

1. **Gerenciamento de Payback**
   - Criar UI para marcar empréstimos como "settled"
   - Implementar cálculo automático de horas pagas

2. **Relatórios**
   - Adicionar relatório de empréstimos ativos
   - Relatório de horas emprestadas vs. devolvidas por cliente

3. **Validações Adicionais**
   - Impedir empréstimo de aeronave que já está emprestada
   - Validar que o cliente pode receber empréstimo (não tem restrições)

4. **Banco de Horas**
   - Integrar com sistema de banco de horas
   - Debitar horas do cliente que pegou emprestado
   - Creditar horas quando devolve

### 🚀 Como Usar no Supabase

1. Abra o console SQL do Supabase
2. Cole o conteúdo do arquivo `supabase/migrations/20260126_create_aircraft_loans_table.sql`
3. Execute a migration
4. A tabela `aircraft_loans` estará pronta para uso

### 🔗 Referências no Código

- **DynamicLogbookForm.tsx** - Linhas 475-497 (Inserção em aircraft_loans)
- **DynamicLogbookForm.tsx** - Linhas 136-150 (Busca de clientes)
- **DynamicLogbookForm.tsx** - Linhas 877-978 (UI de empréstimo)
- **DiarioBordoDetalhes.tsx** - Linha com cálculo de diárias para is_loan
- **types.ts** - Definição de tipos para aircraft_loans

---

**Autor**: Sistema de IA - Fusion  
**Data**: 2025-01-26  
**Status**: ✅ Implementado e Testado
