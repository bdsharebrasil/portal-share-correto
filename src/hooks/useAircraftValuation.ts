import { useCallback, useState } from "react";
import { API_ENDPOINTS } from "@/config/api";
import { supabase } from "@/integrations/supabase/client";

export interface ValuationUncertaintyInterval {
  lower: number;
  upper: number;
}

export interface ValuationUncertaintyPrimary extends ValuationUncertaintyInterval {
  confidence?: string;
}

export interface ValuationUncertainty {
  intervals?: Record<string, ValuationUncertaintyInterval>;
  primary?: ValuationUncertaintyPrimary;
}

export interface ValuationKeyDriver {
  category: string;
  contribution: number;
  pct_of_adjustment?: number;
  direction?: "positive" | "negative";
}

export interface ValuationResult {
  estimated_market_value: number;
  confidence?: number | null;
  uncertainty?: ValuationUncertainty | null;
  as_of?: string | null;
  valuation_mode?: string | null;
  explanation_summary?: string | null;
  key_drivers?: ValuationKeyDriver[] | null;
  base_value?: number | null;
  total_adjustment?: number | null;
  updated_at?: string;
  query?: Record<string, unknown>;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Falha ao consultar a avaliação da aeronave");
  return json as T;
}

/** Avaliação de uma aeronave da frota (usa dados do cadastro). */
export function useAircraftValuation() {
  const [results, setResults] = useState<Record<string, ValuationResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const valuate = useCallback(
    async (aircraft: {
      id: string;
      registration?: string | null;
      serial_number?: string | null;
      model?: string | null;
      year?: number | null;
      cell_hours_current?: number | null;
    }) => {
      setLoadingId(aircraft.id);
      setErrors((prev) => ({ ...prev, [aircraft.id]: "" }));
      try {
        const data = await postJson<ValuationResult>(API_ENDPOINTS.aircraftValuation, aircraft);
        setResults((prev) => ({ ...prev, [aircraft.id]: data }));
        return data;
      } catch (err: any) {
        setErrors((prev) => ({ ...prev, [aircraft.id]: err.message }));
        return null;
      } finally {
        setLoadingId(null);
      }
    },
    []
  );

  return { results, errors, loadingId, valuate };
}

/** Estimativa livre pelo catálogo FAA (modelo/ano/horas ou matrícula N-number). */
export function useUsMarketEstimate() {
  const [data, setData] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const estimate = useCallback(
    async (input: { model?: string; year?: number; hours?: number; registration?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await postJson<ValuationResult>(API_ENDPOINTS.usAircraftEstimate, input);
        setData(res);
        return res;
      } catch (err: any) {
        setError(err.message);
        setData(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, error, loading, estimate };
}