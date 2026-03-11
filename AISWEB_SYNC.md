# 📡 AISWeb Frontend-Backend Synchronization

## ✅ Mudanças Implementadas

### 1. **Frontend - Config API** (`src/config/api.ts`)
✅ Adicionados endpoints faltando:
- `/api/charts/:icao` - Cartas aeronáuticas
- `/api/notam/:icao` - NOTAMs
- `/api/rotaer` - Rotas preferenciais

### 2. **Frontend - API Client** (`src/lib/api-client.ts`)
✅ Atualizado com:
- Importação de `API_ENDPOINTS` para URLs centralizadas
- `getWeather(icao)` - Busca METAR
- `getCharts(icao, especie?, tipo?)` - Cartas com filtros
- `getNotam(icao)` - NOTAMs
- `getPreferentialRoutes(adep, ades)` - Rotas
- `getFlightPlan(...)` - Plano de voo completo
- `getNearestAirport(lat, lon)` - Aeródromo mais próximo
- `getNearbyAlternates(lat, lon)` - Alternados

Todos com **cache IDB de 5 minutos**.

### 3. **Frontend - Hook** (`src/hooks/useAISWeb.ts`)
✅ Adicionados métodos:
- `getWeather(icao, forceRefresh?)` - Com cache inteligente
- `getCharts(icao, especie?, tipo?)` - Cartas
- `fetchAlternates()` - Corrigido para usar `getNearbyAlternates(lat, lon)`

Todos com proteção contra **race conditions** usando `inFlightRef`.

### 4. **Frontend - Service** (`src/services/aiswebWeather.ts`)
✅ Refatorado como **utilidade pura**:
- `parseMetarString()` - Parser de METAR raw
- `determineFlightCategory()` - Categoriza VFR/MVFR/IFR/LIFR
- `transformAISWebMETAR()` - Transform de dados brutos para estruturado
- **Removido fetch duplicado** (agora via `apiClient`)

### 5. **Backend** (`backend-updated.ts`)
✅ Adicionados 5 novos endpoints:
- `GET /api/weather/:icao` - METAR (cache 5 min)
- `GET /api/notam/:icao` - NOTAMs (cache 10 min)
- `GET /api/charts/:icao` - Cartas (cache 1h) ✨ NOVO
- `GET /api/rotaer` - Rotas preferenciais (cache 30 min)
- `GET /api/geiloc/nearby` - Alternados (cache 30 min)

---

## 🎯 Como Usar

### Buscar METAR
```typescript
const { getWeather } = useAISWeb();
const metar = await getWeather('SBSP'); // São Paulo
```

### Buscar Cartas
```typescript
const { getCharts } = useAISWeb();
const charts = await getCharts('SBSP', 'APP', 'PDF');
// especie: 'STR' (Aeródromo), 'APP' (Aproximação), 'IAC' (Procedimento)
// tipo: 'PDF', 'PNG'
```

### Buscar NOTAMs
```typescript
const { getNOTAMs } = useAISWeb();
const notams = await getNOTAMs('SBSP');
```

### Validar Plano de Voo
```typescript
const { validateFlightPlan } = useAISWeb();
const plan = await validateFlightPlan(
  'SBSP',  // origem
  'SBRJ',  // destino
  routePoints,
  5000,    // altitude
  32,      // burn por hora
  45       // reserve
);
```

---

## 🔄 Fluxo de Dados

```
[Frontend]
    ↓
useAISWeb Hook
    ↓
apiClient (com URL_ENDPOINTS)
    ↓
fetch() → Backend Workers
    ↓
[Backend: Cloudflare Worker]
    ↓
fetchAisweb() → AISWEB API
    ↓
cachedFetch() → Cache KV
    ↓
Response JSON
    ↓
[Frontend]
    ↓
IDB Cache (5-30 min)
    ↓
Componente
```

---

## ⚙️ Deployment Checklist

### ✅ Frontend
1. Atualizar `src/config/api.ts`
2. Atualizar `src/lib/api-client.ts`
3. Atualizar `src/hooks/useAISWeb.ts`
4. Refatorar `src/services/aiswebWeather.ts`

### ✅ Backend
1. Substituir código do Worker com `backend-updated.ts`
2. Certificar credenciais:
   - `AISWEB_API_KEY`
   - `AISWEB_API_PASS`
3. Certificar que `CACHE_KV` está configurada

---

## 🐛 Troubleshooting

### "Credenciais AISWEB ausentes"
→ Verificar variáveis de ambiente no Worker

### Cache muito antigo
→ Reduzir TTL nos endpoints (em segundos no Backend)
→ Reduzir `CACHE_TTL` no Frontend (em ms no apiClient)

### Erro na função `getNearbyAlternates()`
→ Certificar que coordenadas (lat, lon) são válidas
→ Endpoint `GET /api/geiloc/nearby` retorna `{ alternates: [] }`

---

## 📝 Resumo de URLs

| Recurso | Endpoint Frontend | Backend Route |
|---------|-------------------|---------------|
| METAR | `/weather/:icao` | `GET /api/weather/:icao` |
| NOTAMs | `/notam/:icao` | `GET /api/notam/:icao` |
| **Cartas** ✨ | `/charts/:icao` | `GET /api/charts/:icao` |
| Rotas | `/rotaer` | `GET /api/rotaer` |
| Alternados | `/geiloc/nearby` | `GET /api/geiloc/nearby` |
| Plano Completo | `/flightplan` | `GET /api/flightplan` |

---

Tudo sincronizado e pronto! 🚀
