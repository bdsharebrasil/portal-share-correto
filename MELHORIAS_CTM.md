# 🔧 Melhorias Implementadas - CTM Manutenção

## ✅ Problema 1: Data Anterior Incorreta (CORRIGIDO)

### Problema
A data estava sendo exibida um dia anterior à data correta em components de manutenção/CTM.

### Causa
Conversão de timezone incorreta ao usar `new Date().toISOString().split('T')[0]`

### Solução Implementada
1. **CTMOASInlineForm.tsx**: Adicionado helper `getTodayString()` que calcula a data local sem conversões desnecessárias
2. **CTMServiceOrderForm.tsx**: Corrigido o display de data para não usar `toISOString()`

```typescript
// Helper de data corrigido
const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

---

## ✅ Problema 2: Lançamento de Múltiplos Itens por Serviço (IMPLEMENTADO)

### O que foi criado

#### 🆕 Novo Componente: `CTMServiceItemsForm.tsx`

Interface completa para lançar múltiplos itens dentro de um seviço único:

![Service Items Form Structure](./docs/service-items-structure.txt)

**Funcionalidades:**

1. **Seção de Itens (Tabela)**
   - Coluna "Ord." (Ordenação sequencial 01, 02, 03...)
   - Descrição do serviço
   - Quantidade
   - Valor Unitário
   - Subtotal (calculado automaticamente)
   - Total do Serviço (sumário na última linha)
   - Botão para remover item

2. **Formulário de Adição de Itens**
   - Campo de descrição (obrigatório)
   - Quantidade
   - Valor unitário
   - Botão "Adicionar" para inserir na tabela

3. **Card de Dados Financeiros**
   - **Fornecedor**: Utiliza SearchableCombobox (busca em tempo real)
   - **Modo de Pagamento**: Boleto, Transferência, Cartão, etc.
   - **Condições de Pagamento**: À vista, 30 dias, 60 dias, etc.
   - **Dados Bancários**: Campo de texto para informações de pagamento

4. **Anexação de PDF**
   - Upload de documento PDF
   - Preview visual do arquivo
   - Exibição de tamanho do arquivo

5. **Resumo Financeiro**
   - Total do serviço em destaque
   - Quantidade de itens
   - Indicador visual

6. **Ações Finais**
   - **Cancelar**: Descarta as alterações
   - **Salvar e Enviar Aprovação**: Salva e marca como "pendente_aprovacao"
   - **Salvar**: Salva com status "pendente"

### Integração ao CTMOASDetail

O componente foi integrado ao [CTMOASDetail.tsx](CTMOASDetail.tsx):

```typescript
<Button>Serviço Simples</Button>     // Modo tradicional (um item)
<Button>Múltiplos Itens</Button>     // Novo modo (vários itens)
```

Quando "Múltiplos Itens" é clicado, abre um Dialog modal com o componente completo.

---

## 📊 Estrutura de Dados

### Novas Tabelas (Migration)

```sql
-- ctm_service_items
- id (UUID)
- service_id (FK → ctm_services)
- ordenacao (INTEGER)
- descricao (TEXT)
- quantidade (NUMERIC)
- valor_unitario (NUMERIC)
- subtotal (NUMERIC GENERATED)
- created_at, updated_at

-- ctm_service_attachments
- id (UUID)
- service_id (FK → ctm_services)
- arquivo_nome (TEXT)
- arquivo_path (TEXT)
- tipo (VARCHAR 'pdf', 'imagem', etc)
- tamanho_bytes (BIGINT)
- created_at

-- ctm_services (campos adicionados)
- fornecedor_id (UUID)
- modo_pagamento (VARCHAR)
- dados_pagamento (TEXT)
- condicoes_pagamento (VARCHAR)
- status (VARCHAR)
- quantidade (INTEGER)
- modelo (VARCHAR)
```

---

## 🚀 Como Usar

### Criar um Serviço com Múltiplos Itens

1. Acesse a OAS (Ordem de Serviço)
2. Na aba "Serviços", clique em **"Múltiplos Itens"**
3. Preencha os itens na tabela:
   - Descrição: `REVISÃO GERAL TACO GERADOR`
   - Qtde: `1`
   - Valor Unit.: `1.679,17`
4. Clique **"Adicionar"** para incluir na lista
5. Repita para mais itens:
   - Descrição: `BANHO QUIMICO PECAS AVULSAS`
   - Qtde: `1`
   - Valor Unit.: `270,83`

6. Na seção "Dados Financeiros":
   - Selecione o **Fornecedor** via SearchableCombobox
   - Preencha modo de pagamento
   - Adicione dados bancários se necessário

7. **Opcional**: Anexe um PDF com a documentação

8. Clique **"Salvar"** ou **"Salvar e Enviar Aprovação"**

---

## 🔍 Arquivos Modificados

### Componentes
- ✅ `src/components/ctm/CTMOASInlineForm.tsx` - Corrigida data
- ✅ `src/components/ctm/CTMServiceOrderForm.tsx` - Corrigida data
- ✅ `src/components/ctm/CTMOASDetail.tsx` - Integração do novo componente
- ✅ `src/components/ctm/CTMServiceItemsForm.tsx` - **NOVO COMPONENTE**

### Migrations
- ✅ `supabase/migrations/20260316000000_add_service_items_and_attachments.sql` - **NOVA MIGRATION**

---

## ⚙️ Dependências Utilizadas

- `SearchableCombobox`: Componente de busca e seleção com suporte em combobox
- `@tanstack/react-query`: Para sincronização de dados
- `sonner`: Para notificações toast
- `framer-motion`: Para animações
- `date-fns`: Para formatação de datas

---

## 📝 Notas Importantes

1. **Data**: O problema de data foi resolvido evitando conversões de timezone desnecessárias. A data agora é sempre armazenada e exibida no formato `YYYY-MM-DD` (local do usuário).

2. **PDF Storage**: Os PDFs são armazenados no storage do Supabase em `ctm-pdfs/services/{serviceId}_{timestamp}_{filename}`

3. **Cálculos**: Os totais são calculados automaticamente no formulário (Quantidade × Valor Unitário = Subtotal)

4. **SearchableCombobox**: Permite digitar nome do fornecedor para busca rápida

5. **Status**: Serviços podem ter status:
   - `pendente`: Salvo mas não enviado
   - `pendente_aprovacao`: Aguardando aprovação financeira
   - `em_andamento`: Sendo executado
   - `concluido`: Finalizado

---

## 🧪 Teste Recomendado

1. Acesse `http://localhost:8081` (ou porta configurada)
2. Navegue para CTM → Gestão de Manutenção
3. Crie/Abra uma OAS
4. Teste adicionar serviço com múltiplos itens
5. Verifique se as datas estão corretas
6. Anexe um PDF e salve

---

## 📞 Contato

Qualquer dúvida sobre as implementações, refira-se aos comentários em código ou este documento.
