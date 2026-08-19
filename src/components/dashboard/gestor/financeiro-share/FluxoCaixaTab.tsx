import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calculator,
  CheckSquare,
  ChevronDown,
  Clock3,
  Edit3,
  Filter,
  HandCoins,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import BaixaPagamentoModal from "@/components/dashboard/gestor/financeiro-share/BaixaPagamentoModal";
import ReembolsoModal from "@/components/dashboard/gestor/financeiro-share/ReembolsoModal";
import EditLancamentoModal from "@/components/dashboard/gestor/financeiro-share/EditLancamentoModal";
import AttachmentViewerModal from "@/components/dashboard/gestor/financeiro-share/AttachmentViewerModal";
import NovaDespesaShareForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaShareForm";
import NovaDespesaClienteForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaClienteForm";
import FinanceiroResumo from "@/components/dashboard/gestor/financeiro-share/FinanceiroResumo";
import ClienteSituacao from "@/components/dashboard/gestor/financeiro-share/ClienteSituacao";
import DgaSituacao from "@/components/dashboard/gestor/financeiro-share/DgaSituacao";
import { useInadimplencia } from "@/hooks/useInadimplencia";
import { supabase } from "@/integrations/supabase/client";

import { formatBRL } from "@/lib/format";
import { deleteMovimentacao, fetchFinanceiroData } from "@/services/financeiroService";
import { classify, dateOf, fornecedorStatus, isDga, isEntrada, isShare, paidByShareForClient, valueOf } from "@/utils/financeiroRules";

type TipoData = "vencimento" | "pagamento";
type Ordem = "asc" | "desc";

