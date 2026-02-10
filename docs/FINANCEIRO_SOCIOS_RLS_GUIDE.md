# Guia de Implementação - Políticas RLS Financeiro Sócios

## Visão Geral

Este documento descreve a implementação de **Row Level Security (RLS)** para as 3 tabelas do módulo Financeiro Sócios:
- `partner_accounts`
- `partner_expenses`
- `partner_transactions`

## Matriz de Permissões

### Resumo de Acesso

| Role | SELECT | INSERT | UPDATE | DELETE | Escopo |
|------|--------|--------|--------|--------|--------|
| **ADMIN** | ✅ Todos | ✅ Todos | ✅ Todos | ✅ Todos | Acesso irrestrito a todas as tabelas |
| **GESTOR_MASTER** | ✅ Todos | ✅ Todos | ✅ Todos | ✅ Todos | Acesso irrestrito a todas as tabelas |
| **FINANCEIRO_MASTER** | ✅ Todos | ✅ Todos | ✅ Todos | ✅ Todos | Acesso irrestrito a todas as tabelas |
| **CLIENTE** | ✅ Seus dados | ❌ | ❌ | ❌ | Apenas visualizar dados de suas contas |

## Funcionalidades por Tabela

### 1. partner_accounts
```
ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER:
  - Visualizar todas as contas de todos os clientes
  - Criar novas contas para clientes
  - Atualizar dados das contas
  - Deletar contas

CLIENTE:
  - Visualizar APENAS suas próprias contas
  - Não pode criar, atualizar ou deletar
```

### 2. partner_expenses
```
ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER:
  - Visualizar todos os gastos de todos os clientes
  - Registrar novos gastos
  - Atualizar gastos
  - Deletar gastos

CLIENTE:
  - Visualizar APENAS gastos de suas próprias contas
  - Não pode criar, atualizar ou deletar
```

### 3. partner_transactions
```
ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER:
  - Visualizar todas as transações de todos os clientes
  - Registrar novas transações
  - Atualizar transações
  - Deletar transações

CLIENTE:
  - Visualizar APENAS transações de suas próprias contas
  - Não pode criar, atualizar ou deletar
```

## Implementação Técnica

### Pré-requisitos

1. **Supabase com autenticação habilitada**
2. **JWT com claim `role`** configurado no Supabase
3. **RLS habilitado** nas 3 tabelas

### Configuração do JWT com Role

No seu **Supabase Dashboard**, vá para:
1. **Authentication** → **Policies**
2. Configure o JWT para incluir a claim `role`

Exemplo de payload JWT:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "admin",
  "aud": "authenticated"
}
```

### Aplicando as Políticas

1. Abra o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o conteúdo do arquivo `FINANCEIRO_SOCIOS_RLS.sql`

Ou via CLI:
```bash
supabase sql < docs/FINANCEIRO_SOCIOS_RLS.sql
```

### Verificando as Políticas

Execute esta query no SQL Editor para listar todas as políticas criadas:

```sql
SELECT * FROM pg_policies 
WHERE tablename IN ('partner_accounts', 'partner_expenses', 'partner_transactions')
ORDER BY tablename, policyname;
```

## Fluxo de Operações

### 1. ADMIN/GESTOR_MASTER/FINANCEIRO_MASTER - Criar Conta de Sócio

```typescript
// Frontend - React
const criarContaSocio = async () => {
  const { data, error } = await supabase
    .from('partner_accounts')
    .insert([
      {
        client_id: 'uuid-do-cliente',
        partner_id: 'uuid-do-socio',
        current_balance: 0,
        total_deposited: 0
      }
    ]);
};
```

**Validação RLS:**
- ✅ JWT role é 'admin', 'gestor_master' ou 'financeiro_master'
- ✅ Política INSERT permite a operação

### 2. CLIENTE - Visualizar Suas Contas

```typescript
const { data } = await supabase
  .from('partner_accounts')
  .select('*')
  .eq('client_id', auth.user().id); // Seu próprio client_id
```

**Validação RLS:**
- ✅ JWT role é 'cliente'
- ✅ client_id matches auth.uid()
- ✅ Política SELECT retorna apenas suas contas

### 3. CLIENTE - Tentar Inserir (Bloqueado)

```typescript
const { data, error } = await supabase
  .from('partner_accounts')
  .insert([{ /* dados */ }]);

// ❌ ERRO: Política RLS impede INSERT para role 'cliente'
```

### 4. CLIENTE - Tentar Deletar (Bloqueado)

```typescript
const { error } = await supabase
  .from('partner_accounts')
  .delete()
  .eq('id', 'account-id');

