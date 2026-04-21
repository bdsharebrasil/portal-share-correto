import { useState, useEffect, useCallback } from "react";
import { useAISWeb } from "@/hooks/useAISWeb";
import { transformAISWebMETAR } from "@/services/aiswebWeather";

// --- TIPAGEM ---
interface WxState {
  status: "idle" | "loading" | "ok" | "error";
  icao?: string;
  name?: string;
  raw?: string | null;
  temp?: number | null;
  wind?: string | null;
  cat?: string;
  time?: string;
  dewpoint?: number | null;
  pressure?: number | null;
  msg?: string;
}

// ─── FALLBACK de aeroportos ───────────────────────────────────────────────────
const AIRPORTS_BR = [
  { icao: "SBSP", name: "São Paulo Congonhas",         lat: -23.6150, lon: -46.4730 },
  { icao: "SBGR", name: "São Paulo Guarulhos",          lat: -23.4356, lon: -46.4731 },
  { icao: "SBKP", name: "Campinas Viracopos",           lat: -23.0074, lon: -47.1360 },
  { icao: "SBCY", name: "Cuiabá",                       lat: -15.6500, lon: -56.1170 },
  { icao: "SBBR", name: "Brasília",                     lat: -15.8711, lon: -47.9186 },
  { icao: "SBRJ", name: "Rio de Janeiro Santos Dumont", lat: -22.9068, lon: -43.1729 },
  { icao: "SBGL", name: "Rio de Janeiro Galeão",        lat: -22.8068, lon: -43.2437 },
  { icao: "SBCF", name: "Belo Horizonte",               lat: -19.8245, lon: -43.9493 },
  { icao: "SBCT", name: "Curitiba",                     lat: -25.5245, lon: -49.1761 },
  { icao: "SBPK", name: "Porto Alegre",                 lat: -29.3941, lon: -51.1557 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestFallback(lat: number, lon: number) {
  return AIRPORTS_BR.reduce((best: any, ap) => {
    const d = haversineKm(lat, lon, ap.lat, ap.lon);
    return d < best._d ? { ...ap, _d: d } : best;
  }, { _d: Infinity });
}

// ─── Extrai dewpoint e pressão do METAR bruto ─────────────────────────────────
function parseMETARExtras(raw: string | null | undefined) {
  if (!raw) return { dewpoint: null, pressure: null };

  // Temperatura/dewpoint: "23/18" ou "M05/M10"
  const tdMatch = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  let dewpoint: number | null = null;
  if (tdMatch) {
    const dp = tdMatch[2];
    dewpoint = dp.startsWith("M") ? -parseInt(dp.slice(1)) : parseInt(dp);
  }

  // QNH: "Q1013"
  const qMatch = raw.match(/\bQ(\d{4})\b/);
  const pressure: number | null = qMatch ? parseInt(qMatch[1]) : null;

  return { dewpoint, pressure };
}

// ─── Cores e rótulos por categoria de voo ─────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  VFR:  "#22c55e",
  MVFR: "#3b82f6",
  IFR:  "#ef4444",
  LIFR: "#a855f7",
  UNK:  "#6b7280",
};

const CAT_LABEL: Record<string, string> = {
  VFR:  "VFR — Condições visuais",
  MVFR: "MVFR — VFR marginal",
  IFR:  "IFR — Voo por instrumentos",
  LIFR: "LIFR — IFR baixo",
  UNK:  "Condições desconhecidas",
};

// ─── Ícone SVG do tempo (reutilizado do design original) ──────────────────────
const WeatherSvg = () => (
  <svg className="wcard-weather" width="80" height="80" viewBox="0 0 100 100">
    <image
      width="100" height="100" x="0" y="0"
      href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAMg0lEQVR42u2de5AcVb3HP7/unZ19Tt4vQsgGwpIABoREEVJqlFyLwgclEsmliFZULIWgqFHxlZKioBRKIVzBRwEmKUFQsQollhCzAW9xrzxKi/IiybVAgVjktdlkd3Z3errPzz+6Z3d2d2a3Z7bnsaF/VVvdc/qc032+nz3HP+cAAAAAAAAA..."
    />
  </svg>
);

// Ícone de vento
const IcoWind = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

// Ícone de termômetro (dewpoint)
const IcoDew = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 0-7 7c0 4.97 7 13 7 13s7-8.03 7-13a7 7 0 0 0-7-7z" />
  </svg>
);

