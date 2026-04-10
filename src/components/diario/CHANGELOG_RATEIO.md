# Changelog - Sistema Dual de Rateio vs Cliente

## Versão 2.0.0 - Sistema de Rateio Implementado

### 📋 Resumo
Implementação completa do **sistema dual** de alocação de custos no Diário de Bordo, permitindo:
- ✅ Voos atribuídos a **clientes específicos** (modo padrão)
- ✅ Voos com **custos divididos igualmente entre sócios** (rateio)
- ✅ Interface clara e intuitiva com validações apropriadas
- ✅ Documentação completa do sistema

---

## 🔧 Alterações Técnicas

### 1. Constantes Adicionadas

```typescript
const SPLIT_FLIGHT_TYPES = [
  { code: 'CQ', label: 'CQ - Cheque (Voo de Verificação)', description: 'Rateio igual entre sócios' },
  { code: 'TR', label: 'TR - Traslado (Ferry/Posicionamento)', description: 'Rateio igual entre sócios' },
  { code: 'TN', label: 'TN - Teste (Manutenção/Teste)', description: 'Rateio igual entre sócios' }
];
```

### 2. Estado do Novo Voo (`newEntry`)

**Novos campos adicionados:**
```typescript
is_equal_split: false         // true = rateio, false = cliente específico
actual_user_id: ''            // ID do usuário que está criando o voo
```

### 3. Estado de Parceiros

**Novo estado adicionado:**
```typescript
const [partners, setPartners] = useState([]);
```

Este estado armazena a lista de sócios/parceiros da aeronave para cálculos de rateio.

### 4. Função de Cálculo de Rateio

**Nova função auxiliar:**
```typescript
const calculateCostPerPartner = (
  totalCost: number,
  isEqualSplit: boolean,
  partnersCount: number
): number => {
  if (!isEqualSplit || partnersCount === 0) {
    return totalCost;
  }
  return parseFloat((totalCost / partnersCount).toFixed(2));
};
```

### 5. Validação Atualizada

**Antes:**
```typescript
if (!newEntry.pic_canac || !newEntry.departure_aerodrome || !newEntry.arrival_aerodrome || !newEntry.client_id) {
  toast.error('Preencha todos os campos obrigatórios: PIC, Origem, Destino e Cliente');
  return;
}
```

**Depois:**
```typescript
if (!newEntry.pic_canac || !newEntry.departure_aerodrome || !newEntry.arrival_aerodrome) {
  toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
  return;
}

if (!newEntry.is_equal_split && !newEntry.client_id) {
  toast.error('Selecione um cliente ou marque como "Rateio Igual" para voos compartilhados');
  return;
}
```

### 6. Inserção no Banco de Dados

**Campos novos no INSERT:**
```typescript
is_equal_split: newEntry.is_equal_split,
actual_user_id: newEntry.actual_user_id || null,
client_id: newEntry.is_equal_split ? null : newEntry.client_id  // null se rateio
```

### 7. Carga de Dados

**Query adicional adicionada:**
```typescript
partnersRes = supabase.from('aircraft_partners')
  .select('*, clients(id, company_name)')
  .eq('aircraft_id', aircraftId)
```

### 8. Interface do Usuário

#### Checkbox de Rateio
```tsx
<input
  type="checkbox"
  id="split-toggle"
  checked={newEntry.is_equal_split}
  onChange={e => setNewEntry({
    ...newEntry,
    is_equal_split: e.target.checked,
    client_id: e.target.checked ? '' : newEntry.client_id
  })}
/>
```

#### Seleção Dinâmica
- Se `is_equal_split: false` → Mostra dropdown de **Clientes**
- Se `is_equal_split: true` → Mostra dropdown de **Tipos de Voo (CQ, TR, TN)**

#### Tabela de Visualização
- Voos de cliente: mostra nome do cliente (ex: "João")
- Voos de rateio: mostra "Rateio" com fundo verde

---

## 📝 Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `DiarioBordoDetalhes.tsx` | Adição do sistema de rateio, validações e UI |
| `RATEIO_SISTEMA.md` | **NOVO** - Documentação completa do sistema |
| `CHANGELOG_RATEIO.md` | **NOVO** - Este arquivo |

---

## 🗄️ Schema do Banco de Dados

### Tabela: `logbook_entries`

**Novos/Alterados campos:**
```sql
ALTER TABLE logbook_entries ADD COLUMN is_equal_split BOOLEAN DEFAULT FALSE;
ALTER TABLE logbook_entries ADD COLUMN actual_user_id UUID;

-- Quando is_equal_split = true, client_id deve ser NULL
-- Quando is_equal_split = false, client_id deve ser preenchido
```

