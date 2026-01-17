# Integração AVWX com METAR Offline

## Visão Geral

A aplicação agora integra dados de METAR (condições meteorológicas) da API AVWX, com suporte robusto para modo offline.

## Componentes Implementados

### 1. **Hook `useAviationWeather`** (`src/hooks/useAviationWeather.ts`)
- Consome endpoint `/metar/{ICAO}` da AVWX
- Cache automático de 10 minutos
- Fallback automático para dados mock quando API falha
- Carregamento periódico (polling) configurável

**Uso:**
```typescript
const { metar, loading, error } = useAviationWeather('SBGR');

// metar contém:
// - temp, dewp, wdir, wspd, wgst
// - visib, altim, rawOb
// - flightCategory (VFR/MVFR/IFR/LIFR)
// - source ('AVWX' ou 'FALLBACK')
```

### 2. **Mock Data Offline** (`src/data/metarMockData.ts`)
- Base de dados com METAR realista para principais aeródromos brasileiros
- Gerador de dados aleatórios realistas para aeródromos desconhecidos
- Simulação de diferentes condições meteorológicas

**Funções disponíveis:**
```typescript
// Obter mock para ICAO (busca na base, se não encontrar gera aleatório)
getMockMETAR('SBGR');

// Gerar condição específica
generateConditionMETAR('vfr', 'SBGR');
generateConditionMETAR('ifr', 'SBRJ');
```

### 3. **Serviço de Rota AVWX** (`src/services/avwxRouteService.ts`)
- Consome endpoint `/station/{ICAO}` para obter coordenadas de waypoints
- Processa rotas em formato AVWX (ex: "SBGR RJOI RJOJ SBDI")
- Calcula distância, bearing e tempo estimado para cada segmento
- Inclua mock para desenvolvimento offline

**Uso:**
```typescript
// Obter rota processada
const route = await getAvwxRoute('SBGR', 'SBDI', 'SBGR RJOI SBDI');

// Resultado contém:
// - waypoints: { name, lat, lon }[]
// - segments: { from, to, distance, bearing, duration }[]
// - totalDistance, estimatedDuration
```

### 4. **Hook `useAvwxRoute`** (`src/hooks/useAvwxRoute.ts`)
- Wrapper React para `getAvwxRoute`
- Estado de carregamento e erro
- Flag `isOffline` quando usa mock data
- Atualização automática com mudanças de parâmetros

**Uso:**
```typescript
const { route, loading, error, isOffline } = useAvwxRoute({
  departure: 'SBGR',
  destination: 'SBDI',
  routeString: 'SBGR RJOI SBDI',
  enabled: true,
});
```

### 5. **Componente `RouteMetarPanel`** (`src/components/plano-voo/RouteMetarPanel.tsx`)
- Exibe METAR para cada waypoint da rota
- Cards expansíveis com informações meteorológicas
- Indicador de dados offline
- Scroll e layout responsivo

### 6. **Integração no Mapa** (`src/components/plano-voo/FlightPlanMap.tsx`)
- Novo botão "METAR Rota" para toggle do painel
- Carregamento automático da rota AVWX
- Exibição lado-a-lado com cards METAR de origem/destino
- Fallback automático para mock quando API indisponível

## Fluxo de Dados

```
PlanoVoo.tsx (formulário)
    ↓
    → passa routeString ao FlightPlanMap
    ↓
FlightPlanMap.tsx
    ↓
    → useAvwxRoute() carrega rota
    ↓
    → RouteMetarPanel exibe METAR de cada waypoint
    ↓
    → useAviationWeather() para cada ICAO
    ↓
    → Fallback para getMockMETAR() se API falhar
```

## Variáveis de Ambiente

```env
# Token AVWX (salvo em .env.local)
VITE_AVWX_API_TOKEN=IGDECkARkbEWn3NP6Xs9GlFl8LyuFkeCY7dqJcmBfsU
```

## Funcionalidades

### ✅ METAR em Tempo Real
- Busca automática via AVWX API
- Categorias de voo: VFR, MVFR, IFR, LIFR
- Indicadores visuais de condições

### ✅ Modo Offline
- Mock data realista para ~10 aeródromos brasileiros
- Geração inteligente para aeródromos desconhecidos
- Indicador visual de dados offline

### ✅ Rota Otimizada
- Processamento de waypoints da rota
- Cálculo automático de distância e bearing
- Tempo estimado de voo

### ✅ Interface Responsiva
- Painel expansível/colapsável
- Scroll para múltiplos waypoints
- Integrado ao controle de camadas IFR

## Exemplo de Uso Completo

```typescript
// 1. Usuário preenche formulário:
// Origem: SBGR
// Destino: SBDI  
// Rota: SBGR RJOI SBDI

// 2. Submete o formulário
// Dados passados para FlightPlanMap com routeString

// 3. Em PlanoVoo.tsx:
{
  route: 'SBGR RJOI SBDI',
  departureAirport: 'SBGR',
  destinationAirport: 'SBDI',
  // ... outros dados
}

// 4. FlightPlanMap.tsx:
// - Carrega rota via useAvwxRoute
// - Exibe botão "METAR Rota"
// - Ao clicar, mostra RouteMetarPanel
// - Para cada waypoint, busca METAR via useAviationWeather

// 5. Resultado na tela:
// - Mapa com rota visual
// - Painel com METAR para cada waypoint
// - Indicadores de condição (VFR/MVFR/IFR/LIFR)
// - Dados offline destacados
```

## Tratamento de Erros

### API Indisponível
1. AVWX retorna erro HTTP
2. Sistema automaticamente usa `getMockMETAR()`
3. Card mostra aviso "Dados em modo offline"
4. Usuário continua planejando com dados realistas

### Waypoint Não Encontrado
1. `getWaypointCoordinates()` retorna null
2. Waypoint é pulado da rota
3. Aviso no console para debug
4. Rota continua com waypoints válidos

### Token Não Configurado
1. Hook detecta `VITE_AVWX_API_TOKEN` vazio
2. Lança erro "AVWX token não configurado"
3. Fallback automático para mock data

## Testes Sugeridos

### Teste Online (API disponível)
```bash
# Com token AVWX configurado:
# 1. Abrir "Plano de Voo"
# 2. Preencher: SBGR → SBDI
# 3. Clicar "METAR Rota"
# 4. Verificar cards com dados em tempo real
# 5. Verificar source = 'AVWX'
```

### Teste Offline (API indisponível)
```bash
# Desligar internet ou simular erro:
# 1. Chrome DevTools → Network → "Offline"
# 2. Repetir teste online
# 3. Sistema deve mostrar mock data
# 4. Verificar source = 'FALLBACK'
# 5. Avisos "Dados em modo offline"
```

### Teste de Cache
```bash
# Com internet ligada:
# 1. Carregar METAR do aeródromo A
# 2. Aguardar < 10 minutos
# 3. Carregar mesmo aeródromo B (sem chamar API)
# 4. Sinalizar cache hit no console
```

## Próximas Melhorias

- [ ] Integração com TAF (Forecast de Vento)
- [ ] Histórico de METAR
- [ ] Gráficos de condições ao longo da rota
- [ ] Avisos automáticos de condições severas
- [ ] Integração com SigMets
- [ ] Suporte a alternatas com METAR

## Referências

- AVWX API: https://avwx.rest/api/docs
- METAR Explanation: https://www.weather.gov/media/epz/metar/metar_explanation.pdf
- Flight Categories: https://www.aviationweather.gov/adds/
