# Mudanças Implementadas - NotasFiscaisSaida.tsx

## Resumo Executivo
O arquivo `NotasFiscaisSaida.corrected.tsx` contém todas as correções necessárias para estar de acordo com a estrutura da tabela `public.notas_fiscais_saida` do banco de dados.

---

## 1. VALIDAÇÕES ADICIONADAS

### 1.1 Nova Função de Validação: `validarNotaFiscal()`
Criada uma função centralizada que valida todos os campos obrigatórios:

```typescript
const validarNotaFiscal = (formData: any): string | null => {
  // Validações:
  // - número da NF (obrigatório)
  // - cliente_nome (obrigatório)
  // - cliente_cnpj (obrigatório) <- NOVO
  // - valor > 0 (obrigatório) <- NOVO
  // - data_criacao (obrigatória)
  // - data_vencimento (obrigatória) <- NOVO
  // - categoria (obrigatória) <- NOVO
  // - status válido (pendente, recebido, cancelado) <- NOVO
}
```

**Mudanças implementadas:**
- Validação de CNPJ obrigatório (tabela exige NOT NULL)
- Validação de valor positivo (constraint da tabela)
- Validação de data_vencimento obrigatória (tabela exige NOT NULL)
- Validação de categoria obrigatória (tabela exige NOT NULL)
- Validação de status (apenas 3 valores permitidos)

---

## 2. CORREÇÕES NAS OPERAÇÕES DO BANCO DE DADOS

### 2.1 INSERT - Adição de Timestamps
**Antes:**
```typescript
const notaData: any = {
  numero: formData.numero,
  cliente_nome: formData.cliente_nome,
  cliente_cnpj: formData.cliente_cnpj || "",  // Permitia vazio!
  // ... outros campos ...
  // criado_em e atualizado_em não eram preenchidos
};
```

**Depois:**
```typescript
const notaData: any = {
  numero: formData.numero.trim(),
  cliente_nome: formData.cliente_nome.trim(),
  cliente_cnpj: formData.cliente_cnpj.trim(), // Obrigatório
  data_criacao: formData.data_criacao,
  data_vencimento: formData.data_vencimento, // Obrigatório
  valor: parseFloat(formData.valor),
  categoria: formData.categoria,  // Obrigatório
  descricao: formData.descricao || null,
  status: formData.status,
  arquivo_pdf_url: pdfUrl || null,
  aeronave: formData.aeronave || null,
  criado_por: user?.id || null,
  criado_em: new Date().toISOString(), // ADICIONADO
  atualizado_em: new Date().toISOString(), // ADICIONADO
};
```

### 2.2 UPDATE - Atualização de Timestamp
**Antes:**
```typescript
const { error } = await supabase
  .from("notas_fiscais_saida")
  .update(notaData)
  .eq("id", editingNota.id);
```

**Depois:**
```typescript
const { error } = await supabase
  .from("notas_fiscais_saida")
  .update({
    ...notaData,
    atualizado_em: new Date().toISOString(), // ADICIONADO
  })
  .eq("id", editingNota.id);
```

### 2.3 UPDATE de Status
**Antes:**
```typescript
const { error } = await supabase
  .from("notas_fiscais_saida")
  .update({ status: newStatus })
  .eq("id", notaId);
```

**Depois:**
```typescript
const { error } = await supabase
  .from("notas_fiscais_saida")
  .update({
    status: newStatus,
    atualizado_em: new Date().toISOString(), // ADICIONADO
  })
  .eq("id", notaId);
```

---

## 3. CORREÇÕES NAS OPERAÇÕES FRONTEND

### 3.1 Validação de Status
**Adicionado:**
```typescript
const handleChangeStatus = async (notaId: string, newStatus: string) => {
  // Validar que o novo status é válido
  const statusValidos = ["pendente", "recebido", "cancelado"];
  if (!statusValidos.includes(newStatus)) {
    toast({
      title: "Erro",
      description: "Status inválido",
      variant: "destructive",
    });
    return;
  }
  // ... resto da função ...
}
```

### 3.2 Correção no Cálculo de Totais
**Antes:**
```typescript
const totalPago = notas
  .filter((n) => n.status === "pago" || n.status === "recebido") // "pago" é inválido!
  .reduce((acc, n) => acc + n.valor, 0);
```

**Depois:**
```typescript
const totalRecebido = notas
  .filter((n) => n.status === "recebido") // Apenas valor válido
  .reduce((acc, n) => acc + n.valor, 0);
```

---

## 4. CHAMADAS NA FUNÇÃO handleSave()

**Adição de validação antes de salvar:**
```typescript
const handleSave = async () => {
  // VALIDAÇÃO COMPLETA - NOVA
  const erroValidacao = validarNotaFiscal(formData);
  if (erroValidacao) {
    toast({
      title: "Validação",
      description: erroValidacao,
      variant: "destructive",
    });
    return;
  }
  // ... resto da função ...
}
```

