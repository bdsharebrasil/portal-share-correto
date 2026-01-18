# Integração: DynamicLogbookForm + useFlightCalculations

Exemplo de como integrar o hook `useFlightCalculations` ao `DynamicLogbookForm` para cálculos automáticos no backend.

## Arquitetura

```
┌─────────────────────────────────────┐
│   DynamicLogbookForm.tsx            │
│   (Frontend - Formulário)           │
└────────────┬────────────────────────┘
             │
             │ 1. User selects arrival airport
             │ 2. onBlur trigger
             ▼
┌─────────────────────────────────────┐
│   useFlightCalculations hook        │
│   (Frontend - Lógica)               │
└────────────┬────────────────────────┘
             │
             │ POST /api/flight-calculations
             ▼
┌─────────────────────────────────────┐
│   API /api/flight-calculations      │
│   (Backend - Express)               │
└────────────┬────────────────────────┘
             │
             │ Query Supabase for aerodromes
             ▼
┌─────────────────────────────────────┐
│   Supabase (aerodromes table)       │
│   Get coordinates & calculate       │
└─────────────────────────────────────┘
```

---

## Como Usar

### 1. Importar o Hook no Componente

```typescript
import { useFlightCalculations } from '@/hooks/useFlightCalculations';
import { DynamicLogbookForm } from './DynamicLogbookForm';
```

### 2. Usar o Hook Dentro do Componente

```typescript
export function MyLogbookForm() {
  const { formData, updateFields } = useLogbookForm(aerodromes);
  const { calculating, result, calculateFlightMetrics } = useFlightCalculations();

  // Quando o usuário seleciona o aeroporto de chegada
  const handleArrivalSelect = async (arrivalIcao: string) => {
    updateFields({ arrival_airport: arrivalIcao });

    // Chamada automática ao backend
    if (formData.departure_airport && formData.entry_date && formData.cor_time) {
      const calculationResult = await calculateFlightMetrics(
        formData.departure_airport,
        arrivalIcao,
        null, // sem destino manual
        formData.entry_date,
        formData.cor_time
      );

      if (calculationResult) {
        // Atualizar campos com resultados
        updateFields({
          distance_nm: calculationResult.distance.nm.toString(),
          night_time_hours: calculationResult.nightTime.hours.toString(),
          night_time_minutes: calculationResult.nightTime.minutes.toString(),
        });
      }
    }
  };

  return (
    <div>
      {/* Seu formulário aqui */}
      {calculating && <p>Calculando métricas...</p>}
      {result && <p>Distância: {result.distance.nm} NM</p>}
    </div>
  );
}
```

---

## Padrões de Integração

### Padrão 1: Cálculo ao Selecionar Destino (Recomendado)

```typescript
// Quando o usuario sai do campo de destino (onBlur)
const handleArrivalBlur = async () => {
  if (!formData.arrival_airport) return;

  // Validar dados necessários
  if (!formData.departure_airport || !formData.entry_date || !formData.cor_time) {
    toast({
      title: 'Aviso',
      description: 'Preencha partida, data e COR primeiro.',
    });
    return;
  }

  // Chamar API
  await calculateFlightMetrics(
    formData.departure_airport,
    formData.arrival_airport,
    null,
    formData.entry_date,
    formData.cor_time
  );
};
```

### Padrão 2: Cálculo Manual com Botão

```typescript
const handleCalculateManual = async () => {
  await calculateFlightMetrics(
    formData.departure_airport,
    formData.arrival_airport,
    null,
    formData.entry_date,
    formData.cor_time
  );
};

return (
  <Button onClick={handleCalculateManual} disabled={calculating}>
    {calculating ? 'Calculando...' : 'Atualizar Cálculos'}
  </Button>
);
```

### Padrão 3: Entrada Manual de Coordenadas

```typescript
// Se o usuário digitar um local que não existe
const handleManualCoordinates = async (lat: number, lng: number, nome: string) => {
  await calculateFlightMetrics(
    formData.departure_airport,
    null, // sem ICAO
    { lat, lng, nome }, // coordenadas manuais
    formData.entry_date,
    formData.cor_time
  );
};
```

---

## Estrutura de Resultado

```typescript
interface CalculationResult {
  distance: {
    nm: number;    // Milhas náuticas
    km: number;    // Quilômetros
  };
  nightTime: {
    hours: number;      // Horas inteiras
    minutes: number;    // Minutos
    decimal: number;    // Formato decimal (ex: 1.38)
  };
  solarTimes: {
    sunrise: { time: string; minutes: number };
    sunset: { time: string; minutes: number };
    dawn: { time: string; minutes: number };
    dusk: { time: string; minutes: number };
  };
  flight: {
    departure: { icao: string; name: string };
    arrival: { icao: string; name: string };
    date: string;
    landingTime: string;
    isNightFlightAtLanding: boolean;
  };
}
```

---

## Exemplo Completo de Integração

### Arquivo: src/components/diario/DynamicLogbookFormIntegrated.tsx

```typescript
import { useFlightCalculations } from '@/hooks/useFlightCalculations';
import { useLogbookForm } from '@/hooks/useLogbookForm';
import { DynamicLogbookForm } from './DynamicLogbookForm';
import { Button } from '@/components/ui/button';

export function DynamicLogbookFormIntegrated({
  open,
  onOpenChange,
  aircraftId,
  logbookMonthId,
  prefilledDate,
  onSuccess,
  aerodromes,
}: Props) {
  const { formData, updateFields } = useLogbookForm(aerodromes);
  const { calculating, result, calculateFlightMetrics } = useFlightCalculations();

  // Disparar cálculo quando o destino é alterado
  const handleArrivalAirportChange = async (newArrival: string) => {
    updateFields({ arrival_airport: newArrival });

    // Aguardar um pouco para garantir que os dados estão atualizados
    await new Promise(resolve => setTimeout(resolve, 100));

    // Chamar API se temos dados suficientes
    if (
      formData.departure_airport &&
      newArrival &&
      formData.entry_date &&
      formData.cor_time
    ) {
      const result = await calculateFlightMetrics(
        formData.departure_airport,
        newArrival,
        null,
        formData.entry_date,
        formData.cor_time
      );

      if (result) {
        // Atualizar formulário com resultados
        updateFields({
          distance_nm: result.distance.nm.toString(),
          night_time_hours: result.nightTime.hours.toString(),
          night_time_minutes: result.nightTime.minutes.toString(),
        });
      }
    }
  };

  return (
    <>
      <DynamicLogbookForm
        open={open}
        onOpenChange={onOpenChange}
        aircraftId={aircraftId}
        logbookMonthId={logbookMonthId}
        prefilledDate={prefilledDate}
        onSuccess={onSuccess}
        onArrivalChange={handleArrivalAirportChange}
        calculating={calculating}
      />

      {calculating && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg">
            <p>Calculando métricas do voo...</p>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## Performance & Considerações

### ✅ Boas Práticas

- **Debounce:** Adicionar debounce de 500ms antes de chamar a API
- **Cache:** O backend cacheia aerodromes por 24h
- **Validação:** Validar dados no cliente antes de chamar a API
- **Feedback:** Mostrar indicador de carregamento ao usuário

### ❌ Evitar

- Chamar API a cada keystroke
- Chamar API sem validar dados obrigatórios
- Sobrescrever valores calculados manualmente sem avisar

### Exemplo com Debounce

```typescript
import { useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

const debouncedCalculate = useDebounce(
  async (arrival: string) => {
    await calculateFlightMetrics(
      formData.departure_airport,
      arrival,
      null,
      formData.entry_date,
      formData.cor_time
    );
  },
  500 // 500ms delay
);

const handleArrivalChange = (arrival: string) => {
  updateFields({ arrival_airport: arrival });
  debouncedCalculate(arrival);
};
```

---

## Testes

### Teste 1: Cálculo Básico

```typescript
// Input
{
  departureIcao: "SBGR",
  arrivalIcao: "SBBR",
  flightDate: "2024-01-15",
  landingTime: "14:30"
}

// Expected: Distance ~645 NM, Night time depends on date
```

### Teste 2: Destino Manual

```typescript
// Input
{
  departureIcao: "SBGR",
  arrivalManual: { lat: -15.7894, lng: -48.0272, nome: "Manual Location" },
  flightDate: "2024-01-15",
  landingTime: "22:00"
}

// Expected: Custom calculation with provided coordinates
```

### Teste 3: Validação

```typescript
// Invalid date format should return error
{
  departureIcao: "SBGR",
  arrivalIcao: "SBBR",
  flightDate: "15/01/2024", // Invalid
  landingTime: "14:30"
}

// Expected: 400 - Bad Request
```

---

## Troubleshooting

### Erro: "Departure aerodrome not found"

- Verificar se o código ICAO está correto
- Verificar se o banco de dados tem o aeródromo cadastrado
- Use `/api/aerodromes` para listar aeródromos disponíveis

### Erro: "Invalid coordinates format"

- Formato esperado: `"23°30'15.5\"S,45°15'30.2\"W"`
- Verificar coordenadas no banco com `/api/aerodromes/details`

### Cálculos estão errados

- Validar se as coordenadas estão em DMS correto
- Verificar zona horária (API trabalha em UTC)
- Regra ANAC: Noturno apenas após dusk (final do crepúsculo)

---

## Próximos Passos

1. ✅ Criar rotas API (`/api/flight-calculations`)
2. ✅ Criar hook (`useFlightCalculations`)
3. ⏳ Integrar ao `DynamicLogbookForm`
4. ⏳ Adicionar UI para entrada manual de coordenadas
5. ⏳ Adicionar suporte a debounce
6. ⏳ Criar testes de integração