export default function FluxoCaixaTab() {
  const [data, setData] = useState<any>({ movimentacoes: [], rateios: [], clientes: [], socios: [], categorias: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"visao" | "caixa" | "reembolsaveis" | "clientes" | "dga">("visao");
  
  // Filtros
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState("");
  const [caixa, setCaixa] = useState<"todos" | "share" | "cliente" | "dga">("share");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [tipoData, setTipoData] = useState<TipoData>("vencimento");
  const [ordem, setOrdem] = useState<Ordem>("desc");
  
  // Seleção múltipla para soma
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // Modais e Ações
  const [baixaMov, setBaixaMov] = useState<any>(null);
  const [reembolsoMov, setReembolsoMov] = useState<any>(null);
  const [editMovId, setEditMovId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCaixa, setNewCaixa] = useState<"share" | "cliente">("share");

  const queryClient = useQueryClient();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const limiteContasAPagar = format(addDays(new Date(), 5), "yyyy-MM-dd");
  const { data: contasAPagar = [], isLoading: contasAPagarLoading, error: contasAPagarError } = useQuery({
    queryKey: ["contas-apagar-proximas", hoje, limiteContasAPagar],
    queryFn: async () => {
      const { data: contas, error } = await supabase
        .from("contas_apagar")
        .select("id, descricao, fornecedor_nome, categoria, valor, data_vencimento, status")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", limiteContasAPagar)
        .neq("status", "paga")
        .neq("status", "cancelada")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return contas;
    },
  });
  const { data: inadimplencias = [], isLoading: inadimplenciasLoading, error: inadimplenciasError } = useInadimplencia({ diasAtrasoMinimo: 6 });

  const load = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      setData(await fetchFinanceiroData());
      await queryClient.invalidateQueries({ queryKey: ["contas-apagar-proximas"] });
      await queryClient.invalidateQueries({ queryKey: ["inadimplencia"] });
    } catch (e: any) { setErro(e.message || "Erro ao carregar financeiro"); }
    finally { setLoading(false); }
  }, [queryClient]);

  useEffect(() => { load(); }, [load]);

  const catMap = useMemo(() => {
    const m = new Map<string, any>();
    (data.categorias || []).forEach((c: any) => { m.set(c.id, c); m.set(String(c.nome || "").toLowerCase(), c); });
    return m;
  }, [data.categorias]);

  const grupoDe = useCallback((m: any) => {
    const c = catMap.get(m?.categoria_id) || catMap.get(String(m?.categoria_nome || "").toLowerCase());
    return c?.grupo_categoria || c?.nome || m?.categoria_nome || "Sem categoria";
  }, [catMap]);

  const getDisplayDate = useCallback((m: any) => {
    const campo = tipoData === "pagamento" ? m?.data_pagamento : m?.data_vencimento;
    return campo || dateOf(m);
  }, [tipoData]);

  const grupos = useMemo(() => Array.from(new Set(data.movimentacoes.map((m: any) => grupoDe(m)).filter(Boolean))).sort((a: string, b: string) => a.localeCompare(b)), [data.movimentacoes, grupoDe]);

  // Uma despesa é "reembolsável" quando é do caixa Share, é saída, e sua categoria
  // pertence ao grupo "Reembolsáveis". Essas despesas só devem aparecer na aba
  // "Despesas Reembolsáveis" — nunca na aba "Caixa".
  const isReembolsavel = useCallback((m: any) => {
    if (!isShare(m) || isEntrada(m)) return false;
    const grupo = String(grupoDe(m) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return grupo.includes("reembolsav");
  }, [grupoDe]);

  const movs = useMemo(() => {
    const filtrados = data.movimentacoes.filter((m: any) => {
      if (String(m.status || '').toLowerCase() === 'cancelado') return false;

      const reembolsavel = isReembolsavel(m);

      // Aba "Despesas Reembolsáveis": mostra só as reembolsáveis.
      if (aba === "reembolsaveis" && !reembolsavel) return false;
      // Aba "Caixa": nunca mostra reembolsáveis (elas ficam só na aba própria).
      if (aba === "caixa" && reembolsavel) return false;

      if (caixa === 'dga' && !isDga(m)) return false;
      // Caixa "Share": mostra tudo do caixa Share (entradas E saídas),
      // exceto DGA (DGA é tratado separadamente). Reembolsáveis já foram
      // filtradas acima quando a aba é "caixa".
      if (caixa === 'share' && (!isShare(m) || isDga(m))) return false;
      if (caixa === 'cliente' && (isDga(m) || isShare(m))) return false;

      if (mes && String(getDisplayDate(m) || '').slice(0, 7) !== mes) return false;
      if (grupoFiltro && grupoDe(m) !== grupoFiltro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const text = `${m.descricao || ''} ${m.fornecedor_nome || ''} ${m.numero_doc || ''} ${m.pago_por || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    const ordenados = [...filtrados].sort((a: any, b: any) => {
      const da = String(getDisplayDate(a) || '');
      const db = String(getDisplayDate(b) || '');
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return ordem === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });
    return ordenados;
  }, [data.movimentacoes, aba, caixa, mes, busca, grupoFiltro, ordem, getDisplayDate, grupoDe, isReembolsavel]);

  // Lógica de Seleção
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelecionados(movs.map((m: any) => m.id));
    else setSelecionados([]);
  };

  const handleSelect = (id: string) => {
    setSelecionados((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const somaSelecionados = useMemo(() => {
    return movs.filter((m: any) => selecionados.includes(m.id)).reduce((acc: number, m: any) => acc + valueOf(m), 0);
  }, [movs, selecionados]);


  const resumo = useMemo(() => {
    const entradas = data.movimentacoes.filter((m: any) => !isDga(m) && isEntrada(m)).reduce((s:number, m:any) => s + valueOf(m), 0);
    const saidas = data.movimentacoes.filter((m: any) => !isDga(m) && !isEntrada(m)).reduce((s:number, m:any) => s + valueOf(m), 0);
    const adiantado = data.movimentacoes.filter((m: any) => paidByShareForClient(m)).reduce((s:number, m:any) => s + valueOf(m), 0);
    const recebido = data.movimentacoes.filter((m: any) => !isDga(m) && isEntrada(m) && m.clientes_id).reduce((s:number, m:any) => s + valueOf(m), 0);
    const aReceber = Math.max(0, adiantado - recebido);
    const dgaEntrada = data.movimentacoes.filter((m: any) => isDga(m) && isEntrada(m)).reduce((s:number, m:any) => s + valueOf(m), 0);
    const dgaSaida = data.movimentacoes.filter((m: any) => isDga(m) && !isEntrada(m) && !String(m.pago_por || '').toLowerCase().includes('cotista') && !m.pago_diretamente).reduce((s:number, m:any) => s + valueOf(m), 0);
    return { entradas, saidas, saldo: entradas - saidas, aReceber, dgaSaldo: dgaEntrada - dgaSaida };
  }, [data.movimentacoes]);

  const formatMesAno = (periodo: string) => { const [ano, mesNumero] = periodo.split("-"); return `${mesNumero}/${ano}`; };

  const onBaixaSuccess = async () => { setBaixaMov(null); await load(); await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] }); };
  const onDelete = async (id: string) => { if (!confirm("Deseja realmente excluir esta movimentação?")) return; try { await deleteMovimentacao(id); await load(); } catch (e: any) { setErro(e.message); } };
  
  const deveMostrarBotaoBaixa = (m: any) => {
    if (m?.data_pagamento || isEntrada(m)) return false;
    const texto = String([m?.tipo_rateio, m?.grupo_categoria, m?.categoria_nome, m?.categoria_id].filter(Boolean).join(" ")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[_-]+/g, " ");
    return !["DESPESAS EMPRESA", "DESPESAS PARTICULARES", "DESPESAS EMPRESA - BANCO"].some((grupo) => texto.includes(grupo));
  };

  if (loading) return (
    <div className="rounded-3xl border border-dashed border-slate-700/60 bg-slate-900/30 p-16 text-center backdrop-blur-sm">
      <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-500/80" />
      <div className="mt-4 text-sm font-medium text-slate-400">Carregando financeiro...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {erro && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{erro}</div>}
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4 justify-between rounded-2xl bg-slate-900/40 p-5 border border-white/5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/80 mb-1">Financeiro</div>
          <h2 className="text-2xl font-bold text-slate-100">Fluxo de Caixa</h2>
          <p className="text-sm text-slate-400 mt-1">Share, clientes e DGA com regras financeiras separadas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => load()} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-200 shadow-sm hover:bg-slate-800 transition flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          {(aba === "caixa" || aba === "clientes") && (
            <button 
              onClick={() => { setNewCaixa(aba === "clientes" ? "cliente" : "share"); setShowNew(true); }} 
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:from-cyan-500 hover:to-cyan-400 transition flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> Nova movimentação
            </button>
          )}
        </div>
      </div>

      <FinanceiroResumo resumo={resumo} />
      
      {/* TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {([["visao", "Visão Geral"], ["caixa", "Caixa"], ["reembolsaveis", "Despesas Reembolsáveis"], ["clientes", "Caixa Clientes"], ["dga", "DGA"]] as const).map(([k, l]) => (
          <button 
            key={k} 
            onClick={() => { setAba(k); setSelecionados([]); }} 
            className={`rounded-lg border px-4 py-2 text-sm font-bold transition-all ${
              aba === k 
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400" 
                : "border-slate-800 bg-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {showNew && ((aba === "caixa" && newCaixa === "share") || (aba === "clientes" && newCaixa === "cliente")) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-sm">
          {newCaixa === "cliente" ? (
            <NovaDespesaClienteForm onCancel={() => setShowNew(false)} onSaved={async () => { setShowNew(false); await load(); }} />
          ) : (
            <NovaDespesaShareForm onCancel={() => setShowNew(false)} onSaved={async () => { setShowNew(false); await load(); }} />
          )}
        </div>
      )}

      {/* ABA VISÃO GERAL */}
      {aba === "visao" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Dívidas de clientes" value={formatBRL(resumo.aReceber)} note="somente valores antecipados pela Share" tone="amber" />
            <Card title="Resultado líquido" value={formatBRL(resumo.saldo)} note="Share + clientes; DGA separado" tone={resumo.saldo >= 0 ? "green" : "red"} />
            <Card title="Saldo DGA" value={formatBRL(resumo.dgaSaldo)} note="não integra dívida de clientes" tone="violet" />
          </div>
          
          <div className="grid gap-6 xl:grid-cols-2">
            <ResumoLista
              icon={<ReceiptText className="h-5 w-5 text-cyan-400" />}
              title="Contas a pagar nos próximos 5 dias"
              description={`Vencimentos de hoje até ${format(addDays(new Date(), 5), "dd/MM")}.`}
              count={contasAPagar.length}
              loading={contasAPagarLoading}
              error={contasAPagarError}
              empty="Nenhuma conta a pagar com vencimento nos próximos 5 dias."
            >
              {contasAPagar.map((conta) => (
                <ResumoItem
                  key={conta.id}
                  title={conta.fornecedor_nome || conta.descricao || conta.categoria || "Conta a pagar"}
                  detail={`${conta.categoria || "Sem categoria"} · vence em ${new Date(`${conta.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}`}
                  value={formatBRL(Number(conta.valor))}
                  tone="cyan"
                />
              ))}
            </ResumoLista>

            <ResumoLista
              icon={<AlertTriangle className="h-5 w-5 text-rose-400" />}
              title="Alertas de inadimplência"
              description="Clientes com mais de 5 dias de atraso."
              count={inadimplencias.length}
              loading={inadimplenciasLoading}
              error={inadimplenciasError}
              empty="Nenhum cliente com atraso superior a 5 dias."
            >
              {inadimplencias.map((item) => (
                <ResumoItem
                  key={`${item.origem}-${item.id}`}
                  title={item.cliente_nome}
                  detail={`${item.descricao} · ${item.dias_atraso} dias em atraso`}
                  value={formatBRL(item.valor)}
                  tone="rose"
                />
              ))}
            </ResumoLista>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
            <div className="font-bold text-slate-200 mb-4">Regra financeira</div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <Rule title="Cliente" text="Se a Share paga uma despesa do cliente, ela fica em aberto contra o cliente até o recebimento." />
              <Rule title="Pagamento direto" text="Se o cliente paga diretamente o fornecedor, não vira dívida com a Share." />
              <Rule title="DGA" text="Despesas pagas pela conta DGA não geram dívida com a Share. Pagamentos pessoais de cotistas ficam para acerto no balanço DGA." />
            </div>
          </div>
        </div>
      )}

      {aba === "clientes" && <ClienteSituacao clientes={data.clientes} movimentacoes={data.movimentacoes} />} 
      {aba === "dga" && <DgaSituacao movimentacoes={data.movimentacoes} socios={data.socios} />} 

      {/* ABA CAIXA / REEMBOLSÁVEIS */}
      {(aba === "caixa" || aba === "reembolsaveis") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-900/40 p-4 border border-white/5">
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Caixa</span>
              <select value={caixa} onChange={e => setCaixa(e.target.value as any)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-cyan-500">
                <option value="todos">Todos os caixas</option>
                <option value="share">Caixa Share</option>
                <option value="cliente">Caixas Cliente</option>
                <option value="dga">DGA</option>
              </select>
            </label>
            
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Mês e ano</span>
              <select value={mes} onChange={e => setMes(e.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-normal text-slate-200 normal-case outline-none focus:border-cyan-500">
                <option value="">Todos os meses</option>
                {Array.from(new Set(data.movimentacoes.map((m: any) => String(getDisplayDate(m) || '').slice(0, 7)).filter(Boolean))).sort().reverse().map((x: any) => <option key={x} value={x}>{formatMesAno(x)}</option>)}
              </select>
            </label>
            
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Grupo categoria</span>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm font-normal text-slate-200 normal-case outline-none focus:border-cyan-500 appearance-none">
                  <option value="">Todos os grupos</option>
                  {grupos.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Coluna Data</span>
              <div className="flex h-10 rounded-xl border border-slate-700 overflow-hidden bg-slate-950 p-1">
                <button type="button" onClick={() => setTipoData("vencimento")} className={`px-3 text-xs font-bold rounded-lg transition ${tipoData === "vencimento" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}>Vencimento</button>
                <button type="button" onClick={() => setTipoData("pagamento")} className={`px-3 text-xs font-bold rounded-lg transition ${tipoData === "pagamento" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}>Pagamento</button>
              </div>
            </label>
            
            <button type="button" onClick={() => setOrdem(o => o === "asc" ? "desc" : "asc")} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-4 text-xs font-bold text-slate-200 hover:bg-slate-800 transition flex items-center gap-2">
              {ordem === "asc" ? <ArrowUp className="h-4 w-4 text-cyan-400" /> : <ArrowDown className="h-4 w-4 text-cyan-400" />}
              {ordem === "asc" ? "Crescente" : "Decrescente"}
            </button>
            
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-cyan-500" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg backdrop-blur-sm">
            <div className="p-5 border-b border-slate-800 font-bold text-slate-200 flex items-center justify-between">
              <div>Lançamentos ({movs.length})</div>
            </div>

            {/* BARRA FLUTUANTE DE SOMA */}
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
                        checked={selecionados.length === movs.length && movs.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-cyan-500"
                      />
                    </th>
                    <th className="text-left px-5 py-4 cursor-pointer select-none hover:text-cyan-400 transition" onClick={() => setOrdem(o => o === "asc" ? "desc" : "asc")}>
                      <div className="flex items-center gap-1.5">
                        Data ({tipoData === "pagamento" ? "Pgto." : "Venc."})
                        {ordem === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </div>
                    </th>
                    <th className="text-left px-5 py-4">Descrição</th>
                    <th className="text-left px-5 py-4">Cliente</th>
                    <th className="text-left px-5 py-4">Caixa</th>
                    <th className="text-left px-5 py-4">Pago por</th>
                    <th className="text-right px-5 py-4">Valor</th>
                    <th className="text-left px-5 py-4">Status</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map((m: any) => {
                    const isSelected = selecionados.includes(m.id);
                    const isEntr = isEntrada(m);
                    
                    return (
                    <tr key={m.id} className={`border-b border-slate-800/50 transition ${isSelected ? "bg-cyan-500/10" : "hover:bg-slate-800/20"}`}>
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(m.id)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-cyan-500"
                        />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getDisplayDate(m) ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200">{new Date(getDisplayDate(m) + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                            <span className="text-[9px] uppercase text-slate-500 tracking-wider">{tipoData}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-200">{m.descricao || "—"}</div>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">{grupoDe(m)}{m.categoria_nome ? ` · ${m.categoria_nome}` : ""}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{data.clientes.find((c: any) => c.id === m.clientes_id)?.nome || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                          {isDga(m) ? "DGA" : isShare(m) ? "Share" : "Cliente"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{m.pago_por || "—"}</td>
                      <td className={`px-5 py-3.5 text-right font-black ${isEntr ? 'text-emerald-400' : 'text-slate-100'}`}>
                        {isEntr ? '+' : ''}{formatBRL(valueOf(m))}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                         <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            fornecedorStatus(m) === "pago"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {fornecedorStatus(m)}
                         </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {deveMostrarBotaoBaixa(m) && <button title="Dar baixa" onClick={() => setBaixaMov(m)} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition"><HandCoins className="h-4 w-4" /></button>}
                          {m.reembolsavel && !m.reembolso_quitado && <button title="Reembolso" onClick={() => setReembolsoMov(m)} className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/10 transition"><Wallet className="h-4 w-4" /></button>}
                          <button title="Editar" onClick={() => setEditMovId(m.id)} className="rounded-lg p-1.5 text-cyan-400 hover:bg-cyan-500/10 transition"><Edit3 className="h-4 w-4" /></button>
                          <button title="Excluir" onClick={() => onDelete(m.id)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 transition"><Trash2 className="h-4 w-4" /></button>
                          <button title="Detalhes" onClick={() => setAttachment({ url: m.comprovante_url || m.nf_url || m.boleto_url || m.recibo_url, title: m.descricao || "Documento" })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            {movs.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500 bg-slate-950/30">
                <Calculator className="mx-auto h-8 w-8 opacity-20 mb-3" />
                Nenhum lançamento encontrado com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* MODALS */}
      {baixaMov && <BaixaPagamentoModal mov={baixaMov} onClose={() => setBaixaMov(null)} onSuccess={onBaixaSuccess} />}
      {reembolsoMov && <ReembolsoModal mov={reembolsoMov} onClose={() => setReembolsoMov(null)} onSuccess={async () => { setReembolsoMov(null); await load(); }} />}
      {editMovId && <EditLancamentoModal movId={editMovId} onClose={() => setEditMovId(null)} onSaved={async () => { setEditMovId(null); await load(); }} />}
      {attachment?.url && <AttachmentViewerModal url={attachment.url} title={attachment.title} onClose={() => setAttachment(null)} />}
    </div>
  );
}

function ResumoLista({
  icon,
  title,
  description,
  count,
  loading,
  error,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  loading: boolean;
  error: Error | null;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2.5">{icon}</div>
          <div>
            <h3 className="font-bold text-slate-100">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold text-slate-300">{count}</span>
      </div>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading ? <div className="py-6 text-center text-sm text-slate-500">Carregando...</div> : error ? <div className="py-6 text-center text-sm text-rose-300">Não foi possível carregar os dados.</div> : count === 0 ? <div className="py-6 text-center text-sm text-slate-500">{empty}</div> : children}
      </div>
    </section>
  );
}

function ResumoItem({ title, detail, value, tone }: { title: string; detail: string; value: string; tone: "cyan" | "rose" }) {
  const valueClass = tone === "cyan" ? "text-cyan-300" : "text-rose-300";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Clock3 className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-200">{title}</div>
          <div className="truncate text-xs text-slate-500">{detail}</div>
        </div>
      </div>
      <span className={`shrink-0 text-sm font-black ${valueClass}`}>{value}</span>
    </div>
  );
}

function Card({ title, value, note, tone }: { title: string; value: string; note: string; tone: "amber" | "green" | "red" | "violet" }) {
  const cls = { amber: "text-amber-400", green: "text-emerald-400", red: "text-rose-400", violet: "text-violet-400" }[tone];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm backdrop-blur-sm relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 ${cls.replace('text-', 'bg-')}`}></div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
      <div className={`mt-2 text-3xl font-black ${cls}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-400">{note}</div>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:bg-slate-800/30">
      <div className="font-bold text-slate-200">{title}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-slate-400">{text}</div>
    </div>
  );
}
