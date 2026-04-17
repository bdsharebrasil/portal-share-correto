# 📖 Guia de Migração - Diário de Bordo

## Como Migrar Seu Código para a Nova Estrutura

### 1. Importar Dados com `useDiarioData`

#### ❌ Antes (Scattered imports e logic)
```typescript
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function MyComponent({ aircraftId }) {
  const [aircraft, setAircraft] = useState(null)
  const [entries, setEntries] = useState([])
  const [crew, setCrew] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [acRes, entriesRes, crewRes] = await Promise.all([
          supabase.from('aeronave').select('*').eq('id', aircraftId).single(),
          supabase.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId),
          supabase.from('crew').select('*').eq('status', 'ativo')
        ])
        
        if (acRes.data) setAircraft(acRes.data)
        if (entriesRes.data) setEntries(entriesRes.data)
        if (crewRes.data) setCrew(crewRes.data)
      } catch (error) {
        toast.error('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [aircraftId])

  return (
    <div>
      {loading ? <Spinner /> : <Table aircraft={aircraft} entries={entries} />}
    </div>
  )
}
```

#### ✅ Depois (Using the new hook)
```typescript
import { useDiarioData } from '@/components/diario'

export function MyComponent({ aircraftId }) {
  const { aircraft, entries, crew, loading } = useDiarioData(
    aircraftId, 
    new Date().getMonth() + 1, 
    new Date().getFullYear()
  )

  return (
    <div>
      {loading ? <Spinner /> : <Table aircraft={aircraft} entries={entries} />}
    </div>
  )
}
```

**Ganho**: 40 linhas → 10 linhas! 🚀

---

### 2. Usar Cálculos com `useFlightCalculations`

#### ❌ Antes (Functions scattered in component)
```typescript
// Dentro do componente principal
const calculateTimes = (entry) => {
  const result = calculateDayNightTimes({
    dep_time: entry.dep_time,
    pou_time: entry.pou_time,
    total_time: entry.total_time
  })
  return {
    ...entry,
    night_hours: result.night_time,
    day_time: result.day_time
  }
}

const calculateCelula = (entry) => {
  let baseParaCalculo = lastCelula
  if (entries && entries.length > 0) {
    const celulasExistentes = entries.map((e) => Number(e.celula) || 0)
    const ultimaCelulaRegistrada = Math.max(...celulasExistentes)
    if (ultimaCelulaRegistrada > baseParaCalculo) {
      baseParaCalculo = ultimaCelulaRegistrada
    }
  }
  const flightTime = calculateTimeDiff(entry.dep_time, entry.pou_time) || 0
  const newCelula = parseFloat((baseParaCalculo + flightTime).toFixed(1))
  return newCelula
}

// Usar:
const times = calculateTimes(newEntry)
const celula = calculateCelula(newEntry)
```

#### ✅ Depois (Clean hook)
```typescript
import { useFlightCalculations } from '@/components/diario'

export function MyComponent() {
  const { calculateTimes, calculateCelula } = useFlightCalculations(
    entries,
    aerodromes,
    lastCelula
  )

  // Usar:
  const times = calculateTimes(newEntry)
  const celula = calculateCelula(newEntry)
}
```

**Ganho**: Lógica testável, reutilizável e centralizada! ✨

---

### 3. Calcular Diárias com `usePerDiem`

