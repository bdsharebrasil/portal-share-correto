# Integração de Notas Fiscais de Saída

## Resumo das Alterações

### 1. Código Frontend (NotasFiscaisSaida.tsx)

O campo `aeronave_registration` (ex: "PR-GJM") agora é enviado para o banco de dados no campo `aeronave` da tabela `public.notas_fiscais_saida`.

**Alterações:**
- Mudança de `aircraft_id` para `aeronave` para armazenar o registro da aeronave
- Tratamento de erros atualizado para o novo nome do campo
- O campo `aeronave` é opcional

### 2. Schema do Banco de Dados

A tabela `public.notas_fiscais_saida` possui o campo:
```sql
aeronave text null
```

### 3. Scripts SQL

#### 3.1 Triggers Automáticos (add_nf_saida_auto_triggers.sql)
Cria sincronização automática entre tabelas

#### 3.2 Script de Sincronização Histórica (sync_controle_bancario_to_bank_reconciliations.sql)
Sincroniza dados existentes em controle_bancario para bank_reconciliations

### 4. Triggers SQL Automáticos

Foram criados 3 triggers que funcionam automaticamente:

#### 3.1 Trigger de Criação em controle_bancario
- **Evento**: Quando uma nota fiscal é INSERIDA
- **Condição**: Status "pendente" ou "recebido"
- **Ação**: Cria automaticamente um registro em `controle_bancario` com:
  - Tipo de movimento: "entrada"
  - Status: "pendente" (se NF pendente) ou "confirmado" (se NF recebido)
  - Descrição: "NF Saída XXX - Cliente (Aeronave)"

#### 3.2 Trigger de Criação em bank_reconciliations
- **Evento**: Quando uma nota fiscal é INSERIDA
- **Condição**: Status "pendente" ou "recebido"
- **Ação**: Cria automaticamente um registro em `bank_reconciliations` com:
  - Type: "cliente"
  - Status: "pendente" ou "recebido"
  - Descrição: "NF Saída XXX - Cliente (Aeronave)"
  - reference_type: "nf_saida"
  - reference_id: UUID da nota fiscal

#### 3.3 Trigger de Criação em contas_areceber
- **Evento**: Quando uma nota fiscal é INSERIDA
- **Condição**: Status "pendente" ou "recebido"
- **Ação**: Cria automaticamente um registro em `contas_areceber` com:
  - Número: mesmo da NF
  - Cliente: cliente_nome e cliente_cnpj
  - Valor: mesmo da NF
  - Categoria: mesmo da NF
  - Status: "pendente" ou "recebido"
  - Aeronave: mesmo da NF
  - PDF URL: arquivo_pdf_url da NF

#### 3.4 Trigger de Atualização em Notas Fiscais
- **Evento**: Quando uma nota fiscal é ATUALIZADA
- **Condição**: Mudança de status
- **Ação**: Atualiza automaticamente os registros em TODAS as tabelas com o novo status:
  - controle_bancario
  - bank_reconciliations
  - contas_areceber

#### 3.5 Trigger de Sincronização Controle Bancário → Bank Reconciliations
- **Evento**: Quando um registro de ENTRADA é criado em controle_bancario
- **Condição**: tipo_movimento = 'entrada' e valor > 0
- **Ação**: Cria automaticamente um registro em `bank_reconciliations` com:
  - Mapeamento direto dos campos
  - reference_type = 'controle_bancario'
  - reference_id = UUID do controle_bancario
  - Status convertido (confirmado → recebido, pendente → pendente)

#### 3.6 Trigger de Atualização Controle Bancário → Bank Reconciliations
- **Evento**: Quando um registro de ENTRADA em controle_bancario é ATUALIZADO
- **Condição**: tipo_movimento = 'entrada'
- **Ação**: Atualiza automaticamente o registro relacionado em `bank_reconciliations`

## Fluxo de Funcionamento

```
Usuario cria Nota Fiscal (status = "pendente" ou "recebido")
        ↓
1. Insere em notas_fiscais_saida (com campo aeronave)
        ↓
2. Trigger cria automaticamente em controle_bancario
        ↓
3. Trigger cria automaticamente em bank_reconciliations
        ↓
4. Trigger cria automaticamente em contas_areceber
        ↓
5. Sincronização mantida em atualizações de status
```

## Instruções de Implementação

### Passo 1: Executar os Triggers Automáticos

1. Acesse o [Supabase Dashboard](https://app.supabase.com/)
2. Vá para **SQL Editor** → **New Query**
3. Copie e cole todo o conteúdo do arquivo `supabase/migrations/add_nf_saida_auto_triggers.sql`
4. Clique em **Run**

### Passo 2: Sincronizar Dados Históricos (Opcional)

Se você já tem registros em `controle_bancario` e quer sincronizá-los com `bank_reconciliations`:

1. Acesse **SQL Editor** → **New Query**
2. Copie e cole o conteúdo do arquivo `supabase/migrations/sync_controle_bancario_to_bank_reconciliations.sql`
3. Clique em **Run**
4. Execute as queries de verificação no final do script para confirmar a sincronização

### Passo 3: Redeploy da Aplicação

O código frontend já foi atualizado. Apenas faça redeploy da aplicação.

## Campos Mapeados

### notas_fiscais_saida → controle_bancario
| NF Saída | Controle Bancário |
|----------|------------------|
| numero | numero_documento |
| cliente_nome | client_name |
| valor | valor |
| data_vencimento | data_vencimento |
| data_criacao | data (CURRENT_DATE no trigger) |
| categoria | categoria_id (fixa: 2874b45b...) |
| aeronave | (incluída na descricao) |
| criado_por | criado_por |
| status | status (pendente → pendente, recebido → confirmado) |

### notas_fiscais_saida → bank_reconciliations
| NF Saída | Bank Reconciliations |
|----------|---------------------|
| numero | doc |
| cliente_nome | partner_name |
| valor | amount |
| data_vencimento | payment_term |
| data_criacao | date |
| categoria | category |
| aeronave | (incluída na description) |
| criado_por | created_by |
| status | status |
| id | reference_id |

### notas_fiscais_saida → contas_areceber
| NF Saída | Contas a Receber |
|----------|-----------------|
| numero | numero |
| cliente_nome | cliente_nome |
| cliente_cnpj | cliente_cnpj |
| valor | valor |
| data_criacao | data_criacao |
| data_vencimento | data_vencimento |
| categoria | categoria |
| descricao | descricao |
| status | status |
| aeronave | aeronave |
| criado_por | criado_por |
| arquivo_pdf_url | arquivo_pdf_url |

## Comportamento em Diferentes Cenários

### Cenário 1: NF criada com status "pendente"
- ✅ Insere em controle_bancario com status "pendente"
- ✅ Insere em bank_reconciliations com status "pendente"
- ✅ Insere em contas_areceber com status "pendente"
- ✅ Aeronave é incluída na descrição

### Cenário 2: NF criada com status "recebido"
- ✅ Insere em controle_bancario com status "confirmado"
- ✅ Insere em bank_reconciliations com status "recebido"
- ✅ Insere em contas_areceber com status "recebido"
- ✅ Aeronave é incluída na descrição

### Cenário 3: NF criada com status "cancelado"
- ❌ Não cria registros em nenhuma tabela (como esperado)

### Cenário 4: Status da NF alterado de "pendente" para "recebido"
- ✅ Atualiza controle_bancario de "pendente" para "confirmado"
- ✅ Atualiza bank_reconciliations de "pendente" para "recebido"
- ✅ Atualiza contas_areceber de "pendente" para "recebido"

### Cenário 5: Status da NF alterado para "cancelado"
- ✅ Atualiza controle_bancario para "cancelado"
- ✅ Atualiza bank_reconciliations para "cancelado"
- ✅ Atualiza contas_areceber para "cancelado"

## Prevenção de Duplicatas

Os triggers verificam se um registro já existe antes de criar:
- Em controle_bancario: Verifica por `numero_documento` e `tipo_movimento`
- Em bank_reconciliations: Verifica por `reference_type` = 'nf_saida' e `reference_id`

## Rollback (se necessário)

Caso precise reverter os triggers:

```sql
DROP TRIGGER IF EXISTS trigger_create_controle_bancario_nf_saida ON public.notas_fiscais_saida;
DROP TRIGGER IF EXISTS trigger_create_bank_reconciliation_nf_saida ON public.notas_fiscais_saida;
DROP TRIGGER IF EXISTS trigger_update_controle_bancario_nf_saida ON public.notas_fiscais_saida;
DROP TRIGGER IF EXISTS trigger_create_contas_areceber_nf_saida ON public.notas_fiscais_saida;
DROP TRIGGER IF EXISTS trigger_update_contas_areceber_nf_saida ON public.notas_fiscais_saida;

DROP FUNCTION IF EXISTS create_controle_bancario_from_nf_saida();
DROP FUNCTION IF EXISTS create_bank_reconciliation_from_nf_saida();
DROP FUNCTION IF EXISTS update_controle_bancario_from_nf_saida();
DROP FUNCTION IF EXISTS create_contas_areceber_from_nf_saida();
DROP FUNCTION IF EXISTS update_contas_areceber_from_nf_saida();
```

## Observações Importantes

1. **Aeronave agora é persistida**: O valor `aeronave_registration` (ex: "PR-GJM") é salvo no banco no campo `aeronave`
2. **Triggers são automáticos**: Não precisa de código adicional no frontend para criar registros em controle_bancario, bank_reconciliations ou contas_areceber
3. **Sincronização em atualização**: Se o status da NF for alterado, TODAS as tabelas são atualizadas automaticamente
4. **Categoria fixa em controle_bancario**: A categoria usada é sempre "2874b45b-a3bb-4bec-8f7e-74b328f8693c" (RECEITAS OPERACIONAIS)
5. **Prevenção de duplicatas**: Triggers verificam se registros já existem antes de criar:
   - controle_bancario: verifica por numero_documento + tipo_movimento
   - bank_reconciliations: verifica por reference_type + reference_id
   - contas_areceber: verifica por numero
