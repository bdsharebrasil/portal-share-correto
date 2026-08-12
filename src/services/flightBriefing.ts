// @ts-nocheck
/**
 * services/flightBriefing.ts
 *
 * Gera o briefing de voo localmente, sem depender de AI Workers.
 * Recebe a resposta estruturada de /api/flightplan e produz texto formatado.
 */

// ─── Types — alinhados com o shape retornado pelo /api/flightplan ─────────────

export interface FlightPlanResponse {
  flightplan: {
    adep:           string
    ades:           string
    route:          string
    distance_nm:    number
    estimated_time: string
    flight_minutes: number
    cruise_speed:   number
  }
  fuel: {
    burn_lh:        number
    trip_liters:    number
    reserve_liters: number
    taxi_liters:    number
    total_required: number
    reserve_min:    number
  }
  departure: {
    icao: string
    name: string
    lat:  number
    lon:  number
  }
  destination: {
    icao: string
    name: string
    lat:  number
    lon:  number
  }
  alternates: Array<{
    icao:        string
    name:        string
    distance_km: number
  }>
  notam_alerts: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatUtcNow(): string {
  const d = new Date()
  return `${d.getUTCDate().toString().padStart(2, '0')}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`
}

function fuelWarning(totalLiters: number, burnPerHour: number): string {
  const hoursAvailable = totalLiters / burnPerHour
  if (hoursAvailable < 1)   return '⚠️  ATENÇÃO: Combustível abaixo de 1 hora total.'
  if (hoursAvailable < 1.5) return '⚡ Margem de combustível apertada — verifique alternados.'
  return '✅ Combustível dentro dos parâmetros normais.'
}

function notamSummary(alerts: string[]): string {
  if (!alerts.length) return 'Nenhum NOTAM crítico identificado.'
  return alerts
    .slice(0, 5)
    .map((n, i) => `  ${i + 1}. ${n.trim().substring(0, 120)}${n.length > 120 ? '...' : ''}`)
    .join('\n')
}

function alternatesSummary(alternates: FlightPlanResponse['alternates']): string {
  if (!alternates.length) return 'Nenhum alternado identificado na faixa de 150 km.'
  return alternates
    .map(a => `  • ${a.icao} — ${a.name} (${a.distance_km} km)`)
    .join('\n')
}

// ─── Gerador principal ────────────────────────────────────────────────────────

/**
 * Gera um briefing de despacho formatado a partir da resposta de /api/flightplan.
 * Puro TypeScript — sem chamadas de rede, sem IA externa.
 */
export function generateFlightBriefing(plan: FlightPlanResponse): string {
  const { flightplan: fp, fuel, departure: dep, destination: dest, alternates, notam_alerts } = plan

  const distKm    = Math.round(fp.distance_nm * 1.852)
  const fuelWarn  = fuelWarning(fuel.total_required, fuel.burn_lh)
  const notamTxt  = notamSummary(notam_alerts)
  const altTxt    = alternatesSummary(alternates)
  const timestamp = formatUtcNow()

  return `
╔══════════════════════════════════════════════════════╗
║           BRIEFING DE DESPACHO — SHAREBRASIL         ║
╚══════════════════════════════════════════════════════╝
Emitido em: ${timestamp}

▶ ROTA
  Origem  : ${dep.icao} — ${dep.nome}
  Destino : ${dest.icao} — ${dest.nome}
  Rota ATC: ${fp.route}
  Distância: ${fp.distance_nm} NM / ${distKm} km

▶ PERFORMANCE
  Velocidade de cruzeiro : ${fp.cruise_speed} KT
  Tempo estimado de voo  : ${fp.estimated_time}

▶ COMBUSTÍVEL (litros)
  Táxi    : ${fuel.taxi_liters} L
  Viagem  : ${fuel.trip_liters} L
  Reserva : ${fuel.reserve_liters} L (${fuel.reserve_min} min)
  ─────────────────────────
  TOTAL   : ${fuel.total_required} L
  ${fuelWarn}

▶ ALTERNADOS (destino)
${altTxt}

▶ NOTAMs ATIVOS
${notamTxt}

▶ OBSERVAÇÕES
  • Confirme METAR/TAF antes da partida.
  • Verifique restrições de espaço aéreo na rota.
  • Mantenha reserva mínima de ${fuel.reserve_min} min conforme RBAC 91.

══════════════════════════════════════════════════════
  Gerado automaticamente — não substitui o despacho
  oficial. Consulte o DTCEA/REDEMET para dados atuais.
══════════════════════════════════════════════════════
`.trim()
}

/**
 * Versão resumida do briefing para exibição em cards/tooltips.
 */
export function generateBriefingSummary(plan: FlightPlanResponse): string {
  const { flightplan: fp, fuel, notam_alerts, alternates } = plan
  const parts: string[] = [
    `${fp.adep} → ${fp.ades} | ${fp.distance_nm} NM | ${fp.estimated_time}`,
    `Combustível total: ${fuel.total_required} L (reserva ${fuel.reserve_min} min)`,
  ]
  if (notam_alerts.length) parts.push(`NOTAMs ativos: ${notam_alerts.length}`)
  if (alternates.length)   parts.push(`Alternado sugerido: ${alternates[0].icao} (${alternates[0].distance_km} km)`)
  return parts.join(' • ')
}
