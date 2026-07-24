import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import type { PilotType } from "./utils";

export interface AerodromeSel {
  id: string;
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

export interface AircraftSel {
  id: string;
  name: string; // "Fabricante Modelo"
  matricula: string;
  image: string | null;
  cruiseKts: number;
  fuelBurnLph: number;
  /** valor R$/hora do piloto conforme a tabela `aeronave.preco_hora` */
  pilotHourlyBRL: number;
}

export interface CalculatorState {
  aircraft: AircraftSel | null;
  adep: AerodromeSel | null;
  ades: AerodromeSel | null;
  fuelPriceBRL: number;
  pilotType: PilotType;
  /** salário mensal médio quando piloto é fixo */
  fixedPilotMonthlyBRL: number;
  annualHours: number;
  /** overrides de custo derivados da categoria da aeronave */
  mtowKg: number;
  hangarMonthlyBRL: number;
  maintenanceHourlyBRL: number;
}

type Ctx = {
  state: CalculatorState;
  set: <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => void;
  reset: () => void;
};

const DEFAULT_STATE: CalculatorState = {
  aircraft: null,
  adep: null,
  ades: null,
  fuelPriceBRL: 8.5,
  pilotType: "freelance",
  fixedPilotMonthlyBRL: 15000, // média Brasil piloto fixo executiva
  annualHours: 300,
  mtowKg: 2500,
  hangarMonthlyBRL: 3500,
  maintenanceHourlyBRL: 220,
};

const CalculatorContext = createContext<Ctx | null>(null);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CalculatorState>(DEFAULT_STATE);
  const value = useMemo<Ctx>(
    () => ({
      state,
      set: (k, v) => setState((s) => ({ ...s, [k]: v })),
      reset: () => setState(DEFAULT_STATE),
    }),
    [state]
  );
  return <CalculatorContext.Provider value={value}>{children}</CalculatorContext.Provider>;
}

export function useCalculator() {
  const ctx = useContext(CalculatorContext);
  if (!ctx) throw new Error("useCalculator deve ser usado dentro de CalculatorProvider");
  return ctx;
}
