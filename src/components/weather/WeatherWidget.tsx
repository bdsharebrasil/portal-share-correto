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
  VFR: "hsl(142 71% 45%)",
  MVFR: "hsl(217 91% 60%)",
  IFR: "hsl(0 84% 60%)",
  LIFR: "hsl(280 75% 60%)",
  UNK: "hsl(220 9% 46%)",
};
const CAT_LABEL: Record<string, string> = {
  VFR: "VFR — Visual",
  MVFR: "MVFR — Marginal",
  IFR: "IFR — Instrumentos",
  LIFR: "LIFR — IFR Baixo",
  UNK: "Condições desconhecidas",
};

// Ícone atualizado para receber a prop isNight
const WeatherIcon = ({ cat, isNight }: { cat?: string; isNight?: boolean }) => {
  const c = cat ?? "UNK";
  const color = CAT_COLOR[c];
  
  if (c === "VFR") {
    // Retorna a Lua se for de noite, Sol se for de dia
    return isNight ? (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (c === "MVFR") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.7" />
        <circle cx="8" cy="8" r="3" />
      </svg>
    );
  }
  if (c === "IFR" || c === "LIFR") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 13a4 4 0 0 0-8 0" />
        <path d="M8 19v1M12 19v2M16 19v1" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
};

const IcoRefresh = ({ spin }: { spin: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spin ? "wc-spin .9s linear infinite" : undefined }}>
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
  
  // Novo estado para controlar o período (dia/noite)
  const [isNight, setIsNight] = useState(false);

  const { getWeather } = useAISWeb();

  // Efeito para verificar o horário e ativar/desativar o dark mode
  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      // Considera noite após as 18:00 e antes das 06:00
      setIsNight(hour >= 18 || hour < 6);
    };
    
    checkTime(); // Checagem inicial
    const timeInterval = setInterval(checkTime, 60 * 1000); // Atualiza a cada minuto
    
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

      {/* Repassa a classe de noite para o Overlay se ativado */}
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

      {/* Aplica a classe wc-night no Root */}
      <div className={`wc-root ${isNight ? "wc-night" : ""}`}>
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
              <span className="wc-cell-lbl">Dewpoint</span>
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
              <span className="wc-cell-lbl">hora</span>
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
  @keyframes wc-slide   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes wc-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

  .wc-root {
    position: relative;
    display: inline-block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
  }

  .wc-front {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 8px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.10);
    cursor: default;
    transition: background .25s, border-radius .25s;
    white-space: nowrap;
  }

  .wc-root:not(.wc-night):hover .wc-front {
    background: #FFE87C;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .wc-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background .4s;
  }

  .wc-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 90px;
  }

  .wc-temp {
    font-size: 13px;
    font-weight: 700;
    color: #111;
    line-height: 1;
    transition: color .25s;
  }

  .wc-loc {
    font-size: 9.5px;
    color: #666;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 130px;
    transition: color .25s;
  }

  .wc-btn {
    background: rgba(0,0,0,.06);
    border: none;
    border-radius: 6px;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #555;
    transition: background .15s, color .25s; padding: 0; flex-shrink: 0;
  }
  .wc-btn:hover { background: rgba(0,0,0,.12); }

  .wc-drop {
    position: absolute;
    top: 38px; left: 0;
    width: 220px;
    background: #ffffff;
    border-radius: 0 12px 12px 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,.12);
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    pointer-events: none;
    transition: max-height .3s cubic-bezier(.4,0,.2,1), opacity .2s ease, background .25s;
    z-index: 9999;
  }

  .wc-root:hover .wc-drop {
    max-height: 200px;
    opacity: 1;
    pointer-events: auto;
  }

  .wc-row {
    display: flex;
    padding: 8px 12px 6px;
    border-bottom: 1px solid #f2f2f2;
    gap: 4px;
    transition: border-color .25s;
  }
  .wc-row-last { border-bottom: none; padding-bottom: 8px; }

  .wc-cell {
    display: flex; flex-direction: column; gap: 2px; flex: 1;
  }

  .wc-cell-lbl {
    font-size: 8.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .06em; color: #aaa;
    transition: color .25s;
  }

  .wc-cell-val {
    font-size: 11px; font-weight: 700; color: #222; white-space: nowrap;
    transition: color .25s;
  }

  .wc-cat {
    padding: 5px 0;
    text-align: center;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: .05em;
    color: white;
  }

  .wc-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    animation: wc-fade-in .3s ease;
    backdrop-filter: blur(4px);
  }

  .wc-modal {
    background: white; border-radius: 18px;
    padding: 28px 24px;
    max-width: 380px; width: 90%;
    max-height: 80vh; overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.22);
    animation: wc-slide .3s ease;
    transition: background .25s;
  }

  .wc-modal-icon { font-size: 42px; text-align: center; margin-bottom: 10px; animation: wc-bounce 2s ease-in-out infinite; }
  .wc-modal-title { font-size: 1.1rem; font-weight: 700; color: #111; text-align: center; margin: 0 0 16px; transition: color .25s; }
  .wc-airport-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap: 8px; }

  .wc-airport-btn {
    background: #f7f8fa; border: 2px solid #e2e8f0; border-radius: 10px;
    padding: 10px 6px; cursor: pointer; transition: all .2s;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
  }
  .wc-airport-btn:hover { border-color: #667eea; background: #f0f4ff; }

  .wc-airport-icao { font-weight: 800; font-size: 0.73rem; color: #667eea; font-family: monospace; }
  .wc-airport-name { font-size: 0.62rem; color: #555; text-align: center; line-height: 1.3; transition: color .25s; }

  /* =========================================
     ESTILOS DO DARK MODE (NIGHT)
     ========================================= */
  
  .wc-root.wc-night .wc-front { background: #1e1e24; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
  .wc-root.wc-night:hover .wc-front { 
    background: #2b2b36; 
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  
  .wc-root.wc-night .wc-temp { color: #f5f5f5; }
  .wc-root.wc-night .wc-loc { color: #a0a0a0; }
  
  .wc-root.wc-night .wc-btn { background: rgba(255,255,255,.08); color: #ccc; }
  .wc-root.wc-night .wc-btn:hover { background: rgba(255,255,255,.15); color: #fff; }
  
  .wc-root.wc-night .wc-drop { background: #1e1e24; box-shadow: 0 8px 24px rgba(0,0,0,.6); }
  .wc-root.wc-night .wc-row { border-bottom-color: #33333d; }
  .wc-root.wc-night .wc-cell-lbl { color: #777; }
  .wc-root.wc-night .wc-cell-val { color: #eee; }

  /* Dark mode para o modal */
  .wc-overlay.wc-night-modal .wc-modal { background: #1e1e24; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
  .wc-overlay.wc-night-modal .wc-modal-title { color: #f5f5f5; }
  .wc-overlay.wc-night-modal .wc-airport-btn { background: #2a2a35; border-color: #3f3f4e; }
  .wc-overlay.wc-night-modal .wc-airport-btn:hover { border-color: #667eea; background: #323242; }
  .wc-overlay.wc-night-modal .wc-airport-name { color: #a0a0a0; }
`;