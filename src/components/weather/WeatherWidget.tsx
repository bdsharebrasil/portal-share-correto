import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
  {
    icao: "SBSP",
    name: "São Paulo Congonhas",
    lat: -23.615,
    lon: -46.473,
  },
  {
    icao: "SBGR",
    name: "São Paulo Guarulhos",
    lat: -23.4356,
    lon: -46.4731,
  },
  {
    icao: "SBKP",
    name: "Campinas Viracopos",
    lat: -23.0074,
    lon: -47.136,
  },
  {
    icao: "SBCY",
    name: "Cuiabá",
    lat: -15.65,
    lon: -56.117,
  },
  {
    icao: "SBBR",
    name: "Brasília",
    lat: -15.8711,
    lon: -47.9186,
  },
  {
    icao: "SBRJ",
    name: "Rio de Janeiro Santos Dumont",
    lat: -22.9068,
    lon: -43.1729,
  },
  {
    icao: "SBGL",
    name: "Rio de Janeiro Galeão",
    lat: -22.8068,
    lon: -43.2437,
  },
  {
    icao: "SBCF",
    name: "Belo Horizonte",
    lat: -19.8245,
    lon: -43.9493,
  },
  {
    icao: "SBCT",
    name: "Curitiba",
    lat: -25.5245,
    lon: -49.1761,
  },
  {
    icao: "SBPK",
    name: "Porto Alegre",
    lat: -29.3941,
    lon: -51.1557,
  },
];

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;

  const radians = (value: number) => (value * Math.PI) / 180;

  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lon2 - lon1) / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function nearestFallback(lat: number, lon: number) {
  return AIRPORTS_BR.reduce(
    (best: any, airport) => {
      const distance = haversineKm(
        lat,
        lon,
        airport.lat,
        airport.lon
      );

      return distance < best._distance
        ? {
            ...airport,
            _distance: distance,
          }
        : best;
    },
    {
      _distance: Infinity,
    }
  );
}

function parseMETARExtras(
  raw: string | null | undefined
) {
  if (!raw) {
    return {
      dewpoint: null,
      pressure: null,
    };
  }

  const tdMatch = raw.match(
    /\b(M?\d{2})\/(M?\d{2})\b/
  );

  let dewpoint: number | null = null;

  if (tdMatch) {
    const dp = tdMatch[2];

    dewpoint = dp.startsWith("M")
      ? -parseInt(dp.slice(1), 10)
      : parseInt(dp, 10);
  }

  const qMatch = raw.match(/\bQ(\d{4})\b/);

  return {
    dewpoint,
    pressure: qMatch
      ? parseInt(qMatch[1], 10)
      : null,
  };
}

const CAT_COLOR: Record<string, string> = {
  VFR: "#22c55e",
  MVFR: "#38bdf8",
  IFR: "#ef4444",
  LIFR: "#c084fc",
  UNK: "#94a3b8",
};

const CAT_LABEL: Record<string, string> = {
  VFR: "VFR",
  MVFR: "MVFR",
  IFR: "IFR",
  LIFR: "LIFR",
  UNK: "N/D",
};

function WeatherIcon({
  cat,
}: {
  cat?: string;
}) {
  const color =
    CAT_COLOR[cat ?? "UNK"] ?? CAT_COLOR.UNK;

  if (cat === "VFR") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M4.93 4.93l1.41 1.41" />
        <path d="M17.66 17.66l1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M4.93 19.07l1.41-1.41" />
        <path d="M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (cat === "MVFR") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.7" />
        <circle cx="8" cy="8" r="3" />
      </svg>
    );
  }

  if (cat === "IFR" || cat === "LIFR") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 13a4 4 0 0 0-8 0" />
        <path d="M8 19v1" />
        <path d="M12 19v2" />
        <path d="M16 19v1" />
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
      </svg>
    );
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RefreshIcon({
  spin,
}: {
  spin: boolean;
}) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spin ? "wx-spin" : ""}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ChevronIcon({
  open,
}: {
  open: boolean;
}) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={open ? "wx-chevron-open" : ""}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function WeatherWidget() {
  const [wx, setWx] = useState<WxState>({
    status: "idle",
  });

  const [spin, setSpin] = useState(false);

  const [showSelector, setShowSelector] =
    useState(false);

  const [showDetails, setShowDetails] =
    useState(false);

  const [selectedAirport, setSelectedAirport] =
    useState<string | null>(() => {
      if (typeof window === "undefined") {
        return null;
      }

      return (
        localStorage.getItem(
          "selectedAirport"
        ) || null
      );
    });

  const { getWeather } = useAISWeb();

  const setUnknown = useCallback(
    (airport: (typeof AIRPORTS_BR)[0]) => {
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
        time: new Date().toLocaleTimeString(
          "pt-BR",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        ),
      });
    },
    []
  );

  const loadAirport = useCallback(
    async (
      airport: (typeof AIRPORTS_BR)[0]
    ) => {
      try {
        const wxData =
          await getWeather(airport.icao);

        if (!wxData) {
          setUnknown(airport);
          return;
        }

        const metar =
          transformAISWebMETAR(
            wxData,
            airport.icao
          );

        if (!metar.rawOb) {
          setUnknown(airport);
          return;
        }

        const {
          dewpoint,
          pressure,
        } = parseMETARExtras(metar.rawOb);

        setWx({
          status: "ok",
          icao: airport.icao,
          name: airport.name,
          raw: metar.rawOb,
          temp: metar.temp,
          wind: metar.wspd
            ? `${metar.wdir}° / ${metar.wspd}${
                metar.wgst
                  ? ` G${metar.wgst}`
                  : ""
              } kt`
            : null,
          cat: metar.flightCategory,
          dewpoint,
          pressure,
          time: new Date().toLocaleTimeString(
            "pt-BR",
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
        });
      } catch {
        setUnknown(airport);
      }
    },
    [getWeather, setUnknown]
  );

  const requestLocation =
    useCallback(
      async (): Promise<{
        lat: number;
        lon: number;
      } | null> => {
        try {
          const position: any =
            await new Promise(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    timeout: 8000,
                    maximumAge: 60000,
                  }
                );
              }
            );

          return {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
        } catch {
          return null;
        }
      },
      []
    );

  const load = useCallback(async () => {
    setSpin(true);

    try {
      if (selectedAirport) {
        const airport =
          AIRPORTS_BR.find(
            (item) =>
              item.icao === selectedAirport
          );

        if (airport) {
          await loadAirport(airport);
          return;
        }
      }

      const coords =
        await requestLocation();

      if (coords) {
        const nearest =
          nearestFallback(
            coords.lat,
            coords.lon
          );

        await loadAirport(nearest);
        return;
      }

      setWx({
        status: "idle",
      });

      setShowSelector(true);
    } catch {
      setWx((previous) => ({
        ...previous,
        status: "error",
      }));
    } finally {
      setSpin(false);
    }
  }, [
    selectedAirport,
    loadAirport,
    requestLocation,
  ]);

  const handleSelect = useCallback(
    async (
      airport: (typeof AIRPORTS_BR)[0]
    ) => {
      setSelectedAirport(airport.icao);

      localStorage.setItem(
        "selectedAirport",
        airport.icao
      );

      setShowSelector(false);
      setShowDetails(false);

      await loadAirport(airport);
    },
    [loadAirport]
  );

  useEffect(() => {
    void load();

    const interval = setInterval(() => {
      void load();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!showSelector) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [showSelector]);

  const isOk = wx.status === "ok";

  const category =
    wx.cat ?? "UNK";

  const categoryColor =
    CAT_COLOR[category] ??
    CAT_COLOR.UNK;

  const categoryLabel =
    CAT_LABEL[category] ??
    CAT_LABEL.UNK;

  const currentAirport = useMemo(() => {
    return AIRPORTS_BR.find(
      (airport) =>
        airport.icao === wx.icao
    );
  }, [wx.icao]);

  return (
    <>
      <style>{`
        @keyframes wx-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes wx-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes wx-modal {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes wx-pulse {
          0%, 100% {
            opacity: .65;
          }
          50% {
            opacity: 1;
          }
        }

        .wx-spin {
          animation: wx-spin 0.8s linear infinite;
        }

        .wx-chevron-open {
          transform: rotate(180deg);
        }

        .wx-root {
          position: relative;
          display: inline-flex;
          align-items: center;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          z-index: 1;
        }

        .wx-main {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: 8px;
          margin-right: auto;
          height: 40px;
          min-width: 184px;
          min-height: 20px;
          max-width: 236px;
          width: 603px;
          padding: 0 9px 0 18px;

          background:
            linear-gradient(
              135deg,
              rgba(17, 24, 39, .96),
              rgba(10, 15, 27, .96)
            );

          border: 1px solid
            rgba(255,255,255,.09);

          border-radius: 12px;

          box-shadow:
            0 6px 18px rgba(0,0,0,.22),
            inset 0 1px 0
              rgba(255,255,255,.04);

          color: #f8fafc;
        }

        .wx-status {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: ${categoryColor};
          box-shadow:
            0 0 9px
            ${categoryColor};
        }

        .wx-weather-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .wx-summary {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          line-height: 1;
        }

        .wx-temp {
          font-size: 13px;
          font-weight: 750;
          letter-spacing: -.02em;
          color: #f8fafc;
        }

        .wx-airport {
          margin-top: 2px;
          font-size: 9px;
          font-weight: 600;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 105px;
        }

        .wx-icao {
          color: #cbd5e1;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          font-size: 9px;
        }

        .wx-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .wx-action {
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition:
            background .18s ease,
            color .18s ease;
        }

        .wx-action:hover {
          background: rgba(255,255,255,.08);
          color: #fff;
        }

        .wx-details {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 300px;
          padding: 12px;

          background:
            linear-gradient(
              145deg,
              rgba(15,23,42,.98),
              rgba(7,12,22,.98)
            );

          border: 1px solid
            rgba(255,255,255,.09);

          border-radius: 14px;

          box-shadow:
            0 20px 45px
            rgba(0,0,0,.38);

          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);

          animation: wx-fade .18s ease;
        }

        .wx-details-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 2px 10px;
        }

        .wx-details-title {
          font-size: 11px;
          font-weight: 750;
          color: #f8fafc;
        }

        .wx-details-sub {
          margin-top: 2px;
          font-size: 9px;
          color: #64748b;
        }

        .wx-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 6px;
        }

        .wx-card {
          padding: 9px 8px;
          border-radius: 9px;
          background:
            rgba(255,255,255,.045);
          border: 1px solid
            rgba(255,255,255,.055);
        }

        .wx-card-label {
          display: block;
          margin-bottom: 4px;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          color: #64748b;
        }

        .wx-card-value {
          display: block;
          font-size: 10px;
          font-weight: 700;
          color: #e2e8f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wx-category {
          margin-top: 7px;
          padding: 7px 9px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          font-weight: 750;
          color: #fff;
          background:
            linear-gradient(
              90deg,
              ${categoryColor},
              ${categoryColor}cc
            );
          box-shadow:
            0 4px 16px
            ${categoryColor}33;
        }

        .wx-category-code {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          font-size: 9px;
          opacity: .85;
        }

        .wx-selector-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          background:
            rgba(2, 6, 23, .72);

          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);

          animation: wx-fade .18s ease;
        }

        .wx-selector {
          width: min(560px, 100%);
          max-height: min(620px, calc(100vh - 40px));
          overflow-y: auto;

          padding: 22px;

          background:
            linear-gradient(
              145deg,
              #111827,
              #0b1220
            );

          border:
            1px solid
            rgba(255,255,255,.10);

          border-radius: 20px;

          box-shadow:
            0 30px 90px
            rgba(0,0,0,.55);

          animation: wx-modal .22s
            cubic-bezier(.16,1,.3,1);
        }

        .wx-selector-top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 17px;
        }

        .wx-selector-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;

          display: flex;
          align-items: center;
          justify-content: center;

          background:
            linear-gradient(
              135deg,
              rgba(56,189,248,.20),
              rgba(59,130,246,.08)
            );

          border: 1px solid
            rgba(56,189,248,.18);

          color: #38bdf8;
        }

        .wx-selector-title {
          font-size: 16px;
          font-weight: 760;
          color: #f8fafc;
        }

        .wx-selector-description {
          margin-top: 3px;
          font-size: 10px;
          color: #64748b;
          line-height: 1.45;
        }

        .wx-close {
          margin-left: auto;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 8px;
          background: rgba(255,255,255,.045);
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wx-close:hover {
          background: rgba(255,255,255,.09);
          color: #fff;
        }

        .wx-airport-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .wx-airport-btn {
          min-width: 0;
          padding: 12px;

          border:
            1px solid
            rgba(255,255,255,.07);

          border-radius: 12px;

          background:
            rgba(255,255,255,.035);

          color: #fff;

          cursor: pointer;

          text-align: left;

          transition:
            transform .16s ease,
            background .16s ease,
            border-color .16s ease;
        }

        .wx-airport-btn:hover {
          transform: translateY(-1px);

          background:
            rgba(56,189,248,.08);

          border-color:
            rgba(56,189,248,.35);
        }

        .wx-airport-btn.selected {
          background:
            rgba(56,189,248,.10);

          border-color:
            rgba(56,189,248,.45);
        }

        .wx-airport-code {
          display: block;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;

          font-size: 11px;
          font-weight: 800;

          color: #38bdf8;
        }

        .wx-airport-name {
          display: block;
          margin-top: 3px;

          font-size: 9px;
          line-height: 1.35;

          color: #94a3b8;
        }

        .wx-selector::-webkit-scrollbar {
          width: 6px;
        }

        .wx-selector::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 999px;
        }

        @media (max-width: 640px) {
          .wx-selector {
            padding: 17px;
            border-radius: 17px;
          }

          .wx-airport-grid {
            grid-template-columns: 1fr;
          }

          .wx-details {
            right: -40px;
            width: min(300px, calc(100vw - 24px));
          }
        }

        @media (max-width: 480px) {
          .wx-main {
            min-width: 150px;
          }

          .wx-airport {
            max-width: 78px;
          }
        }
      `}</style>

      <div
        className="wx-root"
        onMouseLeave={() => {
          if (!showDetails) {
            setShowDetails(false);
          }
        }}
      >
        <div className="wx-main">
          <span
            className="wx-status"
            style={{
              background: categoryColor,
              boxShadow: `0 0 9px ${categoryColor}`,
            }}
          />

          <div className="wx-weather-icon">
            <WeatherIcon cat={category} />
          </div>

          <button
            type="button"
            onClick={() =>
              setShowDetails((value) => !value)
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              border: 0,
              background: "transparent",
              padding: 0,
              color: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
            aria-label="Ver detalhes meteorológicos"
          >
            <div className="wx-summary">
              <span className="wx-temp">
                {isOk
                  ? wx.temp != null
                    ? `${wx.temp}°C`
                    : "—°C"
                  : wx.status === "loading"
                  ? "..."
                  : "—°C"}
              </span>

              <span className="wx-airport">
                {isOk
                  ? wx.name ?? "Aeródromo"
                  : "Carregando..."}
              </span>
            </div>

            <span className="wx-icao">
              {wx.icao ?? "----"}
            </span>

            <ChevronIcon
              open={showDetails}
            />
          </button>

          <div className="wx-actions">
            <button
              type="button"
              className="wx-action"
              onClick={(event) => {
                event.stopPropagation();
                setShowSelector(true);
              }}
              aria-label="Selecionar aeroporto"
              title="Selecionar aeroporto"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20" />
                <path d="M2 12h20" />
              </svg>
            </button>

            <button
              type="button"
              className="wx-action"
              onClick={(event) => {
                event.stopPropagation();
                void load();
              }}
              aria-label="Atualizar clima"
              title="Atualizar"
            >
              <RefreshIcon spin={spin} />
            </button>
          </div>
        </div>

        {showDetails && (
          <div
            className="wx-details"
            onMouseEnter={() =>
              setShowDetails(true)
            }
          >
            <div className="wx-details-header">
              <div>
                <div className="wx-details-title">
                  Condições atuais
                </div>

                <div className="wx-details-sub">
                  {currentAirport?.name ??
                    wx.name ??
                    "Aeródromo selecionado"}
                </div>
              </div>

              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: categoryColor,
                }}
              >
                {categoryLabel}
              </div>
            </div>

            <div className="wx-grid">
              <div className="wx-card">
                <span className="wx-card-label">
                  Vento
                </span>

                <span className="wx-card-value">
                  {isOk && wx.wind
                    ? wx.wind
                    : "—"}
                </span>
              </div>

              <div className="wx-card">
                <span className="wx-card-label">
                  Orvalho
                </span>

                <span className="wx-card-value">
                  {isOk &&
                  wx.dewpoint != null
                    ? `${wx.dewpoint}°C`
                    : "—"}
                </span>
              </div>

              <div className="wx-card">
                <span className="wx-card-label">
                  QNH
                </span>

                <span className="wx-card-value">
                  {isOk &&
                  wx.pressure != null
                    ? `${wx.pressure}`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="wx-category">
              <span>
                {categoryLabel}
              </span>

              <span className="wx-category-code">
                {wx.icao ?? "----"} ·{" "}
                {wx.time ?? "--:--"}
              </span>
            </div>
          </div>
        )}
      </div>

      {showSelector &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="wx-selector-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowSelector(false);
              }
            }}
          >
            <div className="wx-selector">
              <div className="wx-selector-top">
                <div className="wx-selector-icon">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12h20" />
                    <path d="M12 2v20" />
                    <path d="M5 7l7-5 7 5" />
                  </svg>
                </div>

                <div>
                  <div className="wx-selector-title">
                    Selecionar aeroporto
                  </div>

                  <div className="wx-selector-description">
                    Escolha o aeródromo para exibir
                    o METAR no topo do portal.
                  </div>
                </div>

                <button
                  type="button"
                  className="wx-close"
                  onClick={() =>
                    setShowSelector(false)
                  }
                  aria-label="Fechar"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line
                      x1="18"
                      y1="6"
                      x2="6"
                      y2="18"
                    />
                    <line
                      x1="6"
                      y1="6"
                      x2="18"
                      y2="18"
                    />
                  </svg>
                </button>
              </div>

              <div className="wx-airport-grid">
                {AIRPORTS_BR.map((airport) => {
                  const selected =
                    airport.icao ===
                    selectedAirport;

                  return (
                    <button
                      type="button"
                      key={airport.icao}
                      className={`wx-airport-btn ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        void handleSelect(
                          airport
                        )
                      }
                    >
                      <span className="wx-airport-code">
                        {airport.icao}
                      </span>

                      <span className="wx-airport-name">
                        {airport.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