#### ❌ Antes (Complex memoized calculation)
```typescript
const calculatePerDiemInfo = useMemo(() => {
  if (!logbookMonth?.tem_tarifa_diaria || !logbookMonth?.aerodromo_base) {
    return { count: 0, total: 0, details: [], byEntry: {} }
  }

  const baseAerodrome = logbookMonth.aerodromo_base
  const dailyRate = logbookMonth.tarifa_diaria

  const periodEntries = entries
    .filter((e) => {
      if (!e.data_registro) return false
      const date = new Date(e.data_registro)
      if (isNaN(date.getTime())) return false
      return date.getUTCMonth() + 1 === selectedMonth && ...
    })
    .sort((a, b) => {
      const dateA = new Date(a.data_registro)
      const dateB = new Date(b.data_registro)
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0
      return dateA.getTime() - dateB.getTime()
    })

  const perDiems = []
  const byEntry = {}
  let isAwayFromBase = false
  
  // ... 60+ linhas de lógica complexa

  return {
    count: perDiems.length,
    total: perDiems.length * dailyRate,
    details: perDiems,
    byEntry
  }
}, [entries, selectedMonth, selectedYear, logbookMonth])

// Usar:
setTotalDiarias(calculatePerDiemInfo.total)
```

#### ✅ Depois (Clean hook)
```typescript
import { usePerDiem } from '@/components/diario'

export function MyComponent() {
  const perDiemInfo = usePerDiem(entries, selectedMonth, selectedYear, logbookMonth)
  
  // Usar:
  setTotalDiarias(perDiemInfo.total)
  console.log(perDiemInfo.count) // Número de diárias
  console.log(perDiemInfo.total) // Total em R$
  console.log(perDiemInfo.byEntry) // Por entrada de voo
}
```

**Ganho**: 80 linhas → 5 linhas + complexidade escondida ✨

---

### 4. Validar Voo com Utilities

#### ❌ Antes (Inline validation)
```typescript
const handleSave = () => {
  if (!newEntry.entry_date) {
    toast.error('Data do voo é obrigatória')
    return
  }
  if (!newEntry.departure_aerodrome) {
    toast.error('Aeródromo de partida é obrigatório')
    return
  }
  if (!newEntry.arrival_aerodrome) {
    toast.error('Aeródromo de chegada é obrigatório')
    return
  }
  if (!newEntry.pic_canac) {
    toast.error('Piloto em comando é obrigatório')
    return
  }
  // ... 20+ mais ifs
  
  saveEntry()
}
```

#### ✅ Depois (Using validation utility)
```typescript
import { validateFlightEntry, formatValidationErrors } from '@/components/diario'

const handleSave = () => {
  const errors = validateFlightEntry(newEntry)
  
  if (errors.length > 0) {
    toast.error(formatValidationErrors(errors))
    return
  }
  
  saveEntry()
}
```

**Ganho**: 30 linhas → 8 linhas + testável! ✅

---

### 5. Converter Tempos com Utilities

#### ❌ Antes (Import scattered, functions inside component)
```typescript
const timeStringToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

const minutesToTimeString = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// Usar:
const mins = timeStringToMinutes(acTime)
const timeStr = minutesToTimeString(mins - 30)
```

#### ✅ Depois (Using utilities)
```typescript
import { timeStringToMinutes, minutesToTimeString } from '@/components/diario'

// Usar:
const mins = timeStringToMinutes(acTime)
const timeStr = minutesToTimeString(mins - 30)
```

**Ganho**: Importar uma vez, usar em qualquer lugar! 🎯

---

## Mapeamento de Imports

### Para Dados
```typescript
import { useDiarioData } from '@/components/diario'
// Retorna: aircraft, crew, aerodromes, clients, entries, logbookMonth, loans, ...
```

### Para Cálculos
```typescript
import { useFlightCalculations } from '@/components/diario'
// Retorna: calculateTimes(), calculateCelula(), calculateDistanceBetweenAerodromes()
```

### Para Diárias
```typescript
import { usePerDiem } from '@/components/diario'
// Retorna: PerDiemInfo com count, total, details, byEntry
```

### Para Gerenciamento de Célula
```typescript
import { useCelulaManagement } from '@/components/diario'
// Retorna: updateCelulaAtual()
```

### Para Utilitários de Tempo
```typescript
import { 
  timeStringToMinutes,
  minutesToTimeString,
  calculateTimeDiff,
  decimalToTimeString,
  decimalToHHMM
} from '@/components/diario'
```

