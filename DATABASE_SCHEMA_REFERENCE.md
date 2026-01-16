# 📊 Referência de Schema do Banco de Dados

## 📋 Tabelas Envolvidas

### 1. `bank_reconciliations` ✅ (Criada pelo handleReceiptSubmit)

```sql
CREATE TABLE bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados básicos
  type VARCHAR(50) NOT NULL, -- 'cliente' | 'colaborador'
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(50), -- 'pendente' | 'confirmado' | 'recebido'
  
  -- Relacionamentos
  client_id UUID REFERENCES clients(id),
  aircraft_id UUID REFERENCES aircraft(id),
  categoria_movimentacao_id UUID REFERENCES categorias_movimentacao(id),
  
  -- Documento
  tipo_documento VARCHAR(50), -- 'recibo' | 'rateio'
  doc VARCHAR(100),
  payment_term DATE,
  
  -- Percentual
  percentual VARCHAR(10),
  
  -- Forma de pagamento
  forma_pagamento VARCHAR(100),
  afeta_caixa_empresa BOOLEAN DEFAULT true,
  
  -- Fornecedor (JSON)
  fornecedor_nome VARCHAR(255),
  fornecedor_dados JSONB,
  
  -- URLs dos arquivos
  boleto_url TEXT,
  nf_url TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Referência
  reference_id UUID,
  reference_type VARCHAR(50), -- 'receipt' | outro
  
  -- Índices
  INDEX idx_client_id (client_id),
  INDEX idx_aircraft_id (aircraft_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_reference (reference_id, reference_type)
);
```

**Exemplo de Inserção**:
```json
{
  "type": "cliente",
  "date": "2024-01-15",
  "description": "Reembolso - Combustível",
  "amount": 500.00,
  "status": "pendente",
  "client_id": "uuid-cliente",
  "aircraft_id": "uuid-aeronave",
  "categoria_movimentacao_id": "uuid-categoria",
  "tipo_documento": "recibo",
  "doc": "NF-12345",
  "payment_term": "2024-01-20",
  "percentual": "100",
  "forma_pagamento": "empresa_paga",
  "afeta_caixa_empresa": true,
  "fornecedor_nome": null,
  "fornecedor_dados": null,
  "boleto_url": "https://...",
  "nf_url": "https://...",
  "created_by": "uuid-usuario"
}
```

---

### 2. `rateio_despesas` ✅ (Criada pelo handleReceiptSubmit se tipo_documento === 'rateio')

```sql
CREATE TABLE rateio_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência à despesa
  despesa_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  
  -- Cliente
  client_id UUID REFERENCES clients(id),
  client_name VARCHAR(255),
  
  -- Aeronave
  aeronave_id UUID REFERENCES aircraft(id),
  aeronave_registro VARCHAR(20),
  
  -- Valores
  percentual NUMERIC NOT NULL, -- Ex: 40.00
  valor NUMERIC NOT NULL,      -- Valor total da despesa
  valor_rateado NUMERIC NOT NULL, -- Valor deste cliente
  
  -- Status
  status VARCHAR(50), -- 'pendente' | 'aprovado' | 'pago'
  data_vencimento DATE,
  
  -- Categoria
  categoria_id UUID REFERENCES categorias_movimentacao(id),
  
  -- Comprovantes
  boleto TEXT,
  nota_fiscal TEXT,
  
  -- Observações
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Referência (para compat com receipts)
  recebimento_id UUID,
  
  -- Índices
  INDEX idx_despesa_id (despesa_id),
  INDEX idx_client_id (client_id),
  INDEX idx_aeronave_id (aeronave_id),
  INDEX idx_status (status)
);
```

**Exemplo de Inserção**:
```json
{
  "despesa_id": "uuid-bank-reconciliation",
  "client_id": "uuid-cliente",
  "client_name": "Cliente LTDA",
  "aeronave_id": "uuid-aeronave",
  "aeronave_registro": "PR-XYZ",
  "percentual": 40.00,
  "valor": 1000.00,
  "valor_rateado": 400.00,
  "status": "pendente",
  "data_vencimento": "2024-01-25",
  "categoria_id": "uuid-categoria",
  "boleto": "https://...",
  "nota_fiscal": "https://...",
  "observacoes": "Rateio de 40% do valor total de R$ 1000.00",
  "recebimento_id": "uuid-receipt"
}
```

---

### 3. `clients` (Referência)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  company_name VARCHAR(255),
  cnpj VARCHAR(18),
  -- ... outros campos
)
```

---

### 4. `aircraft` (Referência)

```sql
CREATE TABLE aircraft (
  id UUID PRIMARY KEY,
  registration VARCHAR(20),
  -- ... outros campos
)
```

---

### 5. `categorias_movimentacao` (Referência)

```sql
CREATE TABLE categorias_movimentacao (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50), -- 'receita' | 'despesa'
  grupo_categoria VARCHAR(100),
  -- ... outros campos
)
```

---

### 6. `receipts` (Tabela Original)

```sql
CREATE TABLE receipts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  payer_name VARCHAR(255),
  payer_document VARCHAR(20),
  payer_address VARCHAR(255),
  payer_city VARCHAR(100),
  payer_uf VARCHAR(2),
  amount NUMERIC NOT NULL,
  service_description TEXT,
  receipt_type VARCHAR(50), -- 'pagamento' | 'reembolso'
  issue_date DATE,
  receipt_number VARCHAR(50) UNIQUE,
  max_payment_date DATE,
  payment_method VARCHAR(100),
  client_id UUID REFERENCES clients(id),
  boleto_url TEXT,
  nf_url TEXT,
  doc_number VARCHAR(50),
  pdf_url TEXT,
  created_at TIMESTAMP,
  -- ... outros campos
)
```

---

## 🔄 Relacionamentos

```
┌─────────────────────────────────────────────────┐
│ receipts (original)                             │
│ ├─ id (PK)                                      │
│ └─ reference_id → bank_reconciliations          │
└──────────────────┬──────────────────────────────┘
                   │
                   │ 1:1
                   ▼
