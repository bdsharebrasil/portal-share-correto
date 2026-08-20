import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Search,
  WalletCards,
  Edit2,
  Trash2,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Calculator
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

export default function ClienteSituacao({
  clientes,
  movimentacoes,
  onRefresh,
}: {
  clientes: any[];
  movimentacoes: any[];
  onRefresh?: () => Promise<void> | void;
}) {
  const [clienteId, setClienteId] = useState<string>("");
  const [mes, setMes] = useState("");
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortField, setSortField] = useState<"data" | "valor">("data");
  const [showEvolucao, setShowEvolucao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [editMov, setEditMov] = useState<any>(null);

  const { movimentos, mensal, resumo } = useClienteFinanceiro(
    movimentacoes,
    clienteId || null
  );
  
  const cliente = clientes.find((c) => c.id === clienteId);
  const meses = useMemo(() => Array.from(new Set(mensal.map((m) => m.periodo))).sort().reverse(), [mensal]);
  
  const categorias = useMemo(() => {
    return Array.from(new Set(movimentos.map((m) => m.categoria_nome).filter(Boolean))).sort();
  }, [movimentos]);

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
      } else {
        valA = valueOf(a);
        valB = valueOf(b);
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
        <span className="font-medium text-slate-200">
          {new Date(d + "T00:00:00").toLocaleDateString("pt-BR")}
        </span>
        <span className="text-[9px] uppercase text-slate-500 tracking-wider">
          {tipo}
        </span>
      </div>
    );
  };

  if (!clienteId)
    return (
      <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/30 p-12 text-center backdrop-blur-sm">
        <WalletCards className="mx-auto h-12 w-12 text-cyan-500/60" />
        <h3 className="mt-4 text-xl font-bold text-slate-200">Situação do Cliente</h3>
        <p className="mt-2 text-sm text-slate-400">
          Selecione um cliente para abrir a conta corrente financeira.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20"
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-slate-900/40 p-5 border border-white/5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/80 mb-1">
            Cliente selecionado
          </div>
          <div className="text-2xl font-bold text-slate-100">{cliente?.nome}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="rounded-xl border border-slate-700/80 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 shadow-sm outline-none focus:border-cyan-500"
          >
            <option value="">Trocar cliente</option>
            {clientes.filter((c) => c.id !== CLIENTE_DGA_ID).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-xl border border-slate-700/80 bg-slate-950 px-4 py-2.5 text-sm text-slate-200 shadow-sm outline-none focus:border-cyan-500"
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
        <Kpi label="Despesas" value={resumo.despesas} tone="text-slate-100" />
        <Kpi label="Share antecipou" value={resumo.sharePagou} tone="text-amber-400" />
        <Kpi label="Cliente pagou direto" value={resumo.clientePagouDireto} tone="text-blue-400" />
        <Kpi label="Cliente pagou Share" value={resumo.recebidoShare} tone="text-emerald-400" />
        <Kpi label="Em aberto" value={resumo.aberto} tone="text-rose-400" />
      </div>

      {/* EVOLUÇÃO MENSAL (RECOLHÍVEL) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg backdrop-blur-sm">
        <div 
          className="flex cursor-pointer items-center justify-between border-b border-slate-800 p-4 hover:bg-slate-800/30 transition"
          onClick={() => setShowEvolucao(!showEvolucao)}
        >
          <div>
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-500" /> Evolução mensal
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              A dívida acumulada considera apenas despesas do cliente pagas antecipadamente pela Share.
            </div>
          </div>
          <button className="text-slate-400 hover:text-white">
            {showEvolucao ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
        
        {showEvolucao && (
          <div className="overflow-x-auto bg-slate-950/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
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
                  <tr key={r.periodo} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition">
                    <td className="px-5 py-3 font-semibold text-slate-300">{r.periodo}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{formatBRL(r.despesas)}</td>
                    <td className="px-5 py-3 text-right text-amber-400/90">{formatBRL(r.sharePagou)}</td>
                    <td className="px-5 py-3 text-right text-blue-400/90">{formatBRL(r.clientePagouDireto)}</td>
                    <td className="px-5 py-3 text-right text-emerald-400/90">{formatBRL(r.recebidoShare)}</td>
                    <td className="px-5 py-3 text-right font-bold text-rose-400/90">{formatBRL(r.aberto)}</td>
                  </tr>
                ))}
                {mensal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-slate-500">Nenhum dado mensal encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXTRATO E FERRAMENTAS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg backdrop-blur-sm">
        
        {/* Barra de Ferramentas */}
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-100">Extrato do cliente</div>
            <div className="text-[11px] text-slate-500 mt-1">Gerencie, filtre e some lançamentos específicos</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar despesa..."
                className="w-full min-w-[200px] rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500 appearance-none"
              >
                <option value="">Todas as categorias</option>
                {categorias.map((c: any) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-500">Ordenar por:</span>
              <select 
                value={sortField} 
                onChange={e => setSortField(e.target.value as any)} 
                className="bg-transparent text-sm text-slate-200 outline-none"
              >
                <option value="data">Data</option>
                <option value="valor">Valor</option>
              </select>
              <button 
                onClick={() => setSortOrder(s => s === "asc" ? "desc" : "asc")}
                className="p-1 text-slate-400 hover:text-cyan-400 transition bg-slate-800 rounded-md"
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

        <div className="overflow-x-auto bg-slate-950/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selecionados.length === lista.length && lista.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-cyan-500"
                  />
                </th>
                <th className="text-left px-5 py-4">Data</th>
                <th className="text-left px-5 py-4">Descrição / Categoria</th>
                <th className="text-left px-5 py-4">Fornecedor</th>
                <th className="text-right px-5 py-4">Valor</th>
                <th className="text-center px-5 py-4">Fluxo Cliente</th>
                <th className="text-center px-5 py-4">Status Fornecedor</th>
                <th className="text-right px-5 py-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => {
                const isSelected = selecionados.includes(m.id);
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-slate-800/50 transition ${
                      isSelected ? "bg-cyan-500/10" : "hover:bg-slate-800/20"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelect(m.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-cyan-500"
                      />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{renderData(m)}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200">{m.descricao || "—"}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">{m.categoria_nome || "Sem Categoria"}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{m.fornecedor_nome || "—"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-100">
                      {formatBRL(valueOf(m))}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          paidByShareForClient(m)
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {clienteDividaLabel(m)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          fornecedorStatus(m) === "pago"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {fornecedorStatus(m)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditMov(m)}
                        className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition mr-1"
                        title="Editar lançamento"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-500 bg-slate-950/30">
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
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-black ${tone}`}>
        {formatBRL(value)}
      </div>
    </div>
  );
}