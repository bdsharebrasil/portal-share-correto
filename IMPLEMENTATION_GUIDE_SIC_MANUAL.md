# Guia de Implementação - SIC Manual (Copiloto sem Cadastro)

## 📋 Resumo das Alterações

Você agora pode inserir dados de SIC (Copiloto) de duas formas:
1. **Selecionando de crew_members cadastrado** - vinculado ao banco, rastreável
2. **Inserindo manualmente** - texto livre, sem criar cadastro

## 🔄 Arquivos Modificados

### 1. ✅ Novo Componente: `src/components/diario/SICComboBoxManual.tsx`
- **Funcionalidade**: Combobox com opção de inserção manual
- **Features**:
  - Busca em tempo real entre pilotos cadastrados
  - Modo "Adicionar manualmente" para inserção sem cadastro
  - Badges visuais: "Crew" (azul) vs "Manual" (laranja)
  - Help text explicativo
  - Validação de entrada

### 2. ✅ Atualizado: `src/components/diario/DiarioBordoDetalhes.tsx`
- **Linhas modificadas**: 1-18 (import), 1966-1975 (nova entrada), 3430-3439 (edição)
- **Mudanças**:
  - Importa `SICComboBoxManual`
  - Substitui `Select` por `SICComboBoxManual` em 2 locais
  - Passa `sic_canac` e `sic_name` para o componente

### 3. ✅ Atualizado: `src/components/diario/DynamicLogbookForm.tsx`
- **Linhas modificadas**: 13 (import), 87 (state), 455 (insert), 574, 669, 1684 (reset), 1091-1107 (render)
- **Mudanças**:
  - Importa `SICComboBoxManual`
  - Adiciona estado `sicName`
  - Inclui `sic_name` no insert do logbook
  - Reseta `sicName` em todos os reset do formulário
  - Substitui Popover/Command por `SICComboBoxManual`

### 4. 🔧 SQL Migração: `supabase/migrations/20250205_add_sic_validation_and_rls.sql`
- **O que faz**:
  - Adiciona constraint para validação de SIC
  - Cria índice em `sic_name` para melhor performance
  - Atualiza RLS policies para permitir `sic_name`
  - Cria trigger para normalizar dados
  - Adiciona comentários de documentação

## 🚀 Como Implementar

### Passo 1: Executar Migração SQL no Supabase
```bash
# No Supabase Console > SQL Editor
# Execute: supabase/migrations/20250205_add_sic_validation_and_rls.sql
```

### Passo 2: Instalar Dependências
```bash
# Se Badge não estiver importado em SICComboBoxManual.tsx
pnpm add @radix-ui/react-badge
# Já deve estar disponível via shadcn/ui
```

### Passo 3: Testar Funcionamento
```bash
# Terminal 1: Backend
pnpm dev:backend

# Terminal 2: Frontend
pnpm dev

# Abrir http://localhost:8080
```

### Passo 4: Testar Fluxos

#### Fluxo 1: SIC Selecionado do Cadastro
1. Abrir Diário de Bordo
2. Clique em "+ Nova Entrada"
3. No campo "Copiloto (SIC)"
4. Digite nome do piloto cadastrado
5. Selecione da lista
6. Badge mostra "Crew" (azul)
7. Salve a entrada

#### Fluxo 2: SIC Inserido Manualmente
1. Abrir Diário de Bordo
2. Clique em "+ Nova Entrada"
3. No campo "Copiloto (SIC)"
4. Se o piloto não aparecer na busca
5. Clique "+ Adicionar manualmente"
6. Digite: "João Silva - ABC1234"
7. Clique "Confirmar"
8. Badge mostra "Manual" (laranja)
9. Salve a entrada

#### Fluxo 3: Editar Entrada com SIC Manual
1. Clique em entrada existente para editar
2. Campo SIC já mostra o nome manual
3. Pode mudar para crew member ou deixar manual
4. Salve a alteração

## 📊 Dados no Banco

### Cenário 1: SIC de Crew Member
```sql
{
  sic_canac: "550e8400-e29b-41d4-a716-446655440000",  -- UUID valid
  sic_name: null
}
```

### Cenário 2: SIC Manual (sem cadastro)
```sql
{
  sic_canac: null,
  sic_name: "João Silva - ABC1234"  -- Free text
}
```

### Cenário 3: Sem SIC
```sql
{
  sic_canac: null,
  sic_name: null
}
```

## 🎨 UI/UX Melhorias

### Combobox
- ✅ Input com busca filtrada
- ✅ Opção "Nenhum SIC" (limpa tudo)
- ✅ Opção "+ Adicionar manualmente" quando não encontra
- ✅ Mostra CANAC do piloto na lista

