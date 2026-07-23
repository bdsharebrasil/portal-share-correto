import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Plane, Calendar, Fuel, Receipt, TrendingDown } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface OverdueItem {
  id: string;
  source: "movimentacao" | "abastecimento";
  descricao: string;
  valor: number;
  data_vencimento: string;
  aeronave_id: string | null;
  aeronave_matricula: string | null;
  diasAtraso: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function OverdueExpensesPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = format(new Date(), "yyyy-MM-dd");

        const [aircraftRes, movRes, abastRes] = await Promise.all([
          supabase.from("aeronave").select("id, matricula"),
          supabase
            .from("movimentacoes")
            .select("id, descricao, valor, data_vencimento, aeronave_id, status, tipo")
            .in("tipo", ["despesa", "saida"])
            .in("status", ["pendente", "parcial", "atrasado"])
            .not("data_vencimento", "is", null)
            .order("data_vencimento", { ascending: true })
            .limit(200),
          supabase
            .from("abastecimentos")
            .select("id, descricao, valor_total, data_vencimento_boleto, data, aeronave_id, status_pagamento, local, trecho")
            .or("status_pagamento.is.null,status_pagamento.eq.em_aberto,status_pagamento.eq.em aberto,status_pagamento.eq.pendente,status_pagamento.eq.atrasado")
            .order("data", { ascending: true })
            .limit(200),
        ]);

        const aircraftMap = new Map<string, string>();
        (aircraftRes.data || []).forEach((a: any) => aircraftMap.set(a.id, a.matricula));

        const now = new Date();
        const list: OverdueItem[] = [];

        (movRes.data || []).forEach((m: any) => {
          const venc = m.data_vencimento as string;
          list.push({
            id: m.id,
            source: "movimentacao",
            descricao: m.descricao || "Despesa sem descrição",
            valor: Number(m.valor) || 0,
            data_vencimento: venc,
            aeronave_id: m.aeronave_id,
            aeronave_matricula: m.aeronave_id ? aircraftMap.get(m.aeronave_id) || null : null,
            diasAtraso: differenceInDays(now, parseISO(venc)),
          });
        });

        (abastRes.data || []).forEach((a: any) => {
          const venc = (a.data_vencimento_boleto || a.data) as string;
          if (!venc) return;
          list.push({
            id: a.id,
            source: "abastecimento",
            descricao: a.descricao || `Abastecimento ${a.local || ""} ${a.trecho || ""}`.trim(),
            valor: Number(a.valor_total) || 0,
            data_vencimento: venc,
            aeronave_id: a.aeronave_id,
            aeronave_matricula: a.aeronave_id ? aircraftMap.get(a.aeronave_id) || null : null,
            diasAtraso: differenceInDays(now, parseISO(venc)),
          });
        });

        setItems(list);
      } catch (err) {
        console.error("Erro ao carregar despesas vencidas:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const { buckets, porAeronave, totalVencido, totalAVencer } = useMemo(() => {
    const buckets = {
      atrasado: [] as OverdueItem[],
      d7: [] as OverdueItem[],
      d15: [] as OverdueItem[],
      d30: [] as OverdueItem[],
      futuro: [] as OverdueItem[],
    };

    items.forEach((it) => {
      const d = it.diasAtraso;
      if (d > 0) buckets.atrasado.push(it);
      else if (d >= -7) buckets.d7.push(it);
      else if (d >= -15) buckets.d15.push(it);
      else if (d >= -30) buckets.d30.push(it);
      else buckets.futuro.push(it);
    });

    const porAeronaveMap = new Map<
      string,
      { matricula: string; count: number; total: number; vencido: number }
    >();

    items.forEach((it) => {
      const key = it.aeronave_matricula || "Sem aeronave";
      const cur = porAeronaveMap.get(key) || { matricula: key, count: 0, total: 0, vencido: 0 };
      cur.count += 1;
      cur.total += it.valor;
      if (it.diasAtraso > 0) cur.vencido += it.valor;
      porAeronaveMap.set(key, cur);
    });

    const porAeronave = Array.from(porAeronaveMap.values()).sort((a, b) => b.vencido - a.vencido || b.total - a.total);

    const totalVencido = buckets.atrasado.reduce((s, i) => s + i.valor, 0);
    const totalAVencer =
      buckets.d7.reduce((s, i) => s + i.valor, 0) +
      buckets.d15.reduce((s, i) => s + i.valor, 0) +
      buckets.d30.reduce((s, i) => s + i.valor, 0);

    return { buckets, porAeronave, totalVencido, totalAVencer };
  }, [items]);

  const timelineData = [
    { key: "atrasado", label: "Atrasado", items: buckets.atrasado, color: "red", icon: AlertTriangle },
    { key: "d7", label: "Próx. 7 dias", items: buckets.d7, color: "orange", icon: Calendar },
    { key: "d15", label: "8–15 dias", items: buckets.d15, color: "amber", icon: Calendar },
    { key: "d30", label: "16–30 dias", items: buckets.d30, color: "yellow", icon: Calendar },
  ];

  const maxBucketCount = Math.max(1, ...timelineData.map((b) => b.items.length));

  const colorClasses: Record<string, { text: string; bg: string; border: string; bar: string }> = {
    red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", bar: "bg-red-500" },
    orange: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", bar: "bg-orange-500" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", bar: "bg-amber-500" },
    yellow: { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", bar: "bg-yellow-500" },
  };

  if (loading) {
    return (
      <div className="rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse h-64" />
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header + KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-red-400 font-semibold">Vencido</span>
          </div>
          <p className="text-2xl font-bold text-red-400 tracking-tight">{formatCurrency(totalVencido)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {buckets.atrasado.length} lançamento(s) em atraso
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20">
              <Calendar className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">A Vencer (30d)</span>
          </div>
          <p className="text-2xl font-bold text-amber-400 tracking-tight">{formatCurrency(totalAVencer)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {buckets.d7.length + buckets.d15.length + buckets.d30.length} lançamento(s) programado(s)
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/20">
              <TrendingDown className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">Aeronaves Afetadas</span>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">
            {porAeronave.filter((a) => a.vencido > 0).length}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            de {porAeronave.length} com pendências
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Timeline / Mapa de Vencimentos */}
        <div className="lg:col-span-3 rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm md:text-base">Mapa de Vencimentos</h3>
                <p className="text-[11px] text-muted-foreground">Movimentações e abastecimentos por prazo</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {timelineData.map((b) => {
              const c = colorClasses[b.color];
              const total = b.items.reduce((s, i) => s + i.valor, 0);
              const widthPct = (b.items.length / maxBucketCount) * 100;
              return (
                <div key={b.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <b.icon className={cn("h-3.5 w-3.5", c.text)} />
                      <span className={cn("font-medium", c.text)}>{b.label}</span>
                      <span className="text-muted-foreground">· {b.items.length} item(ns)</span>
                    </div>
                    <span className={cn("font-semibold tabular-nums", c.text)}>{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", c.bar)}
                      style={{ width: `${Math.max(widthPct, b.items.length > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lista compacta dos mais críticos */}
          {buckets.atrasado.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/[0.05]">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Top vencidos
              </p>
              <div className="space-y-2">
                {buckets.atrasado
                  .slice()
                  .sort((a, b) => b.diasAtraso - a.diasAtraso)
                  .slice(0, 4)
                  .map((item) => (
                    <button
                      key={`${item.source}-${item.id}`}
                      onClick={() =>
                        navigate(item.source === "abastecimento" ? "/abastecimento" : "/financeiro/movimentacoes")
                      }
                      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-red-500/10 hover:border-red-500/30 hover:bg-red-500/[0.03] transition-all text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.source === "abastecimento" ? (
                          <Fuel className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                        ) : (
                          <Receipt className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.descricao}</p>
                          <p className="text-[10px] text-red-400/80">
                            {item.aeronave_matricula ? `${item.aeronave_matricula} · ` : ""}
                            {item.diasAtraso} dia(s) em atraso
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-red-400 flex-shrink-0 tabular-nums">
                        {formatCurrency(item.valor)}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Vencidas por Aeronave */}
        <div className="lg:col-span-2 rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Plane className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm md:text-base">Vencidas por Aeronave</h3>
                <p className="text-[11px] text-muted-foreground">Ranking por valor em atraso</p>
              </div>
            </div>
          </div>

          {porAeronave.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-white/[0.1] rounded-lg">
              <p className="text-xs text-muted-foreground">Nenhuma pendência encontrada.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[320px] overflow-auto pr-1">
              {porAeronave.slice(0, 8).map((a) => {
                const isOverdue = a.vencido > 0;
                return (
                  <div
                    key={a.matricula}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-lg border transition-all",
                      isOverdue
                        ? "bg-red-500/[0.03] border-red-500/15 hover:border-red-500/30"
                        : "bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "p-1.5 rounded-md border flex-shrink-0",
                          isOverdue ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.03] border-white/[0.08]"
                        )}
                      >
                        <Plane className={cn("h-3.5 w-3.5", isOverdue ? "text-red-400" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{a.matricula}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.count} lançamento(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {isOverdue ? (
                        <>
                          <p className="text-xs font-bold text-red-400 tabular-nums">
                            {formatCurrency(a.vencido)}
                          </p>
                          <Badge variant="outline" className="text-[9px] mt-0.5 bg-red-500/10 text-red-400 border-red-500/20 px-1.5 py-0">
                            vencido
                          </Badge>
                        </>
                      ) : (
                        <p className="text-xs font-medium text-muted-foreground tabular-nums">
                          {formatCurrency(a.total)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
