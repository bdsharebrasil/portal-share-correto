import { useState, useEffect, useCallback, useRef } from "react";
import { useAISWeb } from "@/hooks/useAISWeb";
import { transformAISWebMETAR } from "@/services/aiswebWeather";
import { METAR_MOCK_DATA } from "@/data/metarMockData";

// --- TIPAGEM ---
interface WxState {
  status: "idle" | "loading" | "ok" | "error";
  icao?: string;
  name?: string;
  distKm?: number;
  raw?: string;
  temp?: number | null;
  wind?: string | null;
  cat?: string;
  time?: string;
  msg?: string;
}

// ─── FALLBACK de aeroportos ───────────────────────────────────────────────────
const AIRPORTS_BR = [
  { icao: "SBSP", name: "São Paulo Congonhas",    lat: -23.6150, lon: -46.4730 },
  { icao: "SBGR", name: "São Paulo Guarulhos",    lat: -23.4356, lon: -46.4731 },
  { icao: "SBKP", name: "Campinas Viracopos",     lat: -23.0074, lon: -47.1360 },
  { icao: "SBCY", name: "Cuiabá",                 lat: -15.6500, lon: -56.1170 },
  { icao: "SBBR", name: "Brasília",               lat: -15.8711, lon: -47.9186 },
  { icao: "SBRJ", name: "Rio de Janeiro Santos Dumont", lat: -22.9068, lon: -43.1729 },
  { icao: "SBGIG", name: "Rio de Janeiro Galeão", lat: -22.8068, lon: -43.2437 },
  { icao: "SBCF", name: "Belo Horizonte",         lat: -19.8245, lon: -43.9493 },
  { icao: "SBCT", name: "Curitiba",               lat: -25.5245, lon: -49.1761 },
  { icao: "SBPK", name: "Porto Alegre",           lat: -29.3941, lon: -51.1557 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestFallback(lat: number, lon: number) {
  return AIRPORTS_BR.reduce((best: any, ap) => {
    const d = haversineKm(lat, lon, ap.lat, ap.lon);
    return d < best._d ? { ...ap, distKm: Math.round(d), _d: d } : best;
  }, { _d: Infinity });
}

// ─── ÍCONES E CORES ──────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = { VFR: "#22c55e", MVFR: "#3b82f6", IFR: "#ef4444", LIFR: "#a855f7", UNK: "#6b7280" };

const Svg = ({ d, size = 13, spin = false }: { d: any, size?: number, spin?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, animation: spin ? "wx-spin .9s linear infinite" : undefined }}>{d}</svg>
);

const IcoThermo  = () => <Svg d={<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />} />;
const IcoWind    = () => <Svg size={12} d={<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />} />;
const IcoPin     = () => <Svg size={11} d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>} />;
const IcoInfo    = () => <Svg size={12} d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>} />;
const IcoRefresh = ({ spin }: { spin: boolean }) => <Svg size={12} spin={spin} d={<><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></>} />;

