import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Fuel, ArrowUpRight, Clock } from "lucide-react";

const db = supabase as any;

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Aviso no dashboard financeiro: abastecimentos gerados no checklist de pré-voo
 * que ainda estão pendentes de conclusão financeira.
 */
export function AbastecimentosPendentesAlert() {
  const navigate = useNavigate();

  const { data: pendentes = [] } = useQuery({
    queryKey: ["abastecimentos-pendentes-pre-voo"],
    queryFn: async () => {
      const { data: checklists, error } = await db
        .from("checklists_pre_voo")
        .select("abastecimento_id")
        .not("abastecimento_id", "is", null);
      if (error) return [];
      const ids = (checklists || []).map((c: any) => c.abastecimento_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data } = await db
        .from("abastecimentos")
        .select("id, trecho, data, valor_total, status, tipo_faturamento, prazo, clientes:id_clientes(razao_social)")
        .in("id", ids)
        .neq("status", "pago")
        .order("data", { ascending: false });
      return (data || []) as any[];
    },
    refetchInterval: 60_000,
  });

  if (pendentes.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 backdrop-blur-md md:rounded-2xl md:p-5">
      <div className="flex items-start gap-3 md:gap-4">
        <div className="flex-shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 md:rounded-xl md:p-3">
          <Fuel className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold uppercase tracking-wide text-amber-400">
            Abastecimentos aguardando conclusão financeira
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {pendentes.length} abastecimento(s) registrados no checklist de pré-voo precisam de programação de pagamento.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pendentes.slice(0, 4).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate("/financeiro/agendamento-contas", { state: { abastecimentoId: a.id } })}
                className="group rounded-xl border border-amber-500/10 bg-white/[0.02] p-3 text-left transition-all hover:border-amber-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium uppercase text-foreground group-hover:text-amber-400">
                      {a.trecho || "Trecho —"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {a.clientes?.razao_social || "Cliente —"} · {brl(a.valor_total)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] uppercase text-amber-400">
                    <Clock className="h-3 w-3" /> {a.status || "pendente"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate("/abastecimento")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 px-3 py-1.5 text-xs font-semibold uppercase text-amber-400 transition-colors hover:bg-amber-500/10"
          >
            Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