---

## 5. MUDANÇAS NA INTERFACE

### 5.1 Labels de Campos Obrigatórios
Adicionado asterisco (*) para indicar campos obrigatórios:
- Número da NF *
- Data de Criação *
- Cliente/Empresa *
- CNPJ/CPF * (NOVO - agora obrigatório)
- Data de Vencimento * (NOVO - agora obrigatório)
- Valor (R$) *
- Categoria * (NOVO - agora obrigatório)
- Status *

---

## 6. MATRIZ DE CONFORMIDADE COM TABELA

| Campo | Obrigatório na Tabela | Validação Antes | Validação Depois | Status |
|-------|----------------------|-----------------|------------------|--------|
| id | SIM (PK) | ✗ | ✓ (DB) | ✓ |
| numero | SIM | ✓ | ✓ | ✓ |
| cliente_nome | SIM | ✓ | ✓ | ✓ |
| cliente_cnpj | SIM | ✗ | ✓ | **CORRIGIDO** |
| data_criacao | SIM | ✓ | ✓ | ✓ |
| data_vencimento | SIM | ✗ | ✓ | **CORRIGIDO** |
| valor | SIM (>0) | Parcial | ✓ | **CORRIGIDO** |
| categoria | SIM | ✗ | ✓ | **CORRIGIDO** |
| descricao | NÃO | ✓ | ✓ | ✓ |
| status | SIM (constraint) | Parcial | ✓ | **CORRIGIDO** |
| arquivo_pdf_url | NÃO | ✓ | ✓ | ✓ |
| criado_em | NÃO (default) | ✗ | ✓ | **ADICIONADO** |
| atualizado_em | NÃO (default) | ✗ | ✓ | **ADICIONADO** |
| criado_por | NÃO | ✓ | ✓ | ✓ |
| aeronave | NÃO (FK) | ✓ | ✓ | ✓ |

---

## 7. COMO USAR O ARQUIVO CORRIGIDO

### Opção 1: Substituir o arquivo original
```bash
cp src/components/fiscal/NotasFiscaisSaida.corrected.tsx src/components/fiscal/NotasFiscaisSaida.tsx
```

### Opção 2: Comparar mudanças antes de usar
```bash
diff src/components/fiscal/NotasFiscaisSaida.tsx src/components/fiscal/NotasFiscaisSaida.corrected.tsx
```

---

## 8. TESTES RECOMENDADOS

### 8.1 Teste de Validação
- [ ] Tentar criar NF sem número → deve mostrar erro
- [ ] Tentar criar NF sem cliente → deve mostrar erro
- [ ] Tentar criar NF sem CNPJ → deve mostrar erro **NOVO**
- [ ] Tentar criar NF com valor 0 → deve mostrar erro **NOVO**
- [ ] Tentar criar NF sem data de vencimento → deve mostrar erro **NOVO**
- [ ] Tentar criar NF sem categoria → deve mostrar erro **NOVO**
- [ ] Tentar criar NF com status inválido → deve mostrar erro **NOVO**

### 8.2 Teste de Persistência
- [ ] Criar NF e verificar se criado_em foi preenchido
- [ ] Editar NF e verificar se atualizado_em foi atualizado
- [ ] Mudar status e verificar se atualizado_em foi atualizado

### 8.3 Teste de Dados
- [ ] Verificar se CNPJ é armazenado corretamente
- [ ] Verificar se data_vencimento é armazenada corretamente
- [ ] Verificar se categoria é armazenada corretamente
- [ ] Verificar se status é um dos 3 valores válidos

---

## 9. PRÓXIMOS PASSOS

1. **Backup**: Fazer backup do arquivo original antes de substituir
2. **Deploy**: Testar em ambiente de desenvolvimento primeiro
3. **Migração**: Se há dados existentes com problemas, considerar uma migração
4. **Documentação**: Atualizar documentação do sistema

---

## 10. NOTAS IMPORTANTES

- Todos os timestamps agora usam `new Date().toISOString()` (padrão ISO 8601)
- Validações são executadas no cliente ANTES de enviar ao banco
- Os constraints do banco ainda serão aplicados como camada de proteção adicional
- Status válidos: **pendente**, **recebido**, **cancelado** (não use "pago")

---

## Arquivo Original vs Corrigido

| Aspecto | Original | Corrigido |
|---------|----------|-----------|
| Validação de CNPJ | Não | Sim |
| Validação de data_vencimento | Não | Sim |
| Validação de categoria | Não | Sim |
| Timestamp criado_em no INSERT | Não | Sim |
| Timestamp atualizado_em no UPDATE | Não | Sim |
| Status válido | Parcial | Sim |
| Valor > 0 | Parcial | Sim |