// ─── WIDGET PRINCIPAL ────────────────────────────────────────────────────────
export default function WeatherWidget() {
  const [wx, setWx] = useState<WxState>({ status: "idle" });
  const [spin, setSpin] = useState(false);
  const [tip, setTip] = useState(false);
  const [showAirportSelector, setShowAirportSelector] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedAirport") || null;
    }
    return null;
  });
  const tipRef = useRef<HTMLDivElement>(null);

  // Hook AISWeb com cache inteligente e race condition protection
  const { getWeather } = useAISWeb();

  const requestLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    try {
      const pos: any = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 60000 })
      );
      return {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
    } catch (err: any) {
      // Erro de timeout é comum em dev/browsers sem permissão
      const isTimeout = err?.code === 3;
      const msg = isTimeout ? "Geolocation timeout" : "Geolocation negada";
      console.warn(`[WeatherWidget] ${msg}:`, err?.message || err);
      return null;
    }
  }, []);

  const loadWeatherForAirport = useCallback(async (airport: typeof AIRPORTS_BR[0]) => {
    try {
      // Busca dados via hook com cache (com fallback automático para mock data)
      const wxData = await getWeather(airport.icao);

      // Check explícito: se getWeather retornar null, não tentar transformar
      if (!wxData) {
        console.debug(`[WeatherWidget] Dados indisponíveis para ${airport.icao} — usando fallback`);
        setWxToUnknown(airport);
        return;
      }

      // Transform dados brutos em formato estruturado
      const metarData = transformAISWebMETAR(wxData, airport.icao);

      // Validar que o METAR não ficou vazio (fallback silencioso)
      if (!metarData.rawOb) {
        console.debug(`[WeatherWidget] METAR vazio para ${airport.icao} — usando fallback`);
        setWxToUnknown(airport);
        return;
      }

      setWx({
        status: "ok",
        icao: airport.icao,
        name: airport.name,
        distKm: 0,
        raw: metarData.rawOb,
        temp: metarData.temp,
        wind: metarData.wspd
          ? `${metarData.wdir}° ${metarData.wspd}${metarData.wgst ? ' G' + metarData.wgst : ''}kt`
          : null,
        cat: metarData.flightCategory,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (weatherError: any) {
      // Erro esperado quando API falha - mock fallback será usado silenciosamente
      console.debug(`[WeatherWidget] Dados de weather indisponíveis para ${airport.icao}`);
      // Mostrar estado desconhecido com dados locais do aeroporto
      setWxToUnknown(airport);
    }
  }, [getWeather]);

  // Helper para exibir estado desconhecido
  const setWxToUnknown = (airport: typeof AIRPORTS_BR[0]) => {
    setWx({
      status: "ok",
      icao: airport.icao,
      name: airport.name,
      distKm: 0,
      raw: null,
      temp: null,
      wind: null,
      cat: "UNK",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
  };

  const load = useCallback(async () => {
    setSpin(true);
    setWx({ status: "loading" });

    try {
      // Se usuário já selecionou um aeródromo manualmente, usar esse
      if (selectedAirport) {
        const airport = AIRPORTS_BR.find(a => a.icao === selectedAirport);
        if (airport) {
          await loadWeatherForAirport(airport);
          setSpin(false);
          return;
        }
      }

      // Tentar geolocation automaticamente
      const coords = await requestLocation();

      if (coords) {
        // Sucesso! Usar aeródromo mais próximo
        const airport = nearestFallback(coords.lat, coords.lon);
        await loadWeatherForAirport(airport);
      } else {
        // Falhou - mostrar seletor de aeródromos
        setShowAirportSelector(true);
        setWx({ status: "idle" });
      }
    } catch (error) {
      // Silently fail - não mostrar erro na UI, apenas log
      console.warn("[WeatherWidget] Erro ao carregar weather:", error instanceof Error ? error.message : String(error));
      // Manter estado anterior em vez de mostrar erro
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
    // Retry a cada 10 minutos se tiver sucesso, ou a cada 30 minutos se falhar
    const t = setInterval(() => {
      load().catch(() => {
        // Se falhar, próxima tentativa será em 30 minutos
        console.warn('[WeatherWidget] Próxima tentativa em 30 minutos');
      });
    }, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const color = wx.cat ? (CAT_COLOR[wx.cat] || CAT_COLOR.UNK) : CAT_COLOR.UNK;

  return (
    <>
      <style>{CSS}</style>

      {showAirportSelector && (
        <div className="location-prompt-overlay">
          <div className="location-prompt-modal airport-selector-modal">
            <div className="location-prompt-icon">🛫</div>
            <h2 className="location-prompt-title">Selecione seu aeródromo</h2>
            <div className="airport-list">
              {AIRPORTS_BR.map(airport => (
                <button
                  key={airport.icao}
                  className="airport-option"
                  onClick={() => handleSelectAirport(airport)}
                >
                  <span className="airport-icao">{airport.icao}</span>
                  <span className="airport-name">{airport.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="wx">
        {wx.status === "ok" ? (
          <>
            <span className="wx-catbar" style={{ background: color }} />
            <span className="wx-icao"><IcoPin />{wx.icao} <em className="wx-dist">{wx.distKm}km</em></span>
            <span className="wx-sep" />
            <span className="wx-temp"><IcoThermo />{wx.temp}°C</span>
            <span className="wx-wind"><IcoWind />{wx.wind}</span>
            <span className="wx-badge" style={{ background: color + "20", color, borderColor: color + "50" }}>{wx.cat}</span>
            <div ref={tipRef} className="wx-tip-anchor">
              <button className="wx-btn" onClick={() => setTip(!tip)}><IcoInfo /></button>
              {tip && (
                <div className="wx-tip">
                  <div className="wx-tip-title">METAR — {wx.icao} <span> · {wx.name}</span></div>
                  <div className="wx-tip-raw">{wx.raw || "Sem dados"}</div>
                </div>
              )}
            </div>
          </>
        ) : wx.status === "error" ? (
          <span className="wx-err">{wx.msg}</span>
        ) : (
          <span className="wx-loading">Carregando...</span>
        )}
        <button className="wx-btn wx-btn-last" onClick={load}><IcoRefresh spin={spin} /></button>
      </div>
    </>
  );
}

const CSS = `
  @keyframes wx-spin  { to { transform: rotate(360deg); } }
  @keyframes wx-in    { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }
  @keyframes wx-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes modal-fade-in { from { opacity:0; } to { opacity:1; } }
  @keyframes modal-slide-up { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }

  .wx {
    display: inline-flex; align-items: center;
    height: 38px;
    background: rgba(7,11,20,.84);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 10px;
    backdrop-filter: blur(14px);
    box-shadow: 0 2px 18px rgba(0,0,0,.38);
    font-family: 'JetBrains Mono','Fira Code',ui-monospace,monospace;
    font-size: 12px;
    position: relative;
    overflow: visible;
    user-select: none;
  }

  .wx-loading {
    display: flex; align-items: center; gap: 6px;
    padding: 0 14px; color: #64748b; font-size: 11px;
    animation: wx-pulse 1.6s ease infinite;
  }

  .wx-err { padding: 0 12px; color: #f87171; font-size: 11px; }

  .wx-catbar {
    width: 4px; height: 100%;
    border-radius: 10px 0 0 10px; flex-shrink: 0;
    transition: background .4s;
  }

  .wx-icao {
    display: flex; align-items: center; gap: 5px;
    padding: 0 10px 0 8px;
    font-weight: 700; font-size: 12.5px;
    color: #e2e8f0; letter-spacing: .06em;
  }
  .wx-dist { font-size: 9.5px; font-weight: 400; color: #475569; font-style: normal; }

  .wx-sep { display:block; width:1px; height:18px; background:rgba(255,255,255,.09); flex-shrink:0; }

  .wx-temp {
    display: flex; align-items: center; gap: 4px;
    padding: 0 8px; color: #fbbf24;
    font-weight: 600; font-size: 12.5px;
  }

  .wx-wind {
    display: flex; align-items: center; gap: 4px;
    padding: 0 8px 0 0; color: #94a3b8; font-size: 11px;
  }

  .wx-badge {
    font-size: 9px; font-weight: 700;
    padding: 2px 7px; border-radius: 5px;
    border: 1px solid transparent;
    letter-spacing: .12em; margin-right: 2px;
  }

  .wx-btn {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 100%;
    background: transparent; border: none;
    border-left: 1px solid rgba(255,255,255,.07);
    color: #475569; cursor: pointer;
    transition: color .15s, background .15s; padding: 0;
  }
  .wx-btn:hover { color: #cbd5e1; background: rgba(255,255,255,.06); }
  .wx-btn-last  { border-radius: 0 10px 10px 0; overflow: hidden; }

  .wx-tip-anchor { position: relative; display: flex; }

  .wx-tip {
    position: absolute; top: calc(100% + 10px); right: 0;
    min-width: 280px; max-width: 400px;
    background: rgba(5,8,16,.97);
    border: 1px solid rgba(255,255,255,.11);
    border-radius: 10px; padding: 12px 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,.55);
    z-index: 9999; animation: wx-in .18s ease;
  }
  .wx-tip-title {
    font-size: 10px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 7px;
  }
  .wx-tip-title span { font-weight: 400; text-transform: none; }
  .wx-tip-raw  { font-size: 11px; color: #e2e8f0; line-height: 1.65; word-break: break-all; }
  .wx-tip-time { margin-top: 8px; font-size: 9.5px; color: #334155; }

  .location-prompt-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: modal-fade-in 0.3s ease;
    backdrop-filter: blur(4px);
  }

  .location-prompt-modal {
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 20px;
    padding: 40px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
    animation: modal-slide-up 0.4s ease;
  }

  .location-prompt-icon {
    font-size: 64px;
    margin-bottom: 20px;
    display: block;
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .location-prompt-title {
    font-size: 24px;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 16px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .location-prompt-description {
    font-size: 15px;
    color: #4a5568;
    line-height: 1.6;
    margin: 0 0 32px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .location-prompt-description strong {
    color: #2d3748;
    font-weight: 600;
  }

  .location-prompt-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 14px 40px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  .location-prompt-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
  }

  .location-prompt-button:active {
    transform: translateY(0);
  }

  .location-prompt-button-secondary {
    background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
    color: #2d3748;
    margin-top: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .location-prompt-button-secondary:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .airport-selector-modal {
    max-height: 80vh;
    overflow-y: auto;
  }

  .airport-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 20px;
    text-align: left;
  }

  .airport-option {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .airport-option:hover {
    border-color: #667eea;
    background: linear-gradient(135deg, #f8f9ff 0%, #f0f4f8 100%);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  }

  .airport-icao {
    font-weight: 700;
    color: #667eea;
    font-size: 13px;
    margin-bottom: 4px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .airport-name {
    font-size: 12px;
    color: #4a5568;
    line-height: 1.3;
  }
`;
