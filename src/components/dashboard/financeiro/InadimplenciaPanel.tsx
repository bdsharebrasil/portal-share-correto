import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, User, Wallet, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInadimplencia } from "@/hooks/useInadimplencia";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function InadimplenciaPanel() {
  const navigate = useNavigate();
  const { data: items, resumo, isLoading } = useInadimplencia();

  // Estados para controlar o recolhimento (accordion)
  const [criticosExpanded, setCriticosExpanded] = useState(false);
  const [clientesExpanded, setClientesExpanded] = useState(false);

  const { porCliente, topVencidos } = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; total: number; despesaDireta: number; aReceber: number }>();

    items.forEach((it) => {
      const key = it.cliente_id || it.cliente_nome;
      const cur = map.get(key) || { nome: it.cliente_nome, count: 0, total: 0, despesaDireta: 0, aReceber: 0 };
      cur.count += 1;
      cur.total += it.valor;
      if (it.origem === "despesa_cliente_direta") cur.despesaDireta += it.valor;
      else cur.aReceber += it.valor;
      map.set(key, cur);
    });

    const porCliente = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const topVencidos = items.slice().sort((a, b) => b.dias_atraso - a.dias_atraso).slice(0, 5);

    return { porCliente, topVencidos };
  }, [items]);

  if (isLoading) {
    return (
      <div className="rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse h-64" />
    );
  }

  return (
    <div className="ml-[19px] mr-[30px] mt-[39px] space-y-4 px-[22px] py-[20px] md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-red-400 font-semibold">Total em Atraso</span>
          </div>
          <p className="text-2xl font-bold text-red-400 tracking-tight">{formatCurrency(resumo.totalEmAtraso)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{items.length} item(ns) vencido(s)</p>
        </div>

        <div className="rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-500/15 border border-orange-500/20">
              <Wallet className="h-4 w-4 text-orange-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-orange-400 font-semibold">Despesa Direta (Caixa Cliente)</span>
          </div>
          <p className="text-2xl font-bold text-orange-400 tracking-tight">{formatCurrency(resumo.totalDespesasDiretas)}</p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/20">
              <Receipt className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">A Receber pela Share</span>
          </div>
          <p className="text-2xl font-bold text-blue-400 tracking-tight">{formatCurrency(resumo.totalAReceber)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Top vencidos */}
        <div className="lg:col-span-3 rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-md transition-all">
          <div 
            className="flex items-center justify-between cursor-pointer select-none group"
            onClick={() => setCriticosExpanded(!criticosExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm md:text-base">Mais Críticos</h3>
                <p className="text-[11px] text-muted-foreground">Ordenado por dias em atraso</p>
              </div>
            </div>
            <div className="p-2 text-muted-foreground group-hover:text-foreground transition-colors">
              {criticosExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>

          {criticosExpanded && (
            <div className="mt-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {topVencidos.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-white/[0.1] rounded-lg">
                  <p className="text-xs text-muted-foreground">Nenhuma inadimplência encontrada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topVencidos.map((item) => (
                    <button
                      key={`${item.origem}-${item.id}`}
                      onClick={() => navigate("/portal-cliente", { state: { clientId: item.cliente_id } })}
                      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-red-500/10 hover:border-red-500/30 hover:bg-red-500/[0.03] transition-all text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.origem === "despesa_cliente_direta" ? (
                          <Wallet className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                        ) : (
                          <Receipt className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {item.descricao || item.cliente_nome}
                          </p>
                          <p className="text-[10px] text-red-400/80">
                            {item.cliente_nome} · {item.dias_atraso} dia(s) em atraso
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-red-400 flex-shrink-0 tabular-nums">
                        {formatCurrency(item.valor)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ranking por cliente */}
        <div className="lg:col-span-2 rounded-xl md:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-md transition-all">
          <div 
            className="flex items-center justify-between cursor-pointer select-none group"
            onClick={() => setClientesExpanded(!clientesExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
                <User className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm md:text-base">Inadimplência por Cliente</h3>
                <p className="text-[11px] text-muted-foreground">Ranking por valor total em atraso</p>
              </div>
            </div>
            <div className="p-2 text-muted-foreground group-hover:text-foreground transition-colors">
              {clientesExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </div>

          {clientesExpanded && (
            <div className="mt-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {porCliente.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-white/[0.1] rounded-lg">
                  <p className="text-xs text-muted-foreground">Nenhum cliente inadimplente.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-auto pr-1">
                  {porCliente.slice(0, 8).map((c) => (
                    <div
                      key={c.nome}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-red-500/[0.03] border-red-500/15 hover:border-red-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-1.5 rounded-md border bg-red-500/10 border-red-500/20 flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{c.count} lançamento(s)</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-red-400 tabular-nums">{formatCurrency(c.total)}</p>
                        <Badge
                          variant="outline"
                          className="text-[9px] mt-0.5 bg-red-500/10 text-red-400 border-red-500/20 px-1.5 py-0"
                        >
                          vencido
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