// ❌ ERRO: Política RLS impede DELETE para role 'cliente'
```

## Relações Entre Tabelas

```
partner_accounts
├── client_id → auth.users.id
├── partner_id → client_partners.id
└── Relacionada com:
    ├── partner_expenses (via account_id)
    └── partner_transactions (via account_id)

partner_expenses
├── account_id → partner_accounts.id
└── Controlado por: partner_accounts.client_id

partner_transactions
├── account_id → partner_accounts.id
└── Controlado por: partner_accounts.client_id
```

## Filtros Automáticos para CLIENTE

Ao executar queries como CLIENTE:

**Antes da RLS:**
```sql
SELECT * FROM partner_accounts; -- Retorna todas as contas
```

**Depois da RLS (CLIENTE):**
```sql
SELECT * FROM partner_accounts 
WHERE client_id = 'meu-user-id'; -- Retorna apenas minhas contas
```

## Tratamento de Erros

### Erro: "new row violates row-level security policy"

**Causa:** Tentativa de inserir dados que não passa na validação RLS

**Solução:**
```typescript
try {
  await supabase.from('partner_accounts').insert([...]);
} catch (error) {
  if (error.message.includes('row-level security')) {
    console.error('Você não tem permissão para esta operação');
  }
}
```

### Erro: "Insufficient privileges"

**Causa:** Role do usuário não está configurado corretamente no JWT

**Solução:**
1. Verifique se o JWT contém a claim `role`
2. Verifique se a role é uma das: `admin`, `gestor_master`, `financeiro_master`, `cliente`
3. Regenere o token de autenticação

## Testes de Segurança

### Teste 1: CLIENTE não pode ver dados de outro CLIENTE
```sql
-- Como CLIENTE A, executar:
SELECT * FROM partner_accounts;
-- Deve retornar apenas contas onde client_id = seu ID

-- Se CLIENTE B tentar acessar contas de CLIENTE A:
-- ❌ Nenhuma linha será retornada (RLS filtra automaticamente)
```

### Teste 2: CLIENTE não pode inserir dados
```sql
-- Como CLIENTE, executar:
INSERT INTO partner_accounts (client_id, partner_id, current_balance, total_deposited)
VALUES ('outro-id', 'outro-id', 1000, 1000);
-- ❌ ERRO: new row violates row-level security policy
```

### Teste 3: ADMIN pode fazer qualquer coisa
```sql
-- Como ADMIN, executar:
INSERT INTO partner_accounts (client_id, partner_id, current_balance, total_deposited)
VALUES ('cliente-id', 'socio-id', 5000, 5000);
-- ✅ SUCESSO: Dados inseridos

SELECT * FROM partner_accounts;
-- ✅ Retorna TODAS as contas de TODOS os clientes
```

## Alterações Futuras

Se precisar adicionar novas roles (ex: `gerente_regional`), você pode:

1. Atualizar as políticas para incluir a nova role:
```sql
CREATE POLICY <policy_name>
ON public.<table_name>
FOR <OPERATION>
USING (
  auth.jwt() ->> 'role' IN ('admin', 'gestor_master', 'financeiro_master', 'gerente_regional')
);
```

2. Ou criar políticas específicas para a nova role conforme necessário.

## Performance e Índices

Para otimizar as queries com RLS, adicione índices:

```sql
-- Para partner_accounts
CREATE INDEX idx_partner_accounts_client_id 
ON public.partner_accounts(client_id);

-- Para partner_expenses
CREATE INDEX idx_partner_expenses_account_id 
ON public.partner_expenses(account_id);

-- Para partner_transactions
CREATE INDEX idx_partner_transactions_account_id 
ON public.partner_transactions(account_id);
```

## Logs e Auditoria

Para adicionar auditoria, implemente triggers que registrem alterações:

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT,
  operation TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Criar trigger para partner_accounts, partner_expenses, partner_transactions
CREATE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, operation, new_data, changed_by, changed_at)
  VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), auth.uid(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_partner_accounts AFTER INSERT ON partner_accounts
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

## Suporte e Troubleshooting

- **Documentação Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **JWT Claims:** https://supabase.com/docs/guides/auth/getting-started/app-frameworks/nextjs

## Conclusão

Com estas políticas RLS em vigor, o sistema garante que:
- ✅ Apenas administradores podem gerenciar dados de sócios
- ✅ Clientes só veem seus próprios dados
- ✅ Segurança em nível de banco de dados
- ✅ Sem necessidade de validação adicional no frontend
