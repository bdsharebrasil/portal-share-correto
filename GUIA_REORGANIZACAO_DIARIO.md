# 🚀 Guia de Reorganização - Passo a Passo

## ✅ Mapa de Decisões - Quais Arquivos Manter

### Duplicados - Decidir Qual Versão Manter

#### 1. **CloseMonthDialog**
- Raiz: `/components/diario/CloseMonthDialog.tsx`
- Subfolder: `/components/diario/DiarioBordoDetalhes/components/CloseMonthDialog.tsx`
- **MANTER**: Subfolder (usando em DiarioBordoDetalhes)
- **DELETAR**: Raiz

#### 2. **CreateMonthDialog**
- Raiz: `/components/diario/CreateMonthDialog.tsx`
- Subfolder: `/components/diario/DiarioBordoDetalhes/components/CreateMonthDialog.tsx`
- **MANTER**: Subfolder (usando em DiarioBordoDetalhes)
- **DELETAR**: Raiz

#### 3. **ExportLogbookDialog**
- Raiz: `/components/diario/ExportLogbookDialog.tsx`
- Subfolder: `/components/diario/DiarioBordoDetalhes/components/ExportLogbookDialog.tsx`
- **MANTER**: Subfolder (mais recente, com mais validações)
- **DELETAR**: Raiz

#### 4. **MaintenanceStatusAlert**
- Raiz: `/components/diario/MaintenanceStatusAlert.tsx`
- Subfolder: `/components/diario/DiarioBordoDetalhes/components/MaintenanceStatusAlert.tsx`
- **MANTER**: Raiz (componente genérico, reutilizável)
- **DELETAR**: Subfolder

#### 5. **SICComboBoxManual**
- Raiz: `/components/diario/SICComboBoxManual.tsx`
- Subfolder: `/components/diario/DynamicLogbookForm/components/SICComboBoxManual.tsx`
- **MANTER**: Subfolder (mais específico, dentro do form)
- **DELETAR**: Raiz

#### 6. **DynamicLogbookForm**
- Arquivo: `/components/diario/DynamicLogbookForm.tsx`
- Pasta: `/components/diario/DynamicLogbookForm/index.tsx`
- **MANTER**: Pasta (melhor organizada)
- **DELETAR**: Arquivo raiz

### Não Utilizados - Verificar Antes de Deletar

| Arquivo | Usado Em | Decisão |
|---------|----------|---------|
| `AddLogbookEntryDialog.tsx` | ❌ Não encontrado | ⚠️ Investigar |
| `AircraftMetricsForm.tsx` | ❌ Não encontrado | ⚠️ Investigar |
| `LogbookDetails.tsx` | ❌ Não encontrado | ⚠️ Investigar |
| `CreateDiaryDialog.tsx` | ❌ Não encontrado | ⚠️ Investigar |
| `CreateLogbookDialog.tsx` | Usado em DiarioMes | ✅ Manter |

---

## 📦 Novos Arquivos/Pastas a Criar

### 1. Criar Pasta DiarioBordo
```bash
mkdir -p src/components/diario/DiarioBordo/{hooks,utils,components,dialogs}
```

### 2. Criar Hooks Customizados

#### `useDiarioData.ts`
- Funções: Carregar dados de aeronaves, entradas, meses, crew, clientes
- Fonte: Lógica de `useEffect` do DiarioBordoDetalhes

#### `useFlightCalculations.ts`
- Funções: Calcular tempos, distância, célula, dia/noite
- Fonte: Cálculos espalhados em DiarioBordoDetalhes

#### `usePerDiem.ts`
- Funções: Calcular diárias baseado em base aérea
- Fonte: `calculatePerDiemInfo` do DiarioBordoDetalhes

#### `useCelulaManagement.ts`
- Funções: Gerenciar célula (anterior, atual, próxima)
- Fonte: Funções `updateCelulaAtual`, `calculateCelulaAtual`

### 3. Criar Utils Customizadas

#### `timeCalculations.ts`
```typescript
export function timeStringToMinutes(time: string): number
export function minutesToTimeString(minutes: number): string
export function calculateTimeDiff(start: string, end: string): number
```

#### `celulaCalculations.ts`
```typescript
export function calculateCelulaAtual(entries, previous): number
export function calculateCelulaDisponivel(nextMaint, current): number
```

#### `dateHelpers.ts`
```typescript
export function isMonthAvailable(month, year, availableMonths)
export function getMonthLabel(month, year)
```

#### `flightValidation.ts`
```typescript
export function validateFlightEntry(entry): { valid, errors }
export function validateRequiredFields(entry): boolean
```

---

## 🔄 Refatoração em Passos

### Passo 1: Criar Nova Estrutura Base
```bash
mkdir -p src/components/diario/DiarioBordo/{hooks,utils,components/DiarioTable,components/FlightForm,components/MonthSelector,dialogs}
```

