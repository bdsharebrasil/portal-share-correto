import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

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

// ─── PARSERS DO METAR ────────────────────────────────────────────────────────
function parseTempFromMetar(raw: string | null) {
  if (!raw) return null;
  const m = raw.match(/\s(M?\d{2})\/(M?\d{2})(\s|$)/);
  if (!m) return null;
  return parseInt(m[1].replace("M", "-"), 10);
}

function parseWindFromMetar(raw: string | null) {
  if (!raw) return null;
  const m = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT\b/);
  if (!m) return null;
  const dir = m[1] === "VRB" ? "VRB" : `${m[1]}°`;
  return `${dir} ${m[2]}${m[4] ? " G" + m[4] : ""}kt`;
}

function flightCategory(raw: string | null) {
  if (!raw) return "UNK";
  if (/CAVOK|SKC|CLR|NCD/.test(raw)) return "VFR";
  const vm = raw.match(/\b(\d{4})\b/);
  const vis = vm ? parseInt(vm[1], 10) : 9999;
  if (vis < 800)  return "LIFR";
  if (vis < 1500) return "IFR";
  if (vis < 5000) return "MVFR";
  return "VFR";
}

function extractRawMetar(data: any) {
  if (!data) return null;
  const nodes = [data?.met, data?.metar, data];
  for (const node of nodes) {
    if (!node) continue;
    for (const key of ["metar", "texto", "raw", "message"]) {
      const s = typeof node[key] === "string" ? node[key].trim() : null;
      if (s && /\d{6}Z/.test(s)) return s;
    }
    if (typeof node === "string" && /\d{6}Z/.test(node)) return node.trim();
  }
  return null;
}
// ─── FALLBACK de aeroportos ───────────────────────
const AIRPORTS_BR = [
  { icao: "SBCY", name: "Cuiabá",         lat: -15.6500, lon: -56.117 },
  { icao: "SBBR", name: "Brasília",       lat: -15.8711, lon: -47.9186 },
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
  const tipRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setSpin(true);
    setWx({ status: "loading" });

    try {
      const pos: any = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const { latitude: lat, longitude: lon } = pos.coords;

      let airport = null;
      try {
        const result = await apiClient.getNearbyAirport(lat, lon, 1);
        if (result?.airports?.[0]) airport = result.airports[0];
      } catch { /* fallback */ }

      if (!airport || airport.distKm > 500) airport = nearestFallback(lat, lon);

      const wxData = await apiClient.getWeather(airport.icao);
      const raw = extractRawMetar(wxData);
      
      setWx({
        status: "ok",
        icao: airport.icao,
        name: airport.name,
        distKm: airport.distKm || Math.round(haversineKm(lat, lon, airport.lat, airport.lon)),
        raw,
        temp: parseTempFromMetar(raw),
        wind: parseWindFromMetar(raw),
        cat: flightCategory(raw),
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch {
      setWx({ status: "error", msg: "Erro ao carregar METAR" });
    } finally {
      setSpin(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const color = wx.cat ? (CAT_COLOR[wx.cat] || CAT_COLOR.UNK) : CAT_COLOR.UNK;

  return (
    <>
      <style>{CSS}</style>
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
`;