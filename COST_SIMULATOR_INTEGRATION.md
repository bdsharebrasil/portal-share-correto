# Integração do Simulador de Custos de Aeronaves

## Visão Geral

O **Simulador de Custos de Aeronaves** foi integrado ao Dashboard Gestor do Portal Share Brasil. Este componente permite que gestores calculem custos operacionais de aeronaves com base em dados em tempo real do Supabase e APIs externas.

## Localização do Componente

- **Arquivo Principal**: `src/components/dashboard/CostSimulator/CostSimulator.tsx`
- **Índice de Exportação**: `src/components/dashboard/CostSimulator/index.ts`
- **Rota de Acesso**: `/gestor/simulador-custos`

## Funcionalidades Implementadas

### 1. Integração com Supabase

O simulador busca dados em tempo real de três tabelas principais:

#### a) **Aerodromes** (Aerodromes)
- Busca lista completa de aerodromes cadastrados
- Permite seleção de origem e destino
- Exibe ICAO e nome do aeródromo

```typescript
const { data: aerodromes = [] } = useQuery({
  queryKey: ['aerodromes'],
  queryFn: async () => {
    const { data } = await supabase
      .from('aerodromes')
      .select('id, icao, name, city')
      .order('name');
    return data || [];
  },
});
```

#### b) **Aeronaves** (Aeronave)
- Busca aeronaves ativas cadastradas no sistema
- Exibe matrícula e modelo
- Permite seleção para cálculo de custos específicos

```typescript
const { data: aircraft = [] } = useQuery({
  queryKey: ['aircraft-for-simulator'],
  queryFn: async () => {
    const { data } = await supabase
      .from('aeronave')
      .select('id, matricula, modelo, fabricante')
      .eq('status', 'ativo')
      .order('matricula');
    return data || [];
  },
});
```

#### c) **Abastecimentos** (Abastecimentos)
- Busca histórico de abastecimentos por aeronave
- Calcula média de combustível por hora de voo
- Atualiza automaticamente o campo de combustível quando aeronave é selecionada

```typescript
const { data: fuelAverage = 0 } = useQuery({
  queryKey: ['fuel-average', formData.aircraftId],
  queryFn: async () => {
    if (!formData.aircraftId) return 0;
    
    const { data } = await supabase
      .from('abastecimentos')
      .select('litros, horas_voo')
      .eq('aeronave_id', formData.aircraftId)
      .not('horas_voo', 'is', null)
      .not('litros', 'is', null);
    
    if (!data || data.length === 0) return 0;
    
    const totalLitros = data.reduce((sum, item) => sum + (item.litros || 0), 0);
    const totalHoras = data.reduce((sum, item) => sum + (item.horas_voo || 0), 0);
    
    return totalHoras > 0 ? totalLitros / totalHoras : 0;
  },
  enabled: !!formData.aircraftId,
});
```

### 2. Estrutura de Custos

O simulador organiza os custos em três períodos:

#### **Curto Prazo (0-29 dias)**
- Combustível
- Diárias de piloto
- Hotel e alimentação
- Taxas de pouso
- Hangaragem fora da base

#### **Médio Prazo (30 dias - 1 ano)**
- Hangaragem fixa
- Salário de tripulação
- Atualizações de navegação
- Manutenção preventiva
- Manutenção por hora de voo
- Seguros
- Taxas de rádio/ANAC
- Treinamento e exames
- Outros custos

#### **Longo Prazo (até 10 anos)**
- Revisão geral de motor
- Revisão de hélices
- Revisão de magnetos
- Revisão de turbos
- Revisão de alternadores
- Manutenção a cada 6 anos

### 3. Cálculos Automáticos

O simulador calcula automaticamente:

- **Custo Total**: Soma de todos os períodos
- **Taxa Horária**: Custo total dividido pelas horas de voo mensais
- **Distribuição Percentual**: Proporção de cada período no custo total

### 4. Visualizações

#### a) **Cards de Resumo**
- Exibe custos de cada período com cores distintas
- Mostra custo total e taxa horária
- Indicadores visuais com ícones

#### b) **Gráfico de Pizza**
- Distribuição visual dos custos por período
- Exibe valores em reais ao passar o mouse

#### c) **Gráfico de Barras**
- Comparação de custos entre os três períodos
- Facilita identificação de períodos mais custosos

#### d) **Resumo Detalhado**
- Breakdown de cada componente de custo
- Organizado por período
- Valores em tempo real

## Integração com o Dashboard Gestor

### Adição do Ícone de Navegação

O simulador foi adicionado como uma ferramenta rápida no GestorDashboard:

```typescript
{
  icon: DollarSign,
  label: "Simulador de Custos",
  route: "/gestor/simulador-custos",
  iconColor: "text-orange-400",
  iconBg: "bg-orange-500/10",
  hoverGlow: "hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
  grid: 1
}
```

### Rota Protegida

A rota está protegida por autenticação e controle de roles:

```typescript
<Route path="/gestor/simulador-custos" element={
  renderProtected(
    <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
      <Layout>
        <CostSimulator />
      </Layout>
    </RoleProtected>
  )
} />
```

## APIs Externas Integradas

### 1. DECEA (Defesa Aérea)
- **Endpoint**: `api.share-brasil.com/api/weather/:icao`
- **Uso**: Obter METAR e TAF para aerodromes
- **Status**: Pronto para integração futura

### 2. Share Brasil
- **Base URL**: `api.share-brasil.com`
- **Endpoints Disponíveis**:
  - `/api/weather/:icao` - Dados meteorológicos
  - `/api/notam/:icao` - NOTAMs
  - `/api/charts/:icao` - Cartas de navegação
  - `/api/rotaer` - Rotas ATS
  - `/api/routes` - Rotas específicas
  - `/api/solar/:icao` - Dados de nascer/pôr do sol
  - `/api/flight-calculations` - Cálculos de voo

## Estrutura de Dados

### Interface FormData

```typescript
interface FormData {
  aircraftId: string;
  aircraftName: string;
  hoursPerYear: number;
  numberOfShares: number;
  originId: string;
  destinationId: string;
  flightTimeRoundTrip: number;
  journeyDays: number;
  monthlyFlights: number;
  
  // Curto Prazo
  fuelCost: number;
  fuelPerHour: number;
  fuelHours: number;
  pilotDailyRate: number;
  hotelMealCost: number;
  hotelMealDays: number;
  landingTaxes: number;
  hangarageOutside: number;
  hangarageOutsideDays: number;
  
  // Médio Prazo
  fixedHangarage: number;
  crewSalary: number;
  navigationUpdates: number;
  preventiveMaintenance: number;
  maintenancePerHour: number;
  insurance: number;
  radioTaxes: number;
  trainingExams: number;
  otherCosts: number;
  
  // Longo Prazo
  engineOverhaul: number;
  propellerOverhaul: number;
  magnetoOverhaul: number;
  turboOverhaul: number;
  alternatorOverhaul: number;
  sixYearMaintenance: number;
}
```

### Interface CostData

```typescript
interface CostData {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  total: number;
  hourlyRate: number;
}
```

## Dependências

O componente utiliza as seguintes bibliotecas:

- `@tanstack/react-query` - Gerenciamento de estado e cache
- `@supabase/supabase-js` - Cliente Supabase
- `recharts` - Visualizações gráficas
- `lucide-react` - Ícones
- `react-router-dom` - Roteamento
- Componentes UI do shadcn/ui

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    CostSimulator Component                   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Supabase │  │ Supabase │  │ Supabase │
         │Aerodromes│  │ Aircraft │  │Abastec.  │
         └──────────┘  └──────────┘  └──────────┘
                │             │             │
                └─────────────┼─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  FormData State  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Cost Calculations│
                    │    (useMemo)     │
                    └──────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
            ┌────────┐   ┌────────┐   ┌────────┐
            │ Cards  │   │ Charts │   │ Summary│
            └────────┘   └────────┘   └────────┘
```

## Próximas Implementações

### 1. Integração com APIs de Clima
- Buscar dados meteorológicos em tempo real
- Alertas de condições adversas

### 2. Exportação de Relatórios
- Gerar PDF com análise de custos
- Exportar para Excel

### 3. Comparação de Cenários
- Salvar múltiplos cenários
- Comparar lado a lado

### 4. Histórico de Cálculos
- Armazenar cálculos anteriores
- Rastreabilidade de mudanças

### 5. Integração com Plano de Voo
- Buscar dados de voos agendados
- Calcular custos automaticamente

## Troubleshooting

### Problema: Aerodromes não carregam
**Solução**: Verificar se a tabela `aerodromes` existe no Supabase e se o usuário tem permissão de leitura.

### Problema: Combustível não atualiza
**Solução**: Verificar se a tabela `abastecimentos` tem registros com `horas_voo` preenchido para a aeronave selecionada.

### Problema: Gráficos não aparecem
**Solução**: Verificar se a biblioteca `recharts` está instalada corretamente.

## Contato e Suporte

Para dúvidas ou sugestões sobre o Simulador de Custos, entre em contato com a equipe de desenvolvimento do Portal Share Brasil.
