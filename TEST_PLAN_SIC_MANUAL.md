# Plano de Testes - SIC Manual Entry

## 🧪 Testes Funcionais

### Teste 1: Inserir Nova Entrada com SIC Cadastrado
**Objetivo**: Validar que SIC selecionado de crew_members funciona

**Passos**:
1. Abrir "Diário de Bordo" → Aeronave
2. Clique "+ Nova Entrada"
3. Preencha dados básicos (data, aeródromos, etc)
4. Campo "Copiloto (SIC)" → Digite nome de piloto cadastrado
5. Selecione da lista dropdown
6. Verifique badge "Crew" (azul)
7. Clique "Salvar"

**Esperado**:
- ✅ Entrada criada sem erro
- ✅ Badge mostra "Crew"
- ✅ BD: sic_canac = UUID válido, sic_name = NULL
- ✅ PDF export mostra nome do piloto

---

### Teste 2: Inserir Nova Entrada com SIC Manual
**Objetivo**: Validar que SIC manual sem cadastro funciona

**Passos**:
1. Abrir "Diário de Bordo" → Aeronave
2. Clique "+ Nova Entrada"
3. Preencha dados básicos
4. Campo "Copiloto (SIC)" → Digite nome que NÃO existe
5. Aparece "+ Adicionar manualmente"
6. Clique nessa opção
7. Digite: "João Silva - ABC1234"
8. Clique "Confirmar"
9. Verifique badge "Manual" (laranja)
10. Clique "Salvar"

**Esperado**:
- ✅ Opção "Adicionar manualmente" aparece
- ✅ Input manual funciona
- ✅ Badge mostra "Manual"
- ✅ BD: sic_canac = NULL, sic_name = "João Silva - ABC1234"
- ✅ PDF export mostra "João Silva - ABC1234"

---

### Teste 3: Inserir Nova Entrada SEM SIC
**Objetivo**: Validar que campo SIC pode ficar vazio

**Passos**:
1. Abrir "Diário de Bordo" → Aeronave
2. Clique "+ Nova Entrada"
3. Preencha dados básicos
4. Campo "Copiloto (SIC)" → Clique "Nenhum SIC"
5. Verifique que não mostra badge
6. Clique "Salvar"

**Esperado**:
- ✅ Entrada criada sem erro
- ✅ Nenhum badge exibido
- ✅ BD: sic_canac = NULL, sic_name = NULL
- ✅ PDF export mostra "-" para SIC

---

### Teste 4: Editar Entrada com SIC (Crew → Manual)
**Objetivo**: Validar edição trocando tipo de SIC

**Passos**:
1. Abrir Diário de Bordo
2. Clique em entrada existente com SIC crew_member
3. Badge mostra "Crew"
4. Campo SIC → "+ Adicionar manualmente"
5. Digite: "Pedro Costa - XYZ5678"
6. Clique "Confirmar"
7. Badge agora mostra "Manual"
8. Clique "Salvar"

**Esperado**:
- ✅ Edição funciona sem erro
- ✅ Badge muda de "Crew" para "Manual"
- ✅ BD: sic_canac = NULL, sic_name = "Pedro Costa - XYZ5678"
- ✅ PDF export mostra novo nome

---

### Teste 5: Editar Entrada com SIC (Manual → Crew)
**Objetivo**: Validar edição trocando tipo de SIC inverso

**Passos**:
1. Abrir Diário de Bordo
2. Clique em entrada existente com SIC manual
3. Badge mostra "Manual"
4. Campo SIC → Busque piloto cadastrado
5. Selecione da lista
6. Badge agora mostra "Crew"
7. Clique "Salvar"

**Esperado**:
- ✅ Edição funciona sem erro
- ✅ Badge muda de "Manual" para "Crew"
- ✅ BD: sic_canac = UUID válido, sic_name = NULL
- ✅ Horas de voo atualizadas para crew member

---

### Teste 6: Validação de Dados no Banco
**Objetivo**: Verificar integridade dos dados

**Passos** (SQL no Supabase):
```sql
-- Verificar constraint
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'logbook_entries' AND constraint_name LIKE '%sic%';

-- Verificar dados com SIC manual
SELECT id, entry_date, sic_canac, sic_name 
FROM logbook_entries 
WHERE sic_canac IS NULL AND sic_name IS NOT NULL 
LIMIT 5;

-- Verificar dados com SIC crew
SELECT le.id, le.entry_date, cm.full_name, cm.canac
FROM logbook_entries le
JOIN crew_members cm ON le.sic_canac = cm.id
LIMIT 5;

-- Verificar sem SIC
SELECT id, entry_date, sic_canac, sic_name 
FROM logbook_entries 
WHERE sic_canac IS NULL AND sic_name IS NULL 
LIMIT 5;
```

**Esperado**:
- ✅ Constraint `check_sic_either_canac_or_name` existe
- ✅ SIC manual tem dados em sic_name
- ✅ SIC crew tem dados em sic_canac
- ✅ Sem SIC tem ambos NULL

---

### Teste 7: PDF Export
**Objetivo**: Validar que PDF mostra SIC corretamente

**Passos**:
1. Abrir Diário de Bordo
2. Gerar PDF/Exportar com entradas mistas (crew, manual, nenhum)
3. Abrir PDF e verificar coluna SIC

**Esperado**:
- ✅ SIC crew mostra nome completo
- ✅ SIC manual mostra texto inserido
- ✅ Sem SIC mostra "-"
- ✅ Sem erros ou campo vazio quebrado

---

### Teste 8: Busca e Filtros
**Objetivo**: Validar que queries funcionam

**Passos** (no código ou via API):
1. Buscar por `sic_name` LIKE "João%"
2. Buscar por `sic_canac` = UUID específico
3. Filtrar entradas com SIC manual
4. Filtrar entradas de crew específico

**Esperado**:
- ✅ Índice em sic_name melhora performance
- ✅ Queries retornam dados corretos
- ✅ Sem erros de relacionamento

---

## 🔒 Testes de Segurança (RLS)

### Teste 9: Inserção com Dados Inválidos
**Objetivo**: Validar RLS policy bloqueia dados ruins

**Passos**:
1. Via API/Supabase Client, tente inserir:
```typescript
{
  sic_canac: "uuid-invalido-nao-existe",
  sic_name: "João Silva",
  // ...outros campos
}
```

**Esperado**:
- ✅ Constraint bloqueia (ou trigger normaliza)
- ✅ Mensagem de erro clara
- ✅ Entrada NÃO é criada

---

### Teste 10: RLS Policy Enforcement
**Objetivo**: Validar que users não podem ler dados de outro

**Passos**:
1. User A cria entrada com SIC manual
2. User B tenta acessar
3. Via RLS policy

**Esperado**:
- ✅ User B não vê entrada se não tem permissão
- ✅ User B não pode editar entrada
- ✅ RLS policy funciona corretamente

---

## 🎨 Testes de UI/UX

### Teste 11: Combobox Responsivo
**Objetivo**: Validar que combobox funciona bem em mobile

**Passos**:
1. Abrir em mobile/tablet
2. Clique no campo SIC
3. Digite para buscar
4. Selecione opção
5. Verifique layout

**Esperado**:
- ✅ Popover aparece corretamente
- ✅ Busca é responsiva
- ✅ Sem overflow de conteúdo
- ✅ Badges visíveis

---

### Teste 12: Acessibilidade
**Objetivo**: Validar que componente é acessível

**Passos**:
1. Usar keyboard (Tab, Enter, ArrowDown)
2. Usar screen reader (VoiceOver/NVDA)
3. Testar com zoom in/out

**Esperado**:
- ✅ Navegável com keyboard
- ✅ Labels apropriados para screen reader
- ✅ Funciona com zoom

---

### Teste 13: Performance
**Objetivo**: Validar que não há lag na busca

**Passos**:
1. Abrir campo SIC
2. Digitar rápido
3. Esperar resultado da busca
4. Abrir DevTools (Network/Performance)

**Esperado**:
- ✅ Busca responsiva (<500ms)
- ✅ Sem lag ao digitar
- ✅ Sem re-renders desnecessários

---

## 📊 Testes de Dados Existentes

### Teste 14: Compatibilidade com Dados Antigos
**Objetivo**: Validar que dados existentes não quebram

**Passos**:
1. Backup do banco
2. Aplicar migração SQL
3. Verificar dados existentes
4. Abrir entradas antigas em edit

**Esperado**:
- ✅ Nenhum dado perdido
- ✅ Entradas antigas funcionam normalmente
- ✅ Sem erro de migration

---

## 📋 Checklist de Testes

### Antes de Começar
- [ ] Backend rodando (`pnpm dev:backend`)
- [ ] Frontend rodando (`pnpm dev`)
- [ ] Migração SQL executada no Supabase
- [ ] Conexão com banco testada
- [ ] Dados de teste preparados

### Testes Funcionais
- [ ] Teste 1: SIC Cadastrado
- [ ] Teste 2: SIC Manual
- [ ] Teste 3: Sem SIC
- [ ] Teste 4: Editar Crew → Manual
- [ ] Teste 5: Editar Manual → Crew
- [ ] Teste 6: Validação BD
- [ ] Teste 7: PDF Export
- [ ] Teste 8: Busca/Filtros

### Testes de Segurança
- [ ] Teste 9: Dados Inválidos
- [ ] Teste 10: RLS Policy

### Testes de UX
- [ ] Teste 11: Responsivo
- [ ] Teste 12: Acessibilidade
- [ ] Teste 13: Performance

### Testes de Dados
- [ ] Teste 14: Compatibilidade

### Finalização
- [ ] Todos os testes passaram
- [ ] Sem erros no console
- [ ] Documentação atualizada
- [ ] Código comentado
- [ ] Deploy pronto

---

## 🚨 Possíveis Problemas e Soluções

### Problema: "RLS Policy error"
```
Error: new row violates row-level security policy for table "logbook_entries"
```
**Solução**: Migração SQL não foi executada. Execute em Supabase > SQL Editor.

---

### Problema: "Constraint violation"
```
Error: check_sic_either_canac_or_name
```
**Solução**: Dados inválidos. Verifique que pelo menos um de sic_canac ou sic_name está preenchido.

---

### Problema: "Component not found"
```
Error: Cannot find module 'SICComboBoxManual'
```
**Solução**: Verifique imports em DiarioBordoDetalhes.tsx e DynamicLogbookForm.tsx.

---

### Problema: "Badge doesn't show"
**Solução**: Verifique se `@radix-ui/react-badge` está instalado:
```bash
pnpm add @radix-ui/react-badge
```

---

### Problema: "sic_name não salva"
**Solução**: Verifique se `sic_name` está sendo passado no insert do logbook_entries.

---

## 📈 Métricas de Sucesso

- ✅ 100% dos testes passam
- ✅ Nenhum erro no console
- ✅ Performance < 100ms para combobox
- ✅ PDF exports mostram SIC correto
- ✅ Dados consistentes no banco
- ✅ Zero quebra de dados existentes

---