### Badge Visual
- 🔵 **Crew**: Azul (vinculado a crew_members)
- 🟠 **Manual**: Laranja (inserido manualmente)
- Ajuda a identificar visualmente o tipo de SIC

### Help Text
- Aviso quando manual: "SIC será inserido manualmente (não vinculado a crew)"
- Aviso quando crew: "SIC vinculado ao cadastro de pilotos"
- Formato sugerido para manual: "Nome Completo - CANAC"

## 🔍 Queries Úteis (SQL)

### Encontrar entradas com SIC manual
```sql
SELECT id, entry_date, sic_name, sic_canac
FROM public.logbook_entries
WHERE sic_canac IS NULL AND sic_name IS NOT NULL
ORDER BY entry_date DESC;
```

### Encontrar entradas com SIC do cadastro
```sql
SELECT le.id, le.entry_date, cm.full_name, cm.canac
FROM public.logbook_entries le
JOIN public.crew_members cm ON le.sic_canac = cm.id
ORDER BY le.entry_date DESC;
```

### Consolidar SIC (manual ou cadastro)
```sql
SELECT 
  entry_date,
  COALESCE(cm.full_name, le.sic_name) as sic_display,
  COALESCE(cm.canac, le.sic_canac::text) as canac_display
FROM public.logbook_entries le
LEFT JOIN public.crew_members cm ON le.sic_canac = cm.id
WHERE le.sic_canac IS NOT NULL OR le.sic_name IS NOT NULL;
```

## 📄 Relatórios & PDF

### PDF Export (já está atualizado)
Arquivo `src/lib/logbookPdfExport.ts` já usa:
```typescript
entry.sic_name || entry.sic_canac || '-'
```

Isso automaticamente mostra:
- Nome manual se preenchido
- Ou CANAC do crew se selecionado
- Ou '-' se nenhum SIC

## ⚠️ Considerar no Futuro

### 1. Importação de SIC Manual para Crew
Implementar função para converter SIC manual em crew_members:
```typescript
async function promoteManualSicToCrewMember(
  entryId: string,
  fullName: string,
  canac: string
): Promise<void> {
  // 1. Create crew_member
  // 2. Update logbook_entry (sic_canac = new crew id, sic_name = null)
  // 3. Update crew_flight_hours
}
```

### 2. Migração de Dados Históricos
Se houver dados antigos com `sic_canac = null` e `sic_name` preenchido:
```sql
-- Dados já estarão compatíveis, nenhuma migração necessária
SELECT COUNT(*) FROM logbook_entries 
WHERE sic_canac IS NULL AND sic_name IS NOT NULL;
```

### 3. Auditoria
Registrar mudanças em `created_by` para rastrear quem criou SIC manual:
```sql
-- Já está em logbook_entries.created_by
-- Use junto com audit logs se implementar
```

## 🐛 Troubleshooting

### Problema: "SIC não aparece na busca"
- **Motivo**: Piloto não está em crew_members
- **Solução**: Use "Adicionar manualmente"

### Problema: "Erro ao salvar com SIC manual"
- **Motivo**: RLS policy não foi aplicada
- **Solução**: Execute migração SQL no Supabase

### Problema: "Badge não mostra corretamente"
- **Motivo**: Badge component não importado
- **Solução**: Verificar `@radix-ui/react-badge` está instalado

### Problema: "SIC desaparece ao editar"
- **Motivo**: Não atualizar componente após seleção
- **Solução**: Verificar se `SICComboBoxManual` está sendo chamado com props corretos

## 📝 Checklist de Implementação

- [x] Componente `SICComboBoxManual.tsx` criado
- [x] `DiarioBordoDetalhes.tsx` atualizado
- [x] `DynamicLogbookForm.tsx` atualizado
- [x] SQL migração criada
- [ ] **TODO**: Executar migração SQL no Supabase
- [ ] Testar fluxo de seleção de SIC cadastrado
- [ ] Testar fluxo de inserção manual de SIC
- [ ] Testar edição de entrada com SIC
- [ ] Testar exportação de PDF com SIC manual
- [ ] Validar dados no banco de dados
- [ ] Comunicar mudanças para usuários

## 🔗 Referências

- Schema logbook_entries: 207 campos
- Constraint novo: `check_sic_either_canac_or_name`
- Trigger novo: `trg_validate_sic_entry`
- Componente: `SICComboBoxManual` (271 linhas)

## 💬 Notas

- ✅ Permite SIC opcional (campo pode ser NULL)
- ✅ Permite dois modos: cadastrado ou manual
- ✅ Não quebra dados existentes
- ✅ Fácil de auditar (sic_name registra inserção)
- ✅ PDF export automaticamente se adapta
- ⚠️ Recomenda formato: "Nome - CANAC" para consistência
