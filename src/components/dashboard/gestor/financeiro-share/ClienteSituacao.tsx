import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  WalletCards,
  Edit2,
  Trash2,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Calculator,
  Paperclip,
  Eye,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  CLIENTE_DGA_ID,
  classify,
  clienteDividaLabel,
  dateOf,
  fornecedorStatus,
  paidByShareForClient,
  valueOf,
} from "@/utils/financeiroRules";
import { useClienteFinanceiro } from "@/hooks/useClienteFinanceiro";
import { supabase } from "@/integrations/supabase/client";

// Importação do Modal conforme solicitado
import EditCaixaClienteModal from "@/components/dashboard/gestor/financeiro-share/EditCaixaClienteModal";
import AttachmentViewerModal from "@/components/dashboard/gestor/financeiro-share/AttachmentViewerModal";

export default function ClienteSituacao({
  clientes,
  movimentacoes,
  rateios = [],
  onRefresh,
  mesSelecionado,
  onMesSelecionadoChange,
}: {
  clientes: any[];
  movimentacoes: any[];
  rateios?: any[];
  onRefresh?: () => Promise<void> | void;
  mesSelecionado?: string;
  onMesSelecionadoChange?: (mes: string) => void;
}) {
  const [clienteId, setClienteId] = useState<string>(() => {
    try { return sessionStorage.getItem("financeiro-share:caixa-cliente") || ""; } catch { return ""; }
  });
  const [mesInterno, setMesInterno] = useState("");
  const mes = mesSelecionado ?? mesInterno;
  const setMes = (valor: string) => {
    if (onMesSelecionadoChange) onMesSelecionadoChange(valor);
    else setMesInterno(valor);
  };
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<"data" | "valor" | "descricao" | "fornecedor" | "status">("data");
  const [showEvolucao, setShowEvolucao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [editMov, setEditMov] = useState<any>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [attachment, setAttachment] = useState<{ url: string; title: string } | null>(null);

  const { movimentos, mensal, resumo } = useClienteFinanceiro(
    movimentacoes,
    clienteId || null
  );
  
  const cliente = clientes.find((c) => c.id === clienteId);

  useEffect(() => {
    try {
      if (clienteId) sessionStorage.setItem("financeiro-share:caixa-cliente", clienteId);
      else sessionStorage.removeItem("financeiro-share:caixa-cliente");
    } catch { /* storage indisponível não deve impedir o uso do caixa */ }
  }, [clienteId]);

  const alterarCliente = (value: string) => {
    setClienteId(value);
    setSelecionados([]);
    setExpandidos(new Set());
  };
  const meses = useMemo(() => Array.from(new Set(mensal.map((m) => m.periodo))).sort().reverse(), [mensal]);
  
  const categorias = useMemo(() => {
    return Array.from(new Set(movimentos.map((m) => m.categoria_nome).filter(Boolean))).sort();
  }, [movimentos]);

  const rateiosPorDespesa = useMemo(() => {
    const map = new Map<string, any[]>();
    rateios.forEach((rateio: any) => {
      const key = rateio.despesa_id || rateio.movimentacao_id;
      if (!key) return;
      map.set(key, [...(map.get(key) || []), rateio]);
    });
    return map;
  }, [rateios]);

  const anexosDe = (m: any) => {
    const anexos = [
      [m.comprovante_url, "Comprovante"],
      [m.nf_url, m.numero_nf ? `Nota fiscal ${m.numero_nf}` : "Nota fiscal"],
      [m.boleto_url, m.numero_boleto ? `Boleto ${m.numero_boleto}` : "Boleto"],
      [m.recibo_url, m.numero_recibo ? `Recibo ${m.numero_recibo}` : "Recibo"],
      [m.comanda_url, "Comanda"],
    ]
      .filter(([url]) => Boolean(url))
      .map(([url, title]) => ({ url: String(url), title: String(title) }));
    if (Array.isArray(m.anexos)) {
      m.anexos.forEach((item: any, index: number) => {
        const url = typeof item === "string" ? item : item?.url;
        if (url) anexos.push({ url, title: item?.nome || item?.name || `Anexo ${index + 1}` });
      });
    }
    return anexos;
  };

  const ordenarPor = (field: typeof sortField) => {
    if (sortField === field) setSortOrder((current) => current === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };

  const alternarExpandido = (id: string) => {
    setExpandidos((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const lista = useMemo(() => {
    let filtrado = movimentos
      .filter((m) => (!mes || String(dateOf(m) || "").slice(0, 7) === mes))
      .filter((m) => (!busca || `${m.descricao || ""} ${m.fornecedor_nome || ""} ${m.numero_doc || ""}`.toLowerCase().includes(busca.toLowerCase())))
      .filter((m) => (!categoriaFiltro || m.categoria_nome === categoriaFiltro));

    filtrado.sort((a, b) => {
      let valA, valB;
      if (sortField === "data") {
        valA = a.data_pagamento || a.data_vencimento || dateOf(a) || "";
        valB = b.data_pagamento || b.data_vencimento || dateOf(b) || "";
      } else if (sortField === "valor") {
        valA = valueOf(a);
        valB = valueOf(b);
      } else if (sortField === "descricao") {
        valA = String(a.descricao || "").toLowerCase();
        valB = String(b.descricao || "").toLowerCase();
      } else if (sortField === "fornecedor") {
        valA = String(a.fornecedor_nome || "").toLowerCase();
        valB = String(b.fornecedor_nome || "").toLowerCase();
      } else {
        valA = String(fornecedorStatus(a) || "").toLowerCase();
        valB = String(fornecedorStatus(b) || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtrado;
  }, [movimentos, mes, busca, categoriaFiltro, sortField, sortOrder]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelecionados(lista.map((m) => m.id));
    else setSelecionados([]);
  };

  const handleSelect = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const somaSelecionados = useMemo(() => {
    return lista
      .filter((m) => selecionados.includes(m.id))
      .reduce((acc, m) => acc + valueOf(m), 0);
  }, [lista, selecionados]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.")) return;
    try {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
      alert("Lançamento excluído com sucesso!");
      await onRefresh?.();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const renderData = (m: any) => {
    const d = m.data_pagamento || m.data_vencimento || dateOf(m);
    const tipo = m.data_pagamento ? "Pagamento" : m.data_vencimento ? "Vencimento" : "Emissão";
    if (!d) return "—";
    return (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">
          {new Date(d + "T00:00:00").toLocaleDateString("pt-BR")}
        </span>
        <span className="text-[9px] uppercase text-muted-foreground tracking-wider">
          {tipo}
        </span>
      </div>
    );
  };

  if (!clienteId)
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-12 text-center backdrop-blur-sm">
        <WalletCards className="mx-auto h-12 w-12 text-cyan-500/60" />
        <h3 className="mt-4 text-xl font-bold text-foreground">Situação do Cliente</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecione um cliente para abrir a conta corrente financeira.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <select
            value={clienteId}
            onChange={(e) => alterarCliente(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="">Selecione um cliente...</option>
            {clientes.filter((c) => c.id !== CLIENTE_DGA_ID).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* HEADER & FILTROS GLOBAIS */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-card/40 p-5 border border-white/5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/80 mb-1">
            Cliente selecionado
          </div>
          <div className="text-2xl font-bold text-foreground">{cliente?.nome}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={clienteId}
            onChange={(e) => alterarCliente(e.target.value)}
            className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-cyan-500"
          >
            <option value="">Trocar cliente</option>
            {clientes.filter((c) => c.id !== CLIENTE_DGA_ID).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-cyan-500"
          >
            <option value="">Todos os meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Despesas" value={resumo.despesas} tone="text-foreground" />
        <Kpi label="Share antecipou" value={resumo.sharePagou} tone="text-amber-400" />
        <Kpi label="Cliente pagou direto" value={resumo.clientePagouDireto} tone="text-blue-400" />
        <Kpi label="Cliente pagou Share" value={resumo.recebidoShare} tone="text-emerald-400" />
        <Kpi label="Em aberto" value={resumo.aberto} tone="text-rose-400" />
      </div>

      {/* EVOLUÇÃO MENSAL (RECOLHÍVEL) */}
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden shadow-lg backdrop-blur-sm">
        <div 
          className="flex cursor-pointer items-center justify-between border-b border-border p-4 hover:bg-card-secondary/30 transition"
          onClick={() => setShowEvolucao(!showEvolucao)}
        >
          <div>
            <div className="font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-500" /> Evolução mensal
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              A dívida acumulada considera apenas despesas do cliente pagas antecipadamente pela Share.
            </div>
          </div>
          <button className="text-muted-foreground hover:text-white">
            {showEvolucao ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showEvolucao && (
          <div className="overflow-x-auto bg-background/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-5 py-3.5">Mês</th>
                  <th className="text-right px-5 py-3.5">Despesas</th>
                  <th className="text-right px-5 py-3.5">Share pagou</th>
                  <th className="text-right px-5 py-3.5">Direto</th>
                  <th className="text-right px-5 py-3.5">Recebido</th>
                  <th className="text-right px-5 py-3.5">Aberto</th>
                </tr>
              </thead>
              <tbody>
                {mensal.map((r) => (
                  <tr key={r.periodo} className="border-b border-border/50 hover:bg-card-secondary/20 transition">
                    <td className="px-5 py-3 font-semibold text-muted-foreground">{r.periodo}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{formatBRL(r.despesas)}</td>
                    <td className="px-5 py-3 text-right text-amber-400/90">{formatBRL(r.sharePagou)}</td>
                    <td className="px-5 py-3 text-right text-blue-400/90">{formatBRL(r.clientePagouDireto)}</td>
                    <td className="px-5 py-3 text-right text-emerald-400/90">{formatBRL(r.recebidoShare)}</td>
                    <td className="px-5 py-3 text-right font-bold text-rose-400/90">{formatBRL(r.aberto)}</td>
                  </tr>
                ))}
                {mensal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">Nenhum dado mensal encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXTRATO E FERRAMENTAS */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xl">
        <div className="border-b border-border/80 bg-card/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Conta corrente do cliente</div>
              <div className="mt-1 text-sm font-semibold text-foreground">Despesas, pagamentos e reembolsos em uma única visão</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              {lista.filter((item) => paidByShareForClient(item) && fornecedorStatus(item) !== "pago").length} reembolso(s) em aberto
            </div>
          </div>
        </div>
        
        {/* Barra de Ferramentas */}
        <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-bold text-foreground">Extrato do cliente</div>
            <div className="text-[11px] text-muted-foreground mt-1">Gerencie, filtre e some lançamentos específicos</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar despesa..."
                className="w-full min-w-[200px] rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500 appearance-none"
              >
                <option value="">Todas as categorias</option>
                {categorias.map((c: any) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Ordenar por:</span>
              <select 
                value={sortField} 
                onChange={e => setSortField(e.target.value as any)} 
                className="bg-transparent text-sm text-foreground outline-none"
              >
                <option value="data">Data</option>
                <option value="valor">Valor</option>
              </select>
              <button 
                onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}
                className="p-1 text-muted-foreground hover:text-cyan-400 transition bg-card-secondary rounded-md"
                title="Inverter ordem"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Barra Flutuante de Seleção (Aparece se houver selecionados) */}
        {selecionados.length > 0 && (
          <div className="flex items-center justify-between bg-cyan-900/30 px-5 py-3 border-b border-cyan-800/50">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold text-cyan-100">{selecionados.length} selecionado(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-cyan-300/70">Soma total</span>
              <span className="text-lg font-bold text-cyan-400 bg-cyan-950 px-3 py-1 rounded-lg border border-cyan-800/50 shadow-inner">
                {formatBRL(somaSelecionados)}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto bg-background">
          <table className="min-w-[1080px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-4"><input type="checkbox" checked={selecionados.length === lista.length && lista.length > 0} onChange={handleSelectAll} className="h-4 w-4 rounded border-border bg-card accent-cyan-500" aria-label="Selecionar todos" /></th>
                <th className="w-8 px-1 py-4"></th>
                <SortableHeader label="Data" active={sortField === "data"} order={sortOrder} onClick={() => ordenarPor("data")} />
                <SortableHeader label="Descrição" active={sortField === "descricao"} order={sortOrder} onClick={() => ordenarPor("descricao")} />
                <SortableHeader label="Fornecedor" active={sortField === "fornecedor"} order={sortOrder} onClick={() => ordenarPor("fornecedor")} />
                <SortableHeader label="Valor" active={sortField === "valor"} order={sortOrder} onClick={() => ordenarPor("valor")} align="right" />
                <th className="px-4 py-4 text-center">Fluxo Cliente</th>
                <SortableHeader label="Status" active={sortField === "status"} order={sortOrder} onClick={() => ordenarPor("status")} align="center" />
                <th className="px-4 py-4 text-center">Anexos</th>
                <th className="px-4 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => {
                const isSelected = selecionados.includes(m.id);
                const expandido = expandidos.has(m.id);
                const rateioItens = rateiosPorDespesa.get(m.id) || [];
                const anexos = anexosDe(m);
                return (
                  <Fragment key={m.id}>
                    <tr
                      onClick={() => alternarExpandido(m.id)}
                      className={`cursor-pointer border-b border-border/70 transition-colors ${
                        isSelected ? "bg-cyan-500/10" : expandido ? "bg-card-secondary/45" : "hover:bg-card-secondary/25"
                      }`}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(m.id)}
                          className="h-4 w-4 rounded border-border bg-card accent-cyan-500"
                        />
                      </td>
                      <td className="px-1 py-3.5 text-muted-foreground">
                        {expandido ? <ChevronDown className="h-4 w-4 text-cyan-400" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">{renderData(m)}</td>
                      <td className="max-w-[310px] px-4 py-3.5">
                        <div className="truncate font-semibold text-foreground">{m.descricao || "—"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <span>{m.categoria_nome || "Sem Categoria"}</span>
                          {m.numero_nf && <span className="rounded bg-card-secondary px-1.5 py-0.5 normal-case tracking-normal">NF {m.numero_nf}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{m.fornecedor_nome || "—"}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-foreground">{formatBRL(valueOf(m))}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-3 tracking-wide ${paidByShareForClient(m) ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-blue-500/20 bg-blue-500/10 text-blue-400"}`}>
                          {clienteDividaLabel(m) === "Deve à Share" ? "Reembolso pendente" : clienteDividaLabel(m)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${fornecedorStatus(m) === "pago" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"}`}>
                          {fornecedorStatus(m)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {anexos.length > 0 ? (
                          <button onClick={() => setAttachment(anexos[0])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-cyan-300 hover:bg-cyan-500/10" title="Abrir anexo no modal">
                            <Paperclip className="h-3.5 w-3.5" /><span className="text-[10px] font-semibold">{anexos.length}</span>
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setEditMov(m)} className="mr-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-cyan-500/10 hover:text-cyan-400" title="Editar lançamento"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(m.id)} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400" title="Excluir lançamento"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-border/50 bg-background/45">
                        <td colSpan={10} className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Detalhamento da despesa</div>
                              <div className="mt-1 text-xs text-muted-foreground">Todas as informações registradas para este lançamento.</div>
                            </div>
                            {anexos.length > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-300"><Paperclip className="h-3 w-3" /> {anexos.length} anexo(s)</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                            <DetailItem label="Valor lançado" value={formatBRL(valueOf(m))} strong />
                            <DetailItem label="Valor rateado" value={m.valor_rateado != null ? formatBRL(Number(m.valor_rateado)) : "—"} />
                            <DetailItem label="Valor pago real" value={m.valor_pago_real != null ? formatBRL(Number(m.valor_pago_real)) : "—"} />
                            <DetailItem label="Valor total" value={m.valor_total != null ? formatBRL(Number(m.valor_total)) : "—"} />
                            <DetailItem label="Quem pagou" value={m.pago_por || m.socios_nome || "—"} />
                            <DetailItem label="Tipo de rateio" value={m.tipo_rateio || "—"} />
                            <DetailItem label="Periodicidade" value={m.periodicidade || "—"} />
                            <DetailItem label="Percentual de uso" value={m.percentual_uso != null ? `${m.percentual_uso}%` : "—"} />
                            <DetailItem label="Percentual sociedade" value={m.percentual_sociedade != null ? `${m.percentual_sociedade}%` : "—"} />
                            <DetailItem label="Forma de pagamento" value={m.forma_pagamento || "—"} />
                            <DetailItem label="Número do documento" value={m.numero_doc || m.numero_nf || m.numero_boleto || "—"} />
                            <DetailItem label="Vencimento" value={m.data_vencimento ? new Date(`${m.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
                            <DetailItem label="Pagamento" value={m.data_pagamento ? new Date(`${m.data_pagamento}T00:00:00`).toLocaleDateString("pt-BR") : "—"} />
                            <DetailItem label="Status" value={m.status || fornecedorStatus(m)} />
                            <DetailItem label="Observações" value={m.observacoes || m.observacao || "—"} />
                          </div>
                          {rateioItens.length > 0 && (
                            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card/45">
                              <div className="border-b border-border px-4 py-3 text-[10px] font-black uppercase tracking-wider text-cyan-300">Composição do rateio</div>
                              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2.5">Cotista / referência</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5 text-right">Percentual</th><th className="px-4 py-2.5 text-right">Valor</th><th className="px-4 py-2.5">Status</th></tr></thead><tbody>{rateioItens.map((rateio: any, index: number) => <tr key={rateio.id || index} className="border-b border-border/50 last:border-0"><td className="px-4 py-2.5 text-foreground">{rateio.socio_nome || rateio.socios_nome || rateio.nome_socio || rateio.socio_id || "Rateio"}</td><td className="px-4 py-2.5 text-muted-foreground">{rateio.tipo_rateio || rateio.periodicidade || "—"}</td><td className="px-4 py-2.5 text-right text-muted-foreground">{rateio.percentual_sociedade ?? rateio.percentual_uso ?? rateio.percentual != null ? `${rateio.percentual_sociedade ?? rateio.percentual_uso ?? rateio.percentual}%` : "—"}</td><td className="px-4 py-2.5 text-right font-semibold text-foreground">{rateio.valor_rateado != null ? formatBRL(Number(rateio.valor_rateado)) : rateio.valor != null ? formatBRL(Number(rateio.valor)) : "—"}</td><td className="px-4 py-2.5 text-muted-foreground">{rateio.status || "—"}</td></tr>)}</tbody></table></div>
                            </div>
                          )}
                          {anexos.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{anexos.map((anexo) => <button key={anexo.url} onClick={() => setAttachment(anexo)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground transition hover:border-cyan-500/50 hover:bg-cyan-500/10"><Eye className="h-3.5 w-3.5 text-cyan-300" />{anexo.title}</button>)}</div>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground bg-background/30">
            <Calculator className="mx-auto h-8 w-8 opacity-20 mb-3" />
            Nenhum lançamento encontrado para os filtros selecionados.
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editMov && (
        <EditCaixaClienteModal
          movId={editMov.id}
          mov={editMov}
          onClose={() => setEditMov(null)}
          onSaved={async () => {
            setEditMov(null);
            await onRefresh?.();
          }}
        />
      )}
      {attachment && <AttachmentViewerModal url={attachment.url} title={attachment.title} onClose={() => setAttachment(null)} />}
    </div>
  );
}

function SortableHeader({ label, active, order, onClick, align = "left" }: { label: string; active: boolean; order: "asc" | "desc"; onClick: () => void; align?: "left" | "center" | "right" }) {
  return (
    <th className={`px-4 py-4 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 font-black transition hover:text-cyan-300">
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-cyan-400" : "text-muted-foreground"}`} />
        {active && <span className="sr-only">Ordenação {order === "asc" ? "crescente" : "decrescente"}</span>}
      </button>
    </th>
  );
}

function DetailItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-h-[58px] rounded-xl border border-border bg-card/55 px-3 py-2.5">
      <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 break-words text-xs ${strong ? "font-black text-cyan-300" : "font-medium text-foreground"}`}>{value}</div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-black ${tone}`}>
        {formatBRL(value)}
      </div>
    </div>
  );
}
