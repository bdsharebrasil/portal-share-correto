import { useState, useEffect, useCallback } from "react";
import { useAISWeb } from "@/hooks/useAISWeb";
import { transformAISWebMETAR } from "@/services/aiswebWeather";

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
}

const AIRPORTS_BR = [
  { icao: "SBSP", name: "São Paulo Congonhas",          lat: -23.6150, lon: -46.4730 },
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

function parseMETARExtras(raw: string | null | undefined) {
  if (!raw) return { dewpoint: null, pressure: null };
  const tdMatch = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  let dewpoint: number | null = null;
  if (tdMatch) {
    const dp = tdMatch[2];
    dewpoint = dp.startsWith("M") ? -parseInt(dp.slice(1)) : parseInt(dp);
  }
  const qMatch = raw.match(/\bQ(\d{4})\b/);
  return { dewpoint, pressure: qMatch ? parseInt(qMatch[1]) : null };
}

const CAT_COLOR: Record<string, string> = {
  VFR: "#22c55e",  // Verde vibrante
  MVFR: "#3b82f6", // Azul moderno
  IFR: "#ef4444",  // Vermelho de alerta
  LIFR: "#a855f7", // Roxo elegante
  UNK: "#71717a",  // Cinza neutro
};

const CAT_LABEL: Record<string, string> = {
  VFR: "VFR — Visual",
  MVFR: "MVFR — Marginal",
  IFR: "IFR — Instrumentos",
  LIFR: "LIFR — IFR Baixo",
  UNK: "Condições desconhecidas",
};

const WeatherIcon = ({ cat, isNight }: { cat?: string; isNight?: boolean }) => {
  const c = cat ?? "UNK";
  const color = CAT_COLOR[c];
  
  if (c === "VFR") {
    return isNight ? (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (c === "MVFR") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.7" />
        <circle cx="8" cy="8" r="3" />
      </svg>
    );
  }
  if (c === "IFR" || c === "LIFR") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 13a4 4 0 0 0-8 0" />
        <path d="M8 19v1M12 19v2M16 19v1" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
};

const IcoRefresh = ({ spin }: { spin: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spin ? "wc-spin 1s linear infinite" : undefined }}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export default function WeatherWidget() {
  const [wx, setWx] = useState<WxState>({ status: "idle" });
  const [spin, setSpin] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("selectedAirport") || null : null
  );
  
  const [isNight, setIsNight] = useState(false);
  const { getWeather } = useAISWeb();

  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      setIsNight(hour >= 18 || hour < 6);
    };
    checkTime();
    const timeInterval = setInterval(checkTime, 60 * 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const requestLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    try {
      const pos: any = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 60000 })
      );
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch { return null; }
  }, []);

  const setUnknown = (ap: typeof AIRPORTS_BR[0]) =>
    setWx({
      status: "ok", icao: ap.icao, name: ap.name, raw: null,
      temp: null, wind: null, dewpoint: null, pressure: null, cat: "UNK",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });

  const loadAirport = useCallback(async (ap: typeof AIRPORTS_BR[0]) => {
    try {
      const wxData = await getWeather(ap.icao);
      if (!wxData) { setUnknown(ap); return; }
      const m = transformAISWebMETAR(wxData, ap.icao);
      if (!m.rawOb) { setUnknown(ap); return; }
      const { dewpoint, pressure } = parseMETARExtras(m.rawOb);
      setWx({
        status: "ok", icao: ap.icao, name: ap.name, raw: m.rawOb, temp: m.temp,
        wind: m.wspd ? `${m.wdir}°/${m.wspd}${m.wgst ? "G" + m.wgst : ""}kt` : null,
        cat: m.flightCategory, dewpoint, pressure,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch { setUnknown(ap); }
  }, [getWeather]);

  const load = useCallback(async () => {
    setSpin(true);
    setWx({ status: "loading" });
    try {
      if (selectedAirport) {
        const ap = AIRPORTS_BR.find(a => a.icao === selectedAirport);
        if (ap) { await loadAirport(ap); return; }
      }
      const coords = await requestLocation();
      if (coords) { await loadAirport(nearestFallback(coords.lat, coords.lon)); }
      else { setShowSelector(true); setWx({ status: "idle" }); }
    } catch {
      setWx(p => p.status === "idle" ? p : { ...p, status: "ok" });
    } finally { setSpin(false); }
  }, [selectedAirport, requestLocation, loadAirport]);

  const handleSelect = useCallback(async (ap: typeof AIRPORTS_BR[0]) => {
    setSelectedAirport(ap.icao);
    localStorage.setItem("selectedAirport", ap.icao);
    setShowSelector(false);
    await loadAirport(ap);
  }, [loadAirport]);

  useEffect(() => {
    load();
    const t = setInterval(() => load().catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const isOk  = wx.status === "ok";
  const color = CAT_COLOR[wx.cat ?? "UNK"];
  const label = CAT_LABEL[wx.cat ?? "UNK"];

  return (
    <>
      <style>{CSS}</style>

      {showSelector && (
        <div className={`wc-overlay ${isNight ? "wc-night-modal" : ""}`} onClick={() => setShowSelector(false)}>
          <div className="wc-modal" onClick={e => e.stopPropagation()}>
            <div className="wc-modal-icon">🛫</div>
            <h2 className="wc-modal-title">Selecione seu aeródromo</h2>
            <div className="wc-airport-grid">
              {AIRPORTS_BR.map(ap => (
                <button key={ap.icao} className="wc-airport-btn" onClick={() => handleSelect(ap)}>
                  <span className="wc-airport-icao">{ap.icao}</span>
                  <span className="wc-airport-name">{ap.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Variável CSS inline para a cor da categoria (para usar no glow) */}
      <div 
        className={`wc-root ${isNight ? "wc-night" : ""}`} 
        style={{ "--cat-color": color } as React.CSSProperties}
      >
        <div className="wc-front">
          <span className="wc-dot" style={{ background: color }} />
          <WeatherIcon cat={wx.cat} isNight={isNight} />
          <div className="wc-info">
            <span className="wc-temp">
              {isOk ? (wx.temp != null ? `${wx.temp}°C` : "—°C") : "···"}
            </span>
            <span className="wc-loc">
              {isOk ? (wx.name ?? wx.icao ?? "—") : "Carregando..."}
            </span>
          </div>
          <button className="wc-btn" onClick={(e) => { e.stopPropagation(); load(); }} aria-label="Atualizar">
            <IcoRefresh spin={spin} />
          </button>
        </div>

        <div className="wc-drop">
          <div className="wc-row">
            <div className="wc-cell">
              <span className="wc-cell-lbl">Vento</span>
              <span className="wc-cell-val">{isOk && wx.wind ? wx.wind : "—"}</span>
            </div>
            <div className="wc-cell">
              <span className="wc-cell-lbl">Ponto de Orvalho</span>
              <span className="wc-cell-val">{isOk && wx.dewpoint != null ? `${wx.dewpoint}°C` : "—"}</span>
            </div>
          </div>
          <div className="wc-row wc-row-last">
            <div className="wc-cell">
              <span className="wc-cell-lbl">QNH</span>
              <span className="wc-cell-val">{isOk && wx.pressure != null ? `${wx.pressure} hPa` : "—"}</span>
            </div>
            <div className="wc-cell">
              <span className="wc-cell-lbl">ICAO</span>
              <span className="wc-cell-val">{isOk ? (wx.icao ?? "—") : "—"}</span>
            </div>
            <div className="wc-cell">
              <span className="wc-cell-lbl">Hora</span>
              <span className="wc-cell-val">{isOk ? (wx.time ?? "—") : "—"}</span>
            </div>
          </div>
          <div className="wc-cat" style={{ background: color }}>{label}</div>
        </div>
      </div>
    </>
  );
}

const CSS = `
  @keyframes wc-spin    { to { transform: rotate(360deg); } }
  @keyframes wc-fade-in { from { opacity:0; } to { opacity:1; } }
  @keyframes wc-slide   { from { opacity:0; transform:translateY(15px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes wc-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

  .wc-root {
    /* Variáveis - Tema Claro */
    --wc-bg: transparent; /* Pega a cor do wrapper do Header */
    --wc-bg-hover: rgba(5, 5, 15, 0.04);
    --wc-text-main: #b2c4f7;
    --wc-text-sub: #b5c4db;
    --wc-btn-bg: rgba(1, 4, 14, 0.53);
    --wc-btn-hover: rgba(2, 4, 22, 0.84);
    --wc-drop-bg: rgba(1, 5, 8, 0.6);
    --wc-drop-border: rgba(0, 0, 0, 0.3);
    --wc-cell-border: rgba(0, 0, 0, 0.38);

    position: relative;
    display: inline-block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    z-index: 60;
  }

  .wc-root.wc-night {
    /* Variáveis - Tema Escuro */
    --wc-bg-hover: rgba(255, 255, 255, 0.08);
    --wc-text-main: #07325c;
    --wc-text-sub: #1a273a;
    --wc-btn-bg: rgba(255, 255, 255, 0.1);
    --wc-btn-hover: rgba(255, 255, 255, 0.18);
    --wc-drop-bg: rgba(15, 23, 42, 0.9);
    --wc-drop-border: rgba(255, 255, 255, 0.12);
    --wc-cell-border: rgba(255, 255, 255, 0.06);
  }

  .wc-front {
    display: flex;
    align-items: center;
<<<<<<< HEAD
    gap: 8px;
    height: 100%; /* Ajusta à altura do container pai no Header */
    min-height: 36px;
    padding: 0 12px 0 10px;
    background: var(--wc-bg);
    border-radius: 99px; /* Formato Pílula */
=======
    gap: -8px;
    height: 38px;
    margin-left: -48px;
    margin-right: -48px;
    padding: 0;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.10);
>>>>>>> refs/remotes/origin/main
    cursor: default;
    transition: background 0.3s ease;
    white-space: nowrap;
  }

  .wc-root:hover .wc-front {
    background: var(--wc-bg-hover);
  }

  .wc-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px var(--cat-color); /* Efeito Glow */
    transition: background 0.4s;
  }

  .wc-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0px;
    min-width: 90px;
  }

  .wc-temp {
    font-size: 13px;
    font-weight: 700;
    color: var(--wc-text-main);
    line-height: 1.1;
    letter-spacing: -0.02em;
    transition: color 0.3s;
  }

  .wc-loc {
    font-size: 10px;
    font-weight: 500;
    color: var(--wc-text-sub);
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 130px;
    transition: color 0.3s;
  }

  .wc-btn {
    background: var(--wc-btn-bg);
    border: none;
    border-radius: 50%;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--wc-text-sub);
    transition: all 0.2s ease; padding: 0; flex-shrink: 0;
  }
  .wc-btn:hover { 
    background: var(--wc-btn-hover); 
    color: var(--wc-text-main);
  }

  .wc-drop {
    position: absolute;
    top: calc(100% + 10px); /* Descolado (Tooltip) */
    right: 0; /* Alinha à direita no header */
    width: 240px;
    background: var(--wc-drop-bg);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--wc-drop-border);
    border-radius: 16px;
    box-shadow: 0 12px 40px -10px rgba(0,0,0,0.25);
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px) scale(0.95);
    transform-origin: top right;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 1000;
  }

  .wc-root:hover .wc-drop {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) scale(1);
  }

  .wc-row {
    display: flex;
    padding: 10px 16px;
    border-bottom: 1px solid var(--wc-cell-border);
    gap: 8px;
  }
  .wc-row-last { border-bottom: none; padding-bottom: 12px; }

  .wc-cell {
    display: flex; flex-direction: column; gap: 3px; flex: 1;
  }

  .wc-cell-lbl {
    font-size: 9px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--wc-text-sub);
  }

  .wc-cell-val {
    font-size: 12px; font-weight: 700; color: var(--wc-text-main); white-space: nowrap;
  }

  .wc-cat {
    padding: 6px 0;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(206, 248, 248, 0.9);
    text-shadow: 0 1px 2px rgba(12, 6, 6, 0.38);
  }

  /* MODAL MODERNO */
  .wc-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    animation: wc-fade-in 0.3s ease;
  }

  .wc-modal {
    background: #b5bef3ff; 
    border-radius: 24px;
    padding: 32px 24px;
    max-width: 420px; width: 90%;
    max-height: 85vh; overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.3);
    animation: wc-slide 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .wc-modal-icon { font-size: 42px; text-align: center; margin-bottom: 12px; animation: wc-bounce 2s ease-in-out infinite; }
  .wc-modal-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; text-align: center; margin: 0 0 24px; }
  .wc-airport-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap: 10px; }

  .wc-airport-btn {
    background: #34475a; border: 1px solid #e2e8f0; border-radius: 14px;
    padding: 12px 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .wc-airport-btn:hover { 
    border-color: #3b82f6; background: #8097b6; 
    transform: translateY(-2px);
    box-shadow: 0 6px 16px -4px rgba(59, 130, 246, 0.2);
  }

<<<<<<< HEAD
  .wc-airport-icao { font-weight: 800; font-size: 0.8rem; color: #3b82f6; font-family: ui-monospace, monospace; }
  .wc-airport-name { font-size: 0.65rem; color: #64748b; text-align: center; line-height: 1.3; }

  /* Modal Escuro */
  .wc-overlay.wc-night-modal .wc-modal { background: #5b6c92ff; border: 1px solid rgba(255,255,255,0.1); }
  .wc-overlay.wc-night-modal .wc-modal-title { color: #f8fafc; }
  .wc-overlay.wc-night-modal .wc-airport-btn { background: #1e293b; border-color: #334155; }
  .wc-overlay.wc-night-modal .wc-airport-btn:hover { border-color: #3b82f6; background: #0f172a; }
  .wc-overlay.wc-night-modal .wc-airport-name { color: #94a3b8; }
`;
=======
  /* Dark mode para o modal */
  .wc-overlay.wc-night-modal .wc-modal { background: #1e1e24; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
  .wc-overlay.wc-night-modal .wc-modal-title { color: #f5f5f5; }
  .wc-overlay.wc-night-modal .wc-airport-btn { background: #2a2a35; border-color: #3f3f4e; }
  .wc-overlay.wc-night-modal .wc-airport-btn:hover { border-color: #667eea; background: #323242; }
  .wc-overlay.wc-night-modal .wc-airport-name { color: #a0a0a0; }
`;
>>>>>>> refs/remotes/origin/main