### Passo 2: Criar index.ts Principal
```typescript
// src/components/diario/index.ts
export { DiarioBordo } from './DiarioBordo'
export { AddAerodromeDialog } from './dialogs/AddAerodromeDialog'
export { AddAircraftDialog } from './dialogs/AddAircraftDialog'
export { PartnerSelectModal } from './dialogs/PartnerSelectModal'
export { MaintenanceStatusAlert } from './shared/MaintenanceStatusAlert'
```

### Passo 3: Consolidar Dialogs
- Mover para: `src/components/diario/dialogs/`
- Arquivos:
  - `AddAerodromeDialog.tsx`
  - `AddAircraftDialog.tsx`
  - `PartnerSelectModal.tsx`
  - `CreateDiaryDialog.tsx`

### Passo 4: Consolidar DiarioBordo Internos
- Mover para: `src/components/diario/DiarioBordo/dialogs/`
- Arquivos:
  - `DiarioBordoDetalhes/components/CreateMonthDialog.tsx`
  - `DiarioBordoDetalhes/components/CloseMonthDialog.tsx`
  - `DiarioBordoDetalhes/components/ExportLogbookDialog.tsx`

---

## 🔍 Mapa de Imports Atuais

### Arquivos que Importam componentes do diario:
```
- src/pages/Aerodromos.tsx → AddAerodromeDialog
- src/pages/Aeronaves.tsx → AddAircraftDialog
- src/pages/AeronaveDetalhes.tsx → AddAircraftDialog
- src/pages/DiarioBordo/index.tsx → DiarioBordoDetalhes
- src/pages/financeiro/RelatorioViagem.tsx → PartnerSelectModal
- src/components/diario/DiarioBordoDetalhes/index.tsx → PartnerSelectModal, SICComboBoxManual
```

### ⚠️ Precisam Atualizar Para:
```
Antes: import { AddAerodromeDialog } from '@/components/diario/AddAerodromeDialog'
Depois: import { AddAerodromeDialog } from '@/components/diario/dialogs'

Antes: import DiarioBordoDetalhes from '@/components/diario/DiarioBordoDetalhes'
Depois: import { DiarioBordo } from '@/components/diario/DiarioBordo'
```

---

## ⏱️ Estimativa de Esforço

| Tarefa | Tempo | Prioridade |
|--------|-------|-----------|
| Criar estrutura de pastas | 5 min | 🔴 Alta |
| Criar hooks customizados | 1h | 🔴 Alta |
| Criar utils customizados | 30 min | 🔴 Alta |
| Refatorar DiarioBordoDetalhes | 3h | 🔴 Alta |
| Atualizar imports globais | 20 min | 🟡 Média |
| Deletar duplicados | 10 min | 🟡 Média |
| Testar funcionalidade | 1h | 🔴 Alta |
| **TOTAL** | **~6h** | - |

---

## ✨ Checklist de Execução

### Preparação
- [ ] Backup de `src/components/diario/`
- [ ] Criar document de análise
- [ ] Listar todos os imports

### Criação
- [ ] Criar estrutura de pastas
- [ ] Criar arquivo `types.ts`
- [ ] Criar hooks em `hooks/`
- [ ] Criar utils em `utils/`
- [ ] Criar componentes em `components/`

### Refatoração
- [ ] Extrair lógica para hooks
- [ ] Extrair funções para utils
- [ ] Criar componentes menores
- [ ] Consolidar dialogs
- [ ] Consolidar shared

### Integração
- [ ] Atualizar import principal: `src/components/diario/index.ts`
- [ ] Atualizar imports em `Aerodromos.tsx`
- [ ] Atualizar imports em `Aeronaves.tsx`
- [ ] Atualizar imports em `AeronaveDetalhes.tsx`
- [ ] Atualizar imports em `RelatorioViagem.tsx`
- [ ] Atualizar imports em `DiarioBordo/index.tsx`

### Limpeza
- [ ] Deletar `DiarioBordoDetalhes.tsx` (raiz)
- [ ] Deletar arquivos duplicados
- [ ] Deletar `DynamicLogbookForm.tsx` (raiz)
- [ ] Deletar `SICComboBoxManual.tsx` (raiz)
- [ ] Deletar `CloseMonthDialog.tsx` (raiz)
- [ ] Deletar `CreateMonthDialog.tsx` (raiz)
- [ ] Deletar `ExportLogbookDialog.tsx` (raiz)

### Testes
- [ ] Teste de build: `pnpm build`
- [ ] Teste de imports: Verificar console
- [ ] Teste funcional: Navegar até Diário de Bordo
- [ ] Teste de features: Criar voo, exportar, fechar mês

---

## 🎯 Próximos Passos

1. **Aprovar** essa estrutura proposta
2. **Executar** a reorganização passo-a-passo
3. **Testar** cada fase
4. **Documentar** padrões e convenções