┌─────────────────────────────────────────────────┐
│ bank_reconciliations (novo)                     │
│ ├─ id (PK)                                      │
│ ├─ client_id → clients                          │
│ ├─ aircraft_id → aircraft                       │
│ ├─ categoria_movimentacao_id → categorias       │
│ └─ reference_id → receipts.id                   │
└──────────────────┬──────────────────────────────┘
                   │
                   │ 1:N (se rateio)
                   ▼
┌─────────────────────────────────────────────────┐
│ rateio_despesas (novo)                          │
│ ├─ despesa_id (FK) → bank_reconciliations       │
│ ├─ client_id → clients                          │
│ ├─ aeronave_id → aircraft                       │
│ └─ categoria_id → categorias_movimentacao       │
└─────────────────────────────────────────────────┘
```

---

## 📝 Query de Teste

### Verificar se uma despesa foi processada

```sql
-- Ver todas as despesas
SELECT 
  br.id,
  br.date,
  br.description,
  br.amount,
  br.tipo_documento,
  c.company_name as cliente,
  a.registration as aeronave,
  br.status
FROM bank_reconciliations br
LEFT JOIN clients c ON br.client_id = c.id
LEFT JOIN aircraft a ON br.aircraft_id = a.id
ORDER BY br.created_at DESC
LIMIT 10;
```

### Ver rateios de uma despesa

```sql
SELECT 
  rd.id,
  rd.client_name,
  rd.aeronave_registro,
  rd.percentual,
  rd.valor,
  rd.valor_rateado,
  rd.status
FROM rateio_despesas rd
WHERE rd.despesa_id = 'uuid-da-despesa'
ORDER BY rd.created_at;
```

### Verificar total rateado

```sql
SELECT 
  br.id,
  br.description,
  br.amount as valor_principal,
  COUNT(rd.id) as total_rateios,
  SUM(rd.valor_rateado) as total_rateado,
  -- Se foram rateados corretamente
  CASE 
    WHEN SUM(rd.valor_rateado) = br.amount THEN '✅ OK'
    ELSE '⚠️ Inconsistência'
  END as status_rateio
FROM bank_reconciliations br
LEFT JOIN rateio_despesas rd ON br.id = rd.despesa_id
WHERE br.tipo_documento = 'rateio'
GROUP BY br.id, br.description, br.amount;
```

---

## 🔒 Permissões

### Quem pode inserir em bank_reconciliations?
- Usuários autenticados (via `created_by`)
- Apenas dados dos clientes da empresa

### Quem pode ver dados?
- Usuários da empresa (RLS via `created_by`)
- Admins (acesso total)

---

## 📊 Comparação: Antes vs Depois

### Antes (sem handleReceiptSubmit)
```
receipts
└─ Dados do recibo (simples, histórico apenas)
```

### Depois (com handleReceiptSubmit)
```
receipts
├─ Dados do recibo (compatibilidade)
│
└─ bank_reconciliations (novo fluxo de caixa)
   ├─ Dados completos da despesa
   ├─ Status de pagamento
   ├─ URLs de comprovantes
   │
   └─ rateio_despesas (se rateado)
      ├─ Distribui despesa entre clientes
      ├─ Rastreia percentual
      └─ Registra valores por cliente
```

---

## 🚀 Migrations (Se Necessário)

### Criar tabela bank_reconciliations
```sql
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  client_id UUID REFERENCES clients(id),
  aircraft_id UUID REFERENCES aircraft(id),
  categoria_movimentacao_id UUID REFERENCES categorias_movimentacao(id),
  tipo_documento VARCHAR(50),
  doc VARCHAR(100),
  payment_term DATE,
  percentual VARCHAR(10),
  forma_pagamento VARCHAR(100),
  afeta_caixa_empresa BOOLEAN DEFAULT true,
  fornecedor_nome VARCHAR(255),
  fornecedor_dados JSONB,
  boleto_url TEXT,
  nf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reference_id UUID,
  reference_type VARCHAR(50)
);

CREATE INDEX idx_bank_recon_client ON bank_reconciliations(client_id);
CREATE INDEX idx_bank_recon_aircraft ON bank_reconciliations(aircraft_id);
CREATE INDEX idx_bank_recon_status ON bank_reconciliations(status);
```

### Criar tabela rateio_despesas
```sql
CREATE TABLE IF NOT EXISTS public.rateio_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  client_name VARCHAR(255),
  aeronave_id UUID REFERENCES aircraft(id),
  aeronave_registro VARCHAR(20),
  percentual NUMERIC NOT NULL,
  valor NUMERIC NOT NULL,
  valor_rateado NUMERIC NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  data_vencimento DATE,
  categoria_id UUID REFERENCES categorias_movimentacao(id),
  boleto TEXT,
  nota_fiscal TEXT,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  recebimento_id UUID
);

CREATE INDEX idx_rateio_despesa ON rateio_despesas(despesa_id);
CREATE INDEX idx_rateio_client ON rateio_despesas(client_id);
CREATE INDEX idx_rateio_aeronave ON rateio_despesas(aeronave_id);
```

---

**Documentação de Schema v1.0** ✅