### Para Utilitários de Célula
```typescript
import {
  calculateCelulaAtual,
  calculateCelulaDisponivel,
  isCelulaWarning,
  isCelulaAlert
} from '@/components/diario'
```

### Para Utilitários de Data
```typescript
import {
  formatDateFromISO,
  getMonthName,
  isValidDate,
  getPreviousMonth,
  getNextMonth
} from '@/components/diario'
```

### Para Validação
```typescript
import { validateFlightEntry, formatValidationErrors } from '@/components/diario'
```

### Para Dialogs
```typescript
import {
  CreateMonthDialog,
  CloseMonthDialog,
  ExportLogbookDialog,
  MaintenanceStatusAlert
} from '@/components/diario'
```

### Para Types
```typescript
import type {
  FlightEntry,
  Aircraft,
  Crew,
  LogbookMonth,
  PerDiemInfo,
  ValidationError
} from '@/components/diario'
```

---

## Exemplo Completo: Mini Dashboard

### ❌ Antes (Messy)
```typescript
export function MiniDashboard({ aircraftId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // 50+ linhas de loading logic
  }, [aircraftId])

  const calculatePerDiem = () => {
    // 40+ linhas de complex calculation
  }

  const calculateTimes = () => {
    // 30+ linhas de calculations
  }

  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### ✅ Depois (Clean)
```typescript
import { useDiarioData, usePerDiem, useFlightCalculations } from '@/components/diario'

export function MiniDashboard({ aircraftId }) {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const { entries, logbookMonth, loading } = useDiarioData(aircraftId, currentMonth, currentYear)
  const perDiem = usePerDiem(entries, currentMonth, currentYear, logbookMonth)
  const { calculateTimes } = useFlightCalculations(entries, [], 0)

  if (loading) return <Spinner />

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card title="Voos" value={entries.length} />
      <Card title="Diárias" value={`R$ ${perDiem.total}`} />
      <Card title="Horas" value={entries.reduce((s, e) => s + e.tempo_voo, 0)} />
    </div>
  )
}
```

**Componente reduzido de 150+ linhas para ~40 linhas!** 🚀

---

## Checklist de Migração

Se está refatorando um componente:

- [ ] Remover `useState` de dados
- [ ] Substituir por `useDiarioData`
- [ ] Remover `useEffect` de loading
- [ ] Remover funções de cálculo inline
- [ ] Substituir por `useFlightCalculations`
- [ ] Remover validação inline
- [ ] Substituir por `validateFlightEntry`
- [ ] Verificar se usa time conversions
- [ ] Substituir por utilities de time
- [ ] Testar build: `pnpm build`
- [ ] Testar componente no navegador

---

## Troubleshooting

### "Module not found"
```
Erro: Cannot find module '@/components/diario/hooks/...'

Solução: 
import { useDiarioData } from '@/components/diario'
         ↑ sempre daqui, não do caminho interno
```

### "Property does not exist"
```
Erro: Property 'entries' does not exist on type...

Solução: Verificar topo de DiarioBordo/types.ts
         Os types estão documentados lá
```

### Build falha após migração
```
Solução: Rodar pnpm build para ver erro específico
         Verificar se imports estão corretos
         Remover imports antigos duplicados
```

---

## Performance Tips

1. **Memoize useDiarioData**: Se chamado em múltiplos lugares, store resultado
2. **Lazy load dialogs**: Use React.lazy() para dialogs não usados sempre
3. **Split routes**: Cada rota pode carregar seus own hooks
4. **Cache entries**: useDiarioData já faz memoization

---

## Suporte & Questões

Dúvidas? Checklist:
1. Executar `pnpm build` - mostra erros específicos
2. Verificar `DiarioBordo/index.ts` - saber o que está disponível
3. Verificar `DiarioBordo/types.ts` - tipos disponíveis
4. Verificar exemplos em `DiarioBordoDetalhes.tsx` - já migrou!

---

**Aproveite a nova organização! 🎉**
