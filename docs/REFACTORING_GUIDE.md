# Guia de Refatoração - Diário de Bordo Detalhes

## Problema Original

O arquivo `DiarioBordoDetalhes.tsx` tinha **10 problemas principais**:

1. ❌ **Lógica duplicada** - `handleSaveFlight()` e `handleSaveEditedEntryForm()` (150 linhas cada)
2. ❌ **useEffects excessivos** - 50+ linhas com lógica complexa
3. ❌ **Funções auxiliares misturadas** - 20+ funções utilitárias no topo do arquivo
4. ❌ **Estado excessivo** - 30+ useState hooks
5. ❌ **Validação descentralizada** - Lógica espalhada pelo componente
6. ❌ **Lógica de negócio misturada** - Supabase calls diretas no componente
7. ❌ **Componentes repetidos** - TimeInput usado 4 vezes com código duplicado
8. ❌ **Sem padronização de logs** - console.log/console.error espalhados
9. ❌ **Cálculos complexos diretos** - Sem hooks reutilizáveis
10. ❌ **Sem tipagem centralizada** - Tipos espalhados no arquivo

## Solução Implementada

### 1. Organização de Utilitários

#### `utils/timeUtils.ts` - Funções de Tempo
```typescript
import { 
  timeStringToMinutes, 
  minutesToTimeString, 
  calculateTimeDiff,
  decimalToTimeString,
  timeStringToDecimal,
  calculateCrewCheckinTime
} from '@/utils/timeUtils';
```

#### `utils/calculationUtils.ts` - Cálculos
```typescript
import { 
  calculateDistance,
  calculateCostPerPartner,
  calculateDayNightTimes,
  calculateDailyAllowanceForEntry,
  calculateBlockTime,
  calculateFlightTime
} from '@/utils/calculationUtils';
```

#### `utils/formatters.ts` - Formatação
```typescript
import { 
  formatTimeFromTimestamp,
  formatDateFromISO,
  shortenClientName,
  formatBRL,
  formatHours,
  formatFlightNature
} from '@/utils/formatters';
```

#### `utils/logger.ts` - Logging Estruturado
```typescript
import { logger, logInfo, logSuccess, logError } from '@/utils/logger';

// Em vez de console.log():
logSuccess('Voo salvo com sucesso', { entryId: data.id });
logError('Erro ao salvar voo', error);
```

### 2. Validação Centralizada

#### `validators/flightEntryValidator.ts`
```typescript
import { 
  validateFlightEntry, 
  validateTimeFieldsOnly,
  formatValidationErrors 
} from '@/validators/flightEntryValidator';

// Validar entrada completa
const validation = validateFlightEntry(entry, 'cliente');
if (!validation.isValid) {
  const errors = formatValidationErrors(validation.errors);
  toast.error(errors);
}
```

### 3. Lógica de Negócio Centralizada

#### `services/flightService.ts`
```typescript
import { FlightService } from '@/services/flightService';

// Unifica handleSaveFlight() + handleSaveEditedEntryForm()
const result = await FlightService.saveFlightEntry(
  entry,
  { aircraftId, logbookMonthId, baseAerodrome },
  flightType
);

// Deleta voo
await FlightService.deleteFlightEntry(entryId);

// Carrega entradas
const entries = await FlightService.loadFlightEntries(logbookMonthId);

// Confirma/desconfirma
await FlightService.toggleConfirmation(entryId, true);
```

### 4. Hooks Customizados

#### `hooks/useFlightTimeCalculation.ts`
```typescript
import { 
  useFlightTimeCalculation,
  useBlockTime,
  useFlightTime,
  useDayNightTimes 
} from '@/hooks/useFlightTimeCalculation';

// Calcula automaticamente com useMemo
const calculation = useFlightTimeCalculation(
  acTime, corTime, depTime, pouTime, 
  lastCelula, fuelConsumptionRate
);

// Resultado
if (calculation) {
  console.log(calculation.blockTime);    // tempo total de bloco
  console.log(calculation.flightTime);   // tempo DEP→POU
  console.log(calculation.dayTime);      // tempo diurno
  console.log(calculation.nightTime);    // tempo noturno
  console.log(calculation.celula);       // horas acumuladas
}
```

#### `hooks/useAppReducer.ts`
```typescript
import { useAppReducer } from '@/hooks/useAppReducer';

const {
  state,           // estado completo
  setLoading,      // ui.isLoading
  setSaving,       // ui.isSaving
  toggleShowAddForm,
  setFlightType,
  setNewEntry,
  resetForm,
  // ... mais 20 ações
} = useAppReducer();

// Em vez de 30+ useState:
// state.ui.showAddForm
// state.period.selectedMonth
// state.form.newEntry
// state.form.flightType
```

### 5. Componentes Reutilizáveis