// Ícone de pressão
const IcoPressure = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Ícone de ICAO / localização
const IcoPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Ícone de refresh
const IcoRefresh = ({ spin }: { spin: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spin ? "wcard-spin .9s linear infinite" : undefined }}
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ─── WIDGET PRINCIPAL ────────────────────────────────────────────────────────
export default function WeatherWidget() {
  const [wx, setWx] = useState<WxState>({ status: "idle" });
  const [spin, setSpin] = useState(false);
  const [showAirportSelector, setShowAirportSelector] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("selectedAirport") || null : null
  );

  const { getWeather } = useAISWeb();

  const requestLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    try {
      const pos: any = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 60000 })
      );
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch (err: any) {
      console.warn("[WeatherWidget] Geolocation:", err?.message || err);
      return null;
    }
  }, []);

  const setWxToUnknown = (airport: typeof AIRPORTS_BR[0]) => {
    setWx({
      status: "ok",
      icao: airport.icao,
      name: airport.name,
      raw: null,
      temp: null,
      wind: null,
      dewpoint: null,
      pressure: null,
      cat: "UNK",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const loadWeatherForAirport = useCallback(async (airport: typeof AIRPORTS_BR[0]) => {
    try {
      const wxData = await getWeather(airport.icao);
      if (!wxData) { setWxToUnknown(airport); return; }

      const metarData = transformAISWebMETAR(wxData, airport.icao);
      if (!metarData.rawOb) { setWxToUnknown(airport); return; }

      const { dewpoint, pressure } = parseMETARExtras(metarData.rawOb);

      setWx({
        status: "ok",
        icao: airport.icao,
        name: airport.name,
        raw: metarData.rawOb,
        temp: metarData.temp,
        wind: metarData.wspd
          ? `${metarData.wdir}°/${metarData.wspd}${metarData.wgst ? "G" + metarData.wgst : ""}kt`
          : null,
        cat: metarData.flightCategory,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        dewpoint,
        pressure,
      });
    } catch {
      setWxToUnknown(airport);
    }
  }, [getWeather]);

  const load = useCallback(async () => {
    setSpin(true);
    setWx({ status: "loading" });
    try {
      if (selectedAirport) {
        const airport = AIRPORTS_BR.find(a => a.icao === selectedAirport);
        if (airport) { await loadWeatherForAirport(airport); return; }
      }
      const coords = await requestLocation();
      if (coords) {
        await loadWeatherForAirport(nearestFallback(coords.lat, coords.lon));
      } else {
        setShowAirportSelector(true);
        setWx({ status: "idle" });
      }
    } catch {
      setWx(prev => prev.status === "idle" ? prev : { ...prev, status: "ok" });
    } finally {
      setSpin(false);
    }
  }, [selectedAirport, requestLocation, loadWeatherForAirport]);

  const handleSelectAirport = useCallback(async (airport: typeof AIRPORTS_BR[0]) => {
    setSelectedAirport(airport.icao);
    localStorage.setItem("selectedAirport", airport.icao);
    setShowAirportSelector(false);
    await loadWeatherForAirport(airport);
  }, [loadWeatherForAirport]);

  useEffect(() => {
    load();
    const t = setInterval(() => load().catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const color  = CAT_COLOR[wx.cat || "UNK"] ?? CAT_COLOR.UNK;
  const label  = CAT_LABEL[wx.cat || "UNK"] ?? CAT_LABEL.UNK;
  const isOk   = wx.status === "ok";

  return (
    <>
      <style>{CSS}</style>

      {/* Modal seletor de aeródromo */}
      {showAirportSelector && (
        <div className="wcard-overlay">
          <div className="wcard-modal">
            <div className="wcard-modal-icon">🛫</div>
            <h2 className="wcard-modal-title">Selecione seu aeródromo</h2>
            <div className="wcard-airport-grid">
              {AIRPORTS_BR.map(ap => (
                <button key={ap.icao} className="wcard-airport-btn" onClick={() => handleSelectAirport(ap)}>
                  <span className="wcard-airport-icao">{ap.icao}</span>
                  <span className="wcard-airport-name">{ap.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card principal */}
      <div className="wcard-root">

        {/* Card frente — temperatura principal */}
        <div className="wcard-front">
          <div className="wcard-front-top">
            <WeatherSvg />
            <div className="wcard-temp">
              {isOk ? (wx.temp != null ? `${wx.temp}°C` : "—°C") : "···"}
            </div>
          </div>
          <div className="wcard-location">
            {isOk ? (wx.name ?? wx.icao ?? "—") : "Carregando..."}
          </div>

          {/* Botão refresh canto superior direito */}
          <button className="wcard-refresh-btn" onClick={load} title="Atualizar">
            <IcoRefresh spin={spin} />
          </button>
        </div>

        {/* Card traseira — detalhes (desliza para baixo no hover) */}
        <div className="wcard-back">
          <div className="wcard-back-upper">
            {/* Dewpoint */}
            <div className="wcard-detail-item">
              <IcoDew />
              <div className="wcard-detail-text">
                <span className="wcard-detail-label">Dewpoint</span>
                <span className="wcard-detail-value">
                  {isOk && wx.dewpoint != null ? `${wx.dewpoint}°C` : "—"}
                </span>
              </div>
            </div>

            {/* Vento */}
            <div className="wcard-detail-item">
              <IcoWind />
              <div className="wcard-detail-text">
                <span className="wcard-detail-label">Vento</span>
                <span className="wcard-detail-value">
                  {isOk && wx.wind ? wx.wind : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="wcard-back-lower">
            {/* Pressão */}
            <div className="wcard-detail-item wcard-detail-sm">
              <IcoPressure />
              <div className="wcard-detail-text">
                <span className="wcard-detail-label">QNH</span>
                <span className="wcard-detail-value">
                  {isOk && wx.pressure != null ? `${wx.pressure} hPa` : "—"}
                </span>
              </div>
            </div>

            {/* ICAO */}
            <div className="wcard-detail-item wcard-detail-sm">
              <IcoPin />
              <div className="wcard-detail-text">
                <span className="wcard-detail-label">ICAO</span>
                <span className="wcard-detail-value">{isOk ? wx.icao : "—"}</span>
              </div>
            </div>

            {/* Hora */}
            <div className="wcard-detail-item wcard-detail-sm">
              <div className="wcard-detail-text">
                <span className="wcard-detail-label">Obs.</span>
                <span className="wcard-detail-value">{isOk ? wx.time : "—"}</span>
              </div>
            </div>
          </div>

          {/* Barra de categoria de voo */}
          <div className="wcard-cat-bar" style={{ background: color }}>
            {isOk ? label : "Aguardando dados"}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes wcard-spin    { to { transform: rotate(360deg); } }
  @keyframes wcard-fade-in { from { opacity:0; } to { opacity:1; } }
  @keyframes wcard-slide   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes wcard-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

  /* ── Wrapper ── */
  .wcard-root {
    position: relative;
    width: 220px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
  }

  /* ── Card frente ── */
  .wcard-front {
    position: relative;
    width: 220px;
    height: 120px;
    border-radius: 22px;
    background: whitesmoke;
    color: #111;
    z-index: 2;
    transition: background .35s ease, border-radius .35s ease;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 16px 0 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,.12);
    cursor: default;
  }

  .wcard-root:hover .wcard-front {
    background: #FFE87C;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .wcard-front-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wcard-weather {
    flex-shrink: 0;
  }

  .wcard-temp {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -.03em;
    color: #111;
    line-height: 1;
  }

  .wcard-location {
    font-size: 0.72rem;
    color: #555;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 190px;
  }

  .wcard-refresh-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,.07);
    border: none;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #555;
    transition: background .2s;
    padding: 0;
  }

  .wcard-refresh-btn:hover { background: rgba(0,0,0,.14); }

  /* ── Card traseira ── */
  .wcard-back {
    position: absolute;
    top: 0;
    left: 0;
    width: 220px;
    height: 120px;           /* começa colapsado atrás */
    border-radius: 22px;
    background: white;
    z-index: 1;
    overflow: hidden;
    transition: height .4s cubic-bezier(.4,0,.2,1), border-radius .35s ease;
    box-shadow: 0 4px 20px rgba(0,0,0,.08);
    display: flex;
    flex-direction: column;
  }

  .wcard-root:hover .wcard-back {
    height: 290px;            /* expande no hover */
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  /* Conteúdo da parte traseira — fica alinhado à base */
  .wcard-back-upper,
  .wcard-back-lower {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 0 14px;
    gap: 16px;
    opacity: 0;
    transition: opacity .25s ease .15s;
  }

  .wcard-root:hover .wcard-back-upper,
  .wcard-root:hover .wcard-back-lower {
    opacity: 1;
  }

  .wcard-back-upper {
    padding-top: 130px;      /* empurra abaixo do card-front */
    padding-bottom: 10px;
    border-bottom: 1px solid #f1f1f1;
  }

  .wcard-back-lower {
    padding-top: 10px;
    padding-bottom: 10px;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* ── Items de detalhe ── */
  .wcard-detail-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    color: #333;
  }

  .wcard-detail-item svg {
    flex-shrink: 0;
    color: #888;
  }

  .wcard-detail-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .wcard-detail-label {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: #999;
  }

  .wcard-detail-value {
    font-size: 0.78rem;
    font-weight: 700;
    color: #222;
    white-space: nowrap;
  }

  .wcard-detail-sm .wcard-detail-value {
    font-size: 0.72rem;
  }

  /* ── Barra de categoria de voo ── */
  .wcard-cat-bar {
    margin-top: auto;
    width: 100%;
    height: 32px;
    border-bottom-left-radius: 22px;
    border-bottom-right-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: white;
    letter-spacing: .04em;
    transition: background .4s;
    flex-shrink: 0;
  }

  /* ── Modal seletor ── */
  .wcard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: wcard-fade-in .3s ease;
    backdrop-filter: blur(4px);
  }

  .wcard-modal {
    background: white;
    border-radius: 20px;
    padding: 32px 28px;
    max-width: 400px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
    animation: wcard-slide .35s ease;
  }

  .wcard-modal-icon {
    font-size: 52px;
    text-align: center;
    margin-bottom: 12px;
    animation: wcard-bounce 2s ease-in-out infinite;
  }

  .wcard-modal-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111;
    text-align: center;
    margin: 0 0 20px;
  }

  .wcard-airport-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }

  .wcard-airport-btn {
    background: #f7f8fa;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 8px;
    cursor: pointer;
    transition: all .2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .wcard-airport-btn:hover {
    border-color: #667eea;
    background: #f0f4ff;
    box-shadow: 0 3px 10px rgba(102,126,234,.15);
  }

  .wcard-airport-icao {
    font-weight: 800;
    font-size: 0.8rem;
    color: #667eea;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .wcard-airport-name {
    font-size: 0.68rem;
    color: #555;
    text-align: center;
    line-height: 1.3;
  }
`;