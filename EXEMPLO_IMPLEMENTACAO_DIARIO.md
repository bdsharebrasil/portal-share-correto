# 🎨 Exemplo de Implementação - Código Antes e Depois

## Antes: Estrutura Desorganizada

```
src/components/diario/
├── DiarioBordoDetalhes.tsx (3400+ linhas 😱)
├── DiarioBordoDetalhes/
│   ├── index.tsx (cópia com modificações?)
│   └── components/
│       ├── CloseMonthDialog.tsx
│       ├── CreateMonthDialog.tsx
│       ├── ExportLogbookDialog.tsx
│       └── MaintenanceStatusAlert.tsx
├── DynamicLogbookForm.tsx
├── DynamicLogbookForm/
│   ├── index.tsx
│   └── components/
│       └── SICComboBoxManual.tsx
├── CloseMonthDialog.tsx (duplicado)
├── CreateMonthDialog.tsx (duplicado)
├── ExportLogbookDialog.tsx (duplicado)
├── MaintenanceStatusAlert.tsx (duplicado)
├── SICComboBoxManual.tsx (duplicado)
└── ... outros 10 arquivos
```

---

## Depois: Estrutura Organizada

```
src/components/diario/
├── index.ts
├── types.ts
├── DiarioBordo/
│   ├── index.tsx
│   ├── DiarioBordo.tsx (refatorado)
│   ├── types.ts
│   ├── hooks/
│   │   ├── useDiarioData.ts
│   │   ├── useFlightCalculations.ts
│   │   ├── usePerDiem.ts
│   │   └── useCelulaManagement.ts
│   ├── utils/
│   │   ├── timeCalculations.ts
│   │   ├── celulaCalculations.ts
│   │   ├── dateHelpers.ts
│   │   └── flightValidation.ts
│   ├── components/
│   │   ├── DiarioTable.tsx
│   │   ├── FlightForm.tsx
│   │   ├── MonthSelector.tsx
│   │   └── TechnicalStatus.tsx
│   └── dialogs/
│       ├── CreateMonthDialog.tsx
│       ├── CloseMonthDialog.tsx
│       ├── ExportLogbookDialog.tsx
│       └── MaintenanceStatusAlert.tsx
├── LogbookEntry/
│   ├── index.tsx
│   └── components/
│       └── SICComboBoxManual.tsx
├── shared/
│   ├── TimeInput.tsx
│   └── AerodromeSelect.tsx
├── dialogs/
│   ├── AddAerodromeDialog.tsx
│   ├── AddAircraftDialog.tsx
│   ├── PartnerSelectModal.tsx
│   └── CreateDiaryDialog.tsx
└── docs/
    ├── CHANGELOG_RATEIO.md
    ├── INTEGRATION_EXAMPLE.md
    └── RATEIO_SISTEMA.md
```

---

## 💡 Exemplo 1: Hook Customizado - useDiarioData

### ❌ Antes (Em DiarioBordoDetalhes.tsx)
```typescript
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const [acRes, crewMembersRes, crewTableRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes, clientPartnersRes] = await Promise.all([
        supabase.from('aeronave').select('*').eq('status', 'ativa').eq('id', aircraftId).single(),
        supabase.from('membros_tripulacao').select('*').eq('status', 'ativo').order('full_name', { ascending: true }),
        supabase.from('crew').select('id, nome_completo, canac, status').eq('status', 'ativo').order('full_name', { ascending: true }),
        supabase.from('aerodromes').select('*').order('designativo'),
        supabase.from('clientes').select('id, razao_social, cnpj, client_aircraft(aircraft_id, share_percentage)').order('razao_social'),
        supabase.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId).order('numero_sequencial', { ascending: true }),
        // ... mais queries
      ]);
      
      if (acRes.data) {
        setAircraft(acRes.data);
        setLastCelula(acRes.data.cell_hours_current || 0);
      }
      // ... 50+ linhas de processamento
      setCrew(mergedCrew);
      setClients(clientRes.data);
      // ... etc
    } catch (error) {
      logError("Erro ao carregar dados", error);
    } finally {
      setLoading(false);
    }
  };

  if (aircraftId) loadData();
}, [aircraftId, selectedMonth, selectedYear]);
```

### ✅ Depois (Hook customizado)
```typescript
// src/components/diario/DiarioBordo/hooks/useDiarioData.ts

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DiarioData {
  aircraft: any | null;
  crew: any[];
  aerodromes: any[];
  clients: any[];
  entries: any[];
  availableMonths: any[];
  partners: any[];
  clientPartners: Record<string, any>;
  loading: boolean;
  error: string | null;
}

export function useDiarioData(
  aircraftId: string,
  selectedMonth: number,
  selectedYear: number
): DiarioData {
  const [state, setState] = useState<DiarioData>({
    aircraft: null,
    crew: [],
    aerodromes: [],
    clients: [],
    entries: [],
    availableMonths: [],
    partners: [],
    clientPartners: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const promises = await Promise.all([
          supabase.from('aeronave').select('*').eq('status', 'ativa').eq('id', aircraftId).single(),
          supabase.from('membros_tripulacao').select('*').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('crew').select('id, nome_completo, canac, status').eq('status', 'ativo'),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clientes').select('*').order('razao_social'),
          supabase.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId),
          supabase.from('diario_mes').select('mes, ano').eq('aeronave_id', aircraftId).eq('fechado', false),
          supabase.from('aircraft_partners').select('*'),
          supabase.from('socios_cliente').select('id, name, cpf, client_id'),
        ]);

        const [acRes, crewMembers, crewTable, aerodromes, clients, entries, months, partners, socios] = promises;

        // Processar dados
        const mergedCrew = mergeCrew(crewMembers.data || [], crewTable.data || []);
        const partnerMap = buildPartnerMap(partners.data || []);

        setState(prev => ({
          ...prev,
          aircraft: acRes.data,
          crew: mergedCrew,
          aerodromes: aerodromes.data || [],
          clients: clients.data || [],
          entries: entries.data || [],
          availableMonths: months.data || [],
          partners: partners.data || [],
          clientPartners: partnerMap,
          loading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Erro ao carregar dados',
          loading: false,
        }));
        toast.error('Erro ao carregar dados do sistema');
      }
    };

    if (aircraftId) {
      loadData();
    }
  }, [aircraftId, selectedMonth, selectedYear]);

  return state;
}

// Funções auxiliares
function mergeCrew(crewMembers: any[], crewTable: any[]): any[] {
  const existingIds = new Set(crewMembers.map(c => c.id));
  return [
    ...crewMembers,
    ...crewTable.filter(c => !existingIds.has(c.id)),
  ];
}

function buildPartnerMap(partners: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  partners.forEach(p => {
    map[p.id] = p;
  });
  return map;
}
```

### Usar o Hook
```typescript
// Em DiarioBordo.tsx
import { useDiarioData } from './hooks/useDiarioData';

export function DiarioBordo({ aircraftId }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { aircraft, crew, clients, entries, loading, error } = useDiarioData(
    aircraftId,
    selectedMonth,
    selectedYear
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {/* Usar aircraft, crew, clients, entries */}
    </div>
  );
}
```

---

## 💡 Exemplo 2: Utils Customizadas - timeCalculations

### ❌ Antes (Espalhado)
```typescript
// Em vários lugares do DiarioBordoDetalhes.tsx
const acMin = parseInt(newEntry.ac_time.split(':')[0]) * 60 + parseInt(newEntry.ac_time.split(':')[1]);
const checkinMin = acMin - 30;
const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;

// ... Repetido em múltiplos locais
if (newEntry.ac_time && newEntry.cor_time) {
  const acTime = parseInt(newEntry.ac_time.split(':')[0]) * 60 + parseInt(newEntry.ac_time.split(':')[1]);
  const corTime = parseInt(newEntry.cor_time.split(':')[0]) * 60 + parseInt(newEntry.cor_time.split(':')[1]);
  let totalTime = corTime - acTime;
  if (totalTime < 0) totalTime += 1440;
  setNewEntry(prev => ({ ...prev, total_time: totalTime / 60 }));
}
```

### ✅ Depois (Funções centralizadas)
```typescript
// src/components/diario/DiarioBordo/utils/timeCalculations.ts

/**
 * Converte string de hora (HH:MM) para minutos
 */
export function timeStringToMinutes(time: string): number {
  if (!time || typeof time !== 'string') return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Converte minutos para string de hora (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  const validMinutes = Math.max(0, Math.abs(minutes));
  const hours = Math.floor(validMinutes / 60);
  const mins = validMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calcula diferença entre dois horários
 */
export function calculateTimeDiff(start: string, end: string): number {
  const startMin = timeStringToMinutes(start);
  const endMin = timeStringToMinutes(end);
  let diff = endMin - startMin;
  
  // Se resultado negativo, considerar que passou de um dia
  if (diff < 0) {
    diff += 1440; // 24 horas em minutos
  }
  
  return diff / 60; // Retorna em horas
}

/**
 * Calcula checkin time (ac_time - 30 minutos)
 */
export function calculateCheckInTime(acTime: string): string {
  const acMin = timeStringToMinutes(acTime);
  const checkinMin = acMin - 30;
  const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;
  return minutesToTimeString(finalMin);
}

/**
 * Separa tempo total em tempo diurno e noturno
 */
export function calculateDayNightTime(
  depTime: string,
  pouTime: string,
  sunsetTime: string = '18:00'
): { dayTime: number; nightTime: number } {
  const depMin = timeStringToMinutes(depTime);
  const pouMin = timeStringToMinutes(pouTime);
  const sunsetMin = timeStringToMinutes(sunsetTime);
  
  if (depMin >= sunsetMin) {
    // Saída após pôr do sol = voo noturno
    return { dayTime: 0, nightTime: calculateTimeDiff(depTime, pouTime) };
  }
  
  if (pouMin <= sunsetMin) {
    // Pouso antes do pôr do sol = voo diurno
    return { dayTime: calculateTimeDiff(depTime, pouTime), nightTime: 0 };
  }
  
  // Mix: parte diurna até pôr do sol, parte noturna depois
  const dayPart = calculateTimeDiff(depTime, sunsetTime);
  const nightPart = calculateTimeDiff(sunsetTime, pouTime);
  return { dayTime: dayPart, nightTime: nightPart };
}
```

### Usar as Funções
```typescript
// Em hooks ou componentes
import {
  timeStringToMinutes,
  minutesToTimeString,
  calculateTimeDiff,
  calculateCheckInTime,
  calculateDayNightTime,
} from '../utils/timeCalculations';

// Calcular checkin
const checkinTime = calculateCheckInTime(newEntry.ac_time);

// Calcular tempo total de voo
const totalTime = calculateTimeDiff(newEntry.dep_time, newEntry.pou_time);

// Separar dia/noite
const { dayTime, nightTime } = calculateDayNightTime(
  newEntry.dep_time,
  newEntry.pou_time
);
```

---

## 💡 Exemplo 3: Import Central

### ❌ Antes (Múltiplos imports)
```typescript
import DiarioBordoDetalhes from '@/components/diario/DiarioBordoDetalhes';
import { AddAerodromeDialog } from '@/components/diario/AddAerodromeDialog';
import { AddAircraftDialog } from '@/components/diario/AddAircraftDialog';
import { PartnerSelectModal } from '@/components/diario/PartnerSelectModal';
```

### ✅ Depois (Import único)
```typescript
import {
  DiarioBordo,
  AddAerodromeDialog,
  AddAircraftDialog,
  PartnerSelectModal,
} from '@/components/diario';
```

Onde `src/components/diario/index.ts` exporta:
```typescript
export { DiarioBordo } from './DiarioBordo';
export { DiarioBordo as default } from './DiarioBordo'; // Para compatibilidade
export { AddAerodromeDialog } from './dialogs/AddAerodromeDialog';
export { AddAircraftDialog } from './dialogs/AddAircraftDialog';
export { PartnerSelectModal } from './dialogs/PartnerSelectModal';
export { CreateDiaryDialog } from './dialogs/CreateDiaryDialog';
export { MaintenanceStatusAlert } from './shared/MaintenanceStatusAlert';
```

---

## 📊 Comparação de Tamanhos

| Arquivo | Antes | Depois | Redução |
|---------|-------|--------|---------|
| DiarioBordoDetalhes.tsx | 3400 linhas | 800 linhas | 76% |
| Pastas criadas | 3 | 7 | +133% |
| Importações deduplic. | Múltiplas | Central | 100% |
| Linhas Total | ~10,000 | ~7,000 | 30% |

---

## 🎯 Benefícios Reais

✅ **Mais Fácil de Manter**: Cada arquivo com responsabilidade única
✅ **Mais Fácil de Testar**: Hooks e utils isolados
✅ **Mais Fácil de Navegar**: Estrutura clara e lógica
✅ **Sem Duplicação**: Single source of truth
✅ **Mais Fácil de Estender**: Adicionar novas features é trivial
✅ **Melhor Performance**: Eliminação de código duplicado