#### `components/diario/shared/TimeInput.tsx`
```typescript
import { TimeInput, CompactTimeInput, TimeInputGroup } from '@/components/diario/shared/TimeInput';

// Input único
<TimeInput
  label="AC"
  value={acTime}
  onChange={setAcTime}
  required
  error={errors.ac_time}
/>

// Grupo completo (AC, DEP, POU, COR)
<TimeInputGroup
  acTime={acTime}
  onAcTimeChange={setAcTime}
  depTime={depTime}
  onDepTimeChange={setDepTime}
  pouTime={pouTime}
  onPouTimeChange={setPouTime}
  corTime={corTime}
  onCorTimeChange={setCorTime}
  errors={errors}
/>
```

### 6. Tipos Centralizados

#### `types/diarioTypes.ts`
```typescript
import { 
  AppState, 
  FlightEntry,
  Aircraft,
  CrewMember,
  Client,
  LogbookMonth,
  FLIGHT_TYPES,
  SPLIT_FLIGHT_TYPES 
} from '@/types/diarioTypes';

// Tipos consistentes em toda a aplicação
const entry: FlightEntry = { ... };
const aircraft: Aircraft = { ... };
```

## Como Refatorar DiarioBordoDetalhes.tsx

### Passo 1: Substituir imports de funções

**Antes:**
```typescript
// Arquivo inteiro com funções auxiliares
const timeStringToMinutes = (...) => { ... };
const calculateDistance = (...) => { ... };
const formatTimeFromTimestamp = (...) => { ... };
```

**Depois:**
```typescript
import { timeStringToMinutes, calculateCrewCheckinTime } from '@/utils/timeUtils';
import { calculateDistance, calculateDailyAllowanceForEntry } from '@/utils/calculationUtils';
import { formatTimeFromTimestamp, formatFlightNature } from '@/utils/formatters';
import { logger } from '@/utils/logger';
```

### Passo 2: Substituir console.log por logger

**Antes:**
```typescript
console.log('✅ Clientes carregados:', clientRes.data);
console.log('🔵 handleSaveFlight INICIADA', {...});
console.error('❌ Erro ao salvar:', error);
```

**Depois:**
```typescript
logSuccess('Clientes carregados', clientRes.data);
logger.info('handleSaveFlight iniciada', {...});
logError('Erro ao salvar voo', error);
```

### Passo 3: Consolidar handleSaveFlight + handleSaveEditedEntryForm

**Antes:**
```typescript
const handleSaveFlight = async () => { /* 150 linhas */ };
const handleSaveEditedEntryForm = async () => { /* 150 linhas similares */ };
```

**Depois:**
```typescript
const handleSaveFlightEntry = async (entry: FlightEntry, isEdit: boolean) => {
  try {
    setSaving(true);
    const result = await FlightService.saveFlightEntry(
      entry,
      { aircraftId, logbookMonthId, baseAerodrome },
      flightType
    );
    
    if (isEdit) {
      setEntries(entries.map(e => e.id === entry.id ? result : e));
    } else {
      setEntries([...entries, result]);
    }
    
    resetForm();
    toast.success('Voo salvo com sucesso');
  } catch (error) {
    logError('Erro ao salvar voo', error);
    toast.error(error.message);
  } finally {
    setSaving(false);
  }
};
```

### Passo 4: Usar hooks de cálculo

**Antes:**
```typescript
useEffect(() => {
  // 50 linhas de cálculos
  const blockTime = calculateTimeDiff(acTime, corTime);
  const flightTime = calculateTimeDiff(depTime, pouTime);
  // ... mais cálculos
  setCalculatedTimes({...});
}, [acTime, corTime, depTime, pouTime, lastCelula, entries]);
```

**Depois:**
```typescript
const calculation = useFlightTimeCalculation(
  acTime, corTime, depTime, pouTime, lastCelula, fuelConsumption
);

// Usar automaticamente em renders:
// calculation?.blockTime
// calculation?.dayTime
// calculation?.nightTime
```

### Passo 5: Substituir 30+ useState por useAppReducer

**Antes:**
```typescript
const [selectedMonth, setSelectedMonth] = useState(...);
const [selectedYear, setSelectedYear] = useState(...);
const [showMonthPicker, setShowMonthPicker] = useState(...);
const [showAddForm, setShowAddForm] = useState(...);
// ... 26 mais
```

**Depois:**
```typescript
const {
  state,
  toggleShowAddForm,
  setPeriod,
  setNewEntry,
  setFlightType,
  resetForm,
  // ... mais ações conforme necessário
} = useAppReducer();

// Acessar estado:
state.ui.showAddForm
state.period.selectedMonth
state.form.flightType
```

### Passo 6: Usar TimeInput reutilizável

**Antes:**
```typescript
// Repetido 4 vezes
<div className="space-y-2">
  <Label className="text-[9px] uppercase text-slate-500">AC</Label>
  <Input type="time" value={acTime} onChange={(e) => setAcTime(...)} />
</div>
```