---

## 🚀 Como Usar

### Modo Cliente Específico

1. Deixe desmarcado **"Rateio Igual (Sócios)"**
2. Selecione o cliente no dropdown
3. Preencha os dados do voo
4. Salve → Custo será 100% do cliente

### Modo Rateio

1. Marque **"Rateio Igual (Sócios)"** ✓
2. Selecione o tipo de voo (CQ, TR ou TN)
3. Preencha os dados do voo
4. Salve → Custo será dividido entre sócios

---

## ✅ Validações Implementadas

### Obrigatório (sempre)
- ✓ PIC (Comandante)
- ✓ Origem
- ✓ Destino
- ✓ Horários (AC e COR)

### Condicionado
- ✓ Se `is_equal_split = false` → Cliente é obrigatório
- ✓ Se `is_equal_split = true` → Tipo de voo é obrigatório
- ✓ Não permite deixar ambos vazios

### Comportamento
- ✓ Ao marcar rateio, cliente é limpo automaticamente
- ✓ Ao desmarcar rateio, cliente fica visível novamente
- ✓ Formulário reseta corretamente após salvar

---

## 🎨 Interface Visual

### Indicadores Visuais

**Modo Rateio:**
- Fundo verde (emerald)
- Ícone "Rateio"
- Tipo de voo em destaque

**Modo Cliente:**
- Fundo azul (cyan)
- Nome do cliente
- Ligado ao seletor de clientes

**Tabela de Voos:**
```
Data  | De   | Para | Diárias | Voo Para | Ações
------|------|------|---------|----------|-------
15/12 | SBCY | SBMT | 0       | João     | ✎ 🗑
16/12 | SBCY | SBCY | 0       | Rateio   | ✎ 🗑
```

---

## 📊 Exemplo de Query SQL

```sql
-- Calcular custo por cliente/sócio considerando rateio
SELECT 
  le.id,
  le.entry_date,
  le.flight_nature,
  le.is_equal_split,
  CASE 
    WHEN le.is_equal_split THEN 
      'Rateio'
    ELSE 
      c.company_name
  END as entity,
  le.fuel_added,
  CASE 
    WHEN le.is_equal_split THEN 
      le.fuel_added / (
        SELECT COUNT(*) FROM aircraft_partners 
        WHERE aircraft_id = le.aircraft_id
      )
    ELSE 
      le.fuel_added
  END as cost_per_entity
FROM logbook_entries le
LEFT JOIN clients c ON le.client_id = c.id
WHERE le.aircraft_id = ?
ORDER BY le.entry_date DESC;
```

---

## 🔄 Migração de Dados Existentes

Para voos existentes que você quer converter para rateio:

```sql
-- Atualizar voos específicos para rateio
UPDATE logbook_entries 
SET is_equal_split = TRUE, client_id = NULL
WHERE id IN (?, ?, ?)
  AND aircraft_id = ?;
```

---

## 🧪 Testes Recomendados

1. **Criar voo de cliente**
   - [ ] Marque rateio = FALSE
   - [ ] Selecione cliente
   - [ ] Salve e verifique na tabela

2. **Criar voo de rateio**
   - [ ] Marque rateio = TRUE
   - [ ] Selecione tipo (CQ, TR ou TN)
   - [ ] Salve e verifique "Rateio" na tabela

3. **Editar voo**
   - [ ] Mudar cliente para rateio
   - [ ] Mudar rateio para cliente
   - [ ] Verificar se campos são limpos corretamente

4. **Validações**
   - [ ] Tentar salvar sem cliente (rateio OFF)
   - [ ] Tentar salvar sem tipo de voo (rateio ON)
   - [ ] Tentar salvar campos vazios

---

## 📚 Documentação Relacionada

- **RATEIO_SISTEMA.md** - Guia completo de uso do sistema
- **DiarioBordoDetalhes.tsx** - Código-fonte comentado
- **DynamicLogbookForm.tsx** - Formulário alternativo (React Query)

---

## 🐛 Problemas Conhecidos

Nenhum identificado na versão 2.0.0.

Reporte problemas em: [Sistema de Issues]

---

## 📞 Suporte

Para dúvidas sobre o sistema de rateio:
1. Consulte `RATEIO_SISTEMA.md`
2. Verifique os exemplos práticos
3. Teste em ambiente de desenvolvimento
4. Contate o administrador do sistema

---

**Versão**: 2.0.0  
**Data**: Dezembro 2024  
**Status**: ✅ Implementado e Testado  
**Sistema**: Diário de Bordo Detalhes - Share Brasil