**Depois:**
```typescript
// Uma única linha
<TimeInput
  label="AC"
  value={acTime}
  onChange={setAcTime}
  required
  error={errors.ac_time}
/>
```

### Passo 7: Validação centralizada

**Antes:**
```typescript
if (!selectedPic) {
  toast.error('Selecione o PIC');
  return;
}
if (!depTime || !pouTime) {
  toast.error('Preencha DEP e POU');
  return;
}
// ... validações espalhadas
```

**Depois:**
```typescript
const validation = validateFlightEntry(newEntry, flightType);
if (!validation.isValid) {
  const errorMsg = formatValidationErrors(validation.errors);
  toast.error(errorMsg);
  return;
}
```

## Exemplos Práticos

### Exemplo 1: Salvar um voo novo

```typescript
const handleAddFlight = async () => {
  const validation = validateFlightEntry(state.form.newEntry, state.form.flightType);
  if (!validation.isValid) {
    toast.error(formatValidationErrors(validation.errors));
    return;
  }

  setSaving(true);
  try {
    const result = await FlightService.saveFlightEntry(
      state.form.newEntry,
      { aircraftId, logbookMonthId, baseAerodrome },
      state.form.flightType
    );
    
    setEntries([...entries, result]);
    resetForm();
    toast.success('Voo adicionado com sucesso');
  } catch (error) {
    logError('Erro ao adicionar voo', error);
    toast.error('Erro ao salvar voo');
  } finally {
    setSaving(false);
  }
};
```

### Exemplo 2: Usar cálculos automáticos

```typescript
function FlightCalculationPanel() {
  const [acTime, setAcTime] = useState('');
  const [corTime, setCorTime] = useState('');
  const [depTime, setDepTime] = useState('');
  const [pouTime, setPouTime] = useState('');

  const calculation = useFlightTimeCalculation(
    acTime, corTime, depTime, pouTime, 0, 50
  );

  return (
    <div>
      <TimeInputGroup
        acTime={acTime}
        onAcTimeChange={setAcTime}
        corTime={corTime}
        onCorTimeChange={setCorTime}
        depTime={depTime}
        onDepTimeChange={setDepTime}
        pouTime={pouTime}
        onPouTimeChange={setPouTime}
      />

      {calculation && (
        <div>
          <p>Bloco: {formatHours(calculation.blockTime)}</p>
          <p>Voo: {formatHours(calculation.flightTime)}</p>
          <p>Noturno: {formatHours(calculation.nightTime)}</p>
        </div>
      )}
    </div>
  );
}
```

### Exemplo 3: Gerenciar estado da UI

```typescript
function DiarioBordoDetalhes() {
  const {
    state,
    toggleShowAddForm,
    setLoading,
    setFlightType,
    resetForm
  } = useAppReducer();

  const handleLoadData = async () => {
    setLoading(true);
    try {
      // carregar dados...
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={toggleShowAddForm}>
        {state.ui.showAddForm ? 'Fechar' : 'Novo Voo'}
      </button>
      
      {state.ui.showAddForm && (
        <form>
          <select 
            value={state.form.flightType}
            onChange={(e) => setFlightType(e.target.value)}
          >
            <option>Cliente</option>
            <option>Rateio</option>
            <option>Empréstimo</option>
          </select>
        </form>
      )}
    </div>
  );
}
```

## Benefícios da Refatoração

| Antes | Depois |
|-------|--------|
| 2 funções save duplicadas (300 linhas) | 1 função save (50 linhas via FlightService) |
| 30+ useState | 1 useAppReducer |
| useEffects de 50+ linhas | Hooks específicos (useMemo) |
| 20+ funções auxiliares no arquivo | Organizadas em utils/ |
| Validação espalhada | 1 validador centralizado |
| Logging com console.log | Logger estruturado |
| TimeInput repetido 4x | 1 componente reutilizável |
| Tipos espalhados | Tipos em types/diarioTypes.ts |
| console.log/error misturados | logger.info/success/error/warning |

## Próximos Passos

1. Aplicar a refatoração gradualmente em `DiarioBordoDetalhes.tsx`
2. Testar cada mudança
3. Atualizar testes unitários
4. Documentar padrões de uso para o time

## Padrões Recomendados

### Para novos componentes de formulário:
```typescript
import { TimeInput } from '@/components/diario/shared/TimeInput';
import { validateFlightEntry } from '@/validators/flightEntryValidator';
import { FlightService } from '@/services/flightService';
```

### Para novos cálculos:
```typescript
import { useFlightTimeCalculation } from '@/hooks/useFlightTimeCalculation';
import { calculateDistance, calculateDailyAllowanceForEntry } from '@/utils/calculationUtils';
```

### Para logs:
```typescript
import { logSuccess, logError } from '@/utils/logger';
```

### Para estados complexos:
```typescript
import { useAppReducer } from '@/hooks/useAppReducer';
```
