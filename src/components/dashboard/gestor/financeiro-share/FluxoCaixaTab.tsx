import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  ArrowDown,
  ArrowUp,
  Calculator,
  CheckSquare,
  ChevronDown,
  Clock3,
  Edit3,
  Filter,
  HandCoins,
  Wallet,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import BaixaPagamentoModal from "@/components/dashboard/gestor/financeiro-share/BaixaPagamentoModal";
import ReembolsoModal from "@/components/dashboard/gestor/financeiro-share/ReembolsoModal";
import EditLancamentoModal from "@/components/dashboard/gestor/financeiro-share/EditLancamentoModal";
import AttachmentViewerModal from "@/components/dashboard/gestor/financeiro-share/AttachmentViewerModal";
import NovaDespesaShareForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaShareForm";
import NovaDespesaClienteForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaClienteForm";
import ContasPagarFluxoTab from "@/components/dashboard/gestor/financeiro-share/ContasPagarFluxoTab";
import ClienteSituacao from "@/components/dashboard/gestor/financeiro-share/ClienteSituacao";
import DgaSituacao from "@/components/dashboard/gestor/financeiro-share/DgaSituacao";
import DuplicidadeAlertasPanel from "@/components/dashboard/gestor/financeiro-share/DuplicidadeAlertasPanel";
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
  const dadosCarregadosRef = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"visao" | "caixa" | "contas-pagar" | "reembolsaveis" | "clientes" | "dga">("visao");
  
  // Filtros
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState("");
  const [caixa, setCaixa] = useState<"todos" | "share" | "cliente" | "dga">("todos");
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
        .select("id, descricao, fornecedor_nome, categoria, valor, data_vencimento, status, cliente_id, movimentacao_id, clientes:cliente_id(id, razao_social, proprietario)")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", limiteContasAPagar)
        .not("status", "in", "(paga,pago,quitada,liquidada,recebida,recebido,cancelada,cancelado)")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return contas;
    },
  });
  const { data: inadimplencias = [], isLoading: inadimplenciasLoading, error: inadimplenciasError } = useInadimplencia({
    diasAtrasoMinimo: 6,
    // O cartão precisa refletir o mesmo Caixa Cliente exibido em ClienteSituacao.
    // Registros legados de despesas_cliente_direto não entram nessa fonte.
    incluirDespesasDiretas: false,
  });
  const { data: reembolsosAReceber = [], isLoading: reembolsosAReceberLoading, error: reembolsosAReceberError } = useQuery({
    queryKey: ["contas-areceber-reembolsos-share"],
    queryFn: async () => {
      const { data: contas, error } = await supabase
        .from("contas_areceber")
        .select("id, cliente_nome, cliente_id, aeronave, descricao, valor, data_vencimento, status, reference_type, movimentacao_id, reference_id")
        .in("reference_type", ["reembolso_share", "travel_report", "travel_expense_report"])
        .is("data_recebimento", null)
        .not("status", "in", "(recebido,recebida,quitado,quitada,cancelado,cancelada)")
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return contas ?? [];
    },
  });

  const load = useCallback(async () => {
    // Mantém a tela montada durante refresh para preservar filtros, mês e ordenação.
    if (!dadosCarregadosRef.current) setLoading(true);
    setErro(null);
    try {
      setData(await fetchFinanceiroData());
      dadosCarregadosRef.current = true;
      await queryClient.invalidateQueries({ queryKey: ["contas-apagar-proximas"] });
      await queryClient.invalidateQueries({ queryKey: ["inadimplencia"] });
      await queryClient.invalidateQueries({ queryKey: ["contas-areceber-reembolsos-share"] });
    } catch (e: any) { setErro(e.message || "Erro ao carregar financeiro"); }
    finally { setLoading(false); }
  }, [queryClient]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (aba === "reembolsaveis") setCaixa("todos");
  }, [aba]);

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
    if (isEntrada(m)) return false;
    const grupo = String(grupoDe(m) || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return paidByShareForClient({ ...m, grupo_categoria: m?.grupo_categoria || grupo }) ||
      (isShare(m) && grupo.includes("reembolsav"));
  }, [grupoDe]);

  const movs = useMemo(() => {
    const filtrados = data.movimentacoes.filter((m: any) => {
      if (String(m.status || '').toLowerCase() === 'cancelado') return false;

      const reembolsavel = isReembolsavel(m);

      // Aba "Despesas Reembolsáveis": mostra todos os reembolsos ainda pendentes.
      if (
        aba === "reembolsaveis" &&
        (!reembolsavel || m.reembolso_quitado || ["reembolsado", "quitado"].includes(String(m.status || "").toLowerCase()))
      ) return false;
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


  const visaoGeral = useMemo(() => {
    const contasTotal = contasAPagar.reduce((sum: number, conta: any) => sum + Number(conta?.valor || 0), 0);
    const inadimplenciaTotal = inadimplencias.reduce((sum: number, item: any) => sum + Number(item?.valor || 0), 0);
    const reembolsosTotal = reembolsosAReceber.reduce((sum: number, conta: any) => sum + Number(conta?.valor || 0), 0);
    const diasMaxAtraso = inadimplencias.reduce((max: number, item: any) => Math.max(max, Number(item?.dias_atraso || 0)), 0);
    return {
      contasTotal,
      inadimplenciaTotal,
      diasMaxAtraso,
      reembolsosTotal,
    };
  }, [contasAPagar, inadimplencias, reembolsosAReceber]);

  const formatMesAno = (periodo: string) => { const [ano, mesNumero] = periodo.split("-"); return `${mesNumero}/${ano}`; };

  const onBaixaSuccess = async () => { setBaixaMov(null); await load(); await queryClient.invalidateQueries({ queryKey: ["movimentacoes"] }); };
  const onDelete = async (id: string) => { if (!confirm("Deseja realmente excluir esta movimentação?")) return; try { await deleteMovimentacao(id); await load(); } catch (e: any) { setErro(e.message); } };
  
  const statusExibicao = (m: any) => {
    if (isEntrada(m)) {
      const status = String(m?.status || '').toLowerCase();
      if (status === 'cancelado' || status === 'cancelada') return 'Cancelado';
      if (['recebido', 'recebida', 'quitado', 'quitada'].includes(status) || m?.data_pagamento) return 'Recebido';
      return 'Entrada';
    }
    return fornecedorStatus(m);
  };

  const deveMostrarBotaoBaixa = (m: any) => {
    if (m?.data_pagamento || isEntrada(m)) return false;
    const texto = String([m?.tipo_rateio, m?.grupo_categoria, m?.categoria_nome, m?.categoria_id].filter(Boolean).join(" ")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[_-]+/g, " ");
    return !["DESPESAS EMPRESA", "DESPESAS PARTICULARES", "DESPESAS EMPRESA - BANCO"].some((grupo) => texto.includes(grupo));
  };

  if (loading) return (
    <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-16 text-center backdrop-blur-sm">
      <RefreshCw className="mx-auto h-8 w-8 animate-spin text-cyan-500/80" />
      <div className="mt-4 text-sm font-medium text-muted-foreground">Carregando financeiro...</div>
    </div>
  );

  return (
    <div className="ml-[-3px] mr-[-3px] space-y-3">
      {erro && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{erro}</div>}

      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border/90 bg-background/35 px-1 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0"><h2 className="mx-[9px] truncate text-sm font-black uppercase tracking-[0.16em] text-foreground">Fluxo de Caixa</h2><p className="mx-[8px] hidden text-[10px] text-muted-foreground sm:block">Visão consolidada de Share, clientes e DGA</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => load()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[10px] font-bold text-muted-foreground transition hover:border-border hover:bg-card"><RefreshCw className="h-3 w-3" /> Atualizar</button>
          {(aba === "caixa" || aba === "clientes") && <button onClick={() => { setNewCaixa(aba === "clientes" ? "cliente" : "share"); setShowNew(true); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-500 px-2.5 text-[10px] font-black text-slate-950 transition hover:bg-cyan-400"><Plus className="h-3 w-3" /> Nova movimentação</button>}
        </div>
      </header>

      <nav className="flex min-h-10 items-center gap-1 overflow-x-auto border-b border-[rgba(13,30,56,0.9)] bg-background/25 px-1 shadow-[1px_1px_3px_0_rgba(0,0,0,1)]">
        {([["visao", "Visão Geral"], ["caixa", "Caixa"], ["contas-pagar", "Contas a Pagar"], ["reembolsaveis", "Despesas Reembolsáveis"], ["clientes", "Caixa Clientes"], ["dga", "DGA"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setAba(k); setSelecionados([]); }} className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-[14px] border-2 px-3 text-[10px] font-black uppercase tracking-wide transition ${aba === k ? "border-[rgba(38,187,117,1)] bg-[rgba(38,187,117,1)] text-[rgba(8,10,12,1)] shadow-[1px_1px_3px_0_rgba(14,34,46,1)]" : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:text-muted-foreground"}`}>{l}</button>
        ))}
      </nav>

      {showNew && ((aba === "caixa" && newCaixa === "share") || (aba === "clientes" && newCaixa === "cliente")) && (
        <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-lg backdrop-blur-sm">
          {newCaixa === "cliente" ? (
            <NovaDespesaClienteForm onCancel={() => setShowNew(false)} onSaved={async () => { setShowNew(false); await load(); }} />
          ) : (
            <NovaDespesaShareForm onCancel={() => setShowNew(false)} onSaved={async () => { setShowNew(false); await load(); }} />
          )}
        </div>
      )}

      {/* ABA VISÃO GERAL */}
      {aba === "visao" && (
        <div className="space-y-3">
          <section className="overflow-hidden rounded-xl border border-border bg-background/45">
            <div className="flex flex-col gap-2 border-b border-border/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-400">Resumo do caixa</div><h3 className="mt-0.5 text-sm font-black text-foreground">Posição financeira consolidada</h3></div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acompanhamento de lançamentos</div>
            </div>
            <div className="border-t border-border/80 px-3 py-3 text-xs text-muted-foreground">
              Consulte as abas operacionais para lançar despesas, acompanhar pagamentos e revisar cobranças. Os valores consolidados do caixa não são exibidos nesta visão.
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-3">
            <ResumoListaCompacta title="Contas a pagar" subtitle={`Próximos 5 dias · ${contasAPagar.length} lançamento(s)`} total={formatBRL(visaoGeral.contasTotal)} tone="orange" loading={contasAPagarLoading} error={contasAPagarError} empty="Nenhuma conta a pagar no período.">
              {contasAPagar.slice(0, 6).map((conta) => <ResumoLinha key={conta.id} title={conta.fornecedor_nome || conta.descricao || conta.categoria || "Conta a pagar"} detail={`${conta.categoria || "Sem categoria"} · ${new Date(`${conta.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}`} value={formatBRL(Number(conta.valor))} tone="orange" />)}
            </ResumoListaCompacta>
            <ResumoListaCompacta title="Reembolsos a receber" subtitle={`Despesas pagas pela Share · ${reembolsosAReceber.length} lançamento(s)`} total={formatBRL(visaoGeral.reembolsosTotal)} tone="cyan" loading={reembolsosAReceberLoading} error={reembolsosAReceberError} empty="Nenhum reembolso pendente.">
              {reembolsosAReceber.slice(0, 6).map((conta: any) => <ResumoLinha key={conta.id} title={conta.cliente_nome || "Cliente sem nome"} detail={`${conta.descricao || "Despesa paga pela Share"} · ${conta.aeronave || "Aeronave não informada"}`} value={formatBRL(Number(conta.valor || 0))} tone="cyan" />)}
            </ResumoListaCompacta>
            <ResumoListaCompacta title="Inadimplência de clientes" subtitle={`Atrasos superiores a 5 dias · ${inadimplencias.length} cliente(s)`} total={formatBRL(visaoGeral.inadimplenciaTotal)} tone="rose" loading={inadimplenciasLoading} error={inadimplenciasError} empty="Nenhum atraso crítico identificado.">
              {inadimplencias.slice(0, 6).map((item) => <ResumoLinha key={`${item.origem}-${item.id}`} title={item.cliente_nome} detail={`${item.descricao} · ${item.dias_atraso} dias`} value={formatBRL(item.valor)} tone="rose" />)}
            </ResumoListaCompacta>
          </div>
        </div>
      )}

      {aba === "contas-pagar" && <ContasPagarFluxoTab />}
      {aba === "clientes" && <div className="space-y-4"><DuplicidadeAlertasPanel fluxo="cliente" items={data.movimentacoes.filter((m: any) => !isShare(m) && !isDga(m))} onOpen={setEditMovId} onDelete={onDelete} /><ClienteSituacao clientes={data.clientes} movimentacoes={data.movimentacoes} rateios={data.rateios} onRefresh={load} mesSelecionado={mes} onMesSelecionadoChange={setMes} /></div>}
      {aba === "dga" && <div className="space-y-4"><DuplicidadeAlertasPanel fluxo="dga" items={data.movimentacoes.filter((m: any) => isDga(m))} onOpen={setEditMovId} onDelete={onDelete} /><DgaSituacao movimentacoes={data.movimentacoes} rateios={data.rateios} socios={data.socios} onChanged={load} /></div>}

      {/* ABA CAIXA / REEMBOLSÁVEIS */}
      {(aba === "caixa" || aba === "reembolsaveis") && (
        <div className="space-y-4">
          <DuplicidadeAlertasPanel fluxo={aba === "reembolsaveis" ? "reembolsaveis" : "caixa"} items={aba === "reembolsaveis" ? movs : data.movimentacoes.filter((m: any) => isShare(m) && !isDga(m) && !isReembolsavel(m))} onOpen={setEditMovId} onDelete={onDelete} />
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background/55 p-2.5">
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Caixa</span>
              <select value={aba === "reembolsaveis" ? "todos" : caixa} onChange={e => setCaixa(e.target.value as any)} disabled={aba === "reembolsaveis"} className="h-8 rounded-lg border border-border bg-card px-2.5 text-[11px] text-foreground outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-70">
                <option value="todos">Todos os caixas</option>
                <option value="share">Caixa Share</option>
                <option value="cliente">Caixas Cliente</option>
                <option value="dga">DGA</option>
              </select>
            </label>
            
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Mês e ano</span>
              <select value={mes} onChange={e => setMes(e.target.value)} className="h-8 rounded-lg border border-border bg-card px-2.5 text-[11px] font-normal text-foreground normal-case outline-none focus:border-cyan-500">
                <option value="">Todos os meses</option>
                {Array.from(new Set(data.movimentacoes.map((m: any) => String(getDisplayDate(m) || '').slice(0, 7)).filter(Boolean))).sort().reverse().map((x: any) => <option key={x} value={x}>{formatMesAno(x)}</option>)}
              </select>
            </label>
            
            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Grupo categoria</span>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)} className="h-8 rounded-lg border border-border bg-card pl-8 pr-2.5 text-[11px] font-normal text-foreground normal-case outline-none focus:border-cyan-500 appearance-none">
                  <option value="">Todos os grupos</option>
                  {grupos.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Coluna Data</span>
              <div className="flex h-8 rounded-lg border border-border overflow-hidden bg-card p-1">
                <button type="button" onClick={() => setTipoData("vencimento")} className={`px-3 text-xs font-bold rounded-lg transition ${tipoData === "vencimento" ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}>Vencimento</button>
                <button type="button" onClick={() => setTipoData("pagamento")} className={`px-3 text-xs font-bold rounded-lg transition ${tipoData === "pagamento" ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}>Pagamento</button>
              </div>
            </label>
            
            <button type="button" onClick={() => setOrdem(o => o === "asc" ? "desc" : "asc")} className="h-8 rounded-lg border border-border bg-card px-2.5 text-[10px] font-bold text-foreground hover:bg-card-secondary transition flex items-center gap-2">
              {ordem === "asc" ? <ArrowUp className="h-4 w-4 text-cyan-400" /> : <ArrowDown className="h-4 w-4 text-cyan-400" />}
              {ordem === "asc" ? "Crescente" : "Decrescente"}
            </button>
            
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-2.5 text-[11px] text-foreground outline-none focus:border-cyan-500" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background/45 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5 text-xs font-bold text-muted-foreground">
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

            <div className="overflow-x-auto bg-background/30">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-[#edf2ff]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selecionados.length === movs.length && movs.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-border bg-card accent-cyan-500"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left cursor-pointer select-none hover:text-cyan-400 transition" onClick={() => setOrdem(o => o === "asc" ? "desc" : "asc")}>
                      <div className="flex items-center gap-1.5">
                        Data ({tipoData === "pagamento" ? "Pgto." : "Venc."})
                        {ordem === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left">Descrição</th>
                    <th className="px-3 py-2.5 text-left">Cliente</th>
                    <th className="px-3 py-2.5 text-left">Caixa</th>
                    <th className="px-3 py-2.5 text-left">Pago por</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map((m: any) => {
                    const isSelected = selecionados.includes(m.id);
                    const isEntr = isEntrada(m);
                    
                    return (
                    <tr key={m.id} className={`overflow-hidden rounded-none border-b border-[rgba(45,73,78,0.5)] shadow-[1px_1px_3px_0_rgba(11,23,32,1)] transition ${isSelected ? "bg-cyan-500/10" : "hover:bg-card-secondary/20"}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(m.id)}
                          className="h-4 w-4 rounded border-border bg-card accent-cyan-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {getDisplayDate(m) ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{new Date(getDisplayDate(m) + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                            <span className="text-[9px] uppercase text-muted-foreground tracking-wider">{tipoData}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-foreground">{m.descricao || "—"}</div>
                        <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{grupoDe(m)}{m.categoria_nome ? ` · ${m.categoria_nome}` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{data.clientes.find((c: any) => c.id === m.clientes_id)?.nome || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full bg-card-secondary px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                          {isDga(m) ? "DGA" : isShare(m) ? "Share" : "Cliente"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{m.pago_por || "—"}</td>
                      <td className={`px-3 py-2.5 text-right font-black ${isEntr ? 'text-emerald-400' : 'text-foreground'}`}>
                        {isEntr ? '+' : ''}{formatBRL(valueOf(m))}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                         <span className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-3 tracking-wide ${
                            statusExibicao(m) === "Recebido" || statusExibicao(m) === "pago"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : statusExibicao(m) === "Entrada"
                                ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
                                : statusExibicao(m) === "Reembolso pendente"
                                  ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                  : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                          }`}>
                            {statusExibicao(m)}
                         </span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {deveMostrarBotaoBaixa(m) && <button title="Dar baixa" onClick={() => setBaixaMov(m)} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition"><HandCoins className="h-4 w-4" /></button>}
                          {m.reembolsavel && !m.reembolso_quitado && <button title="Reembolso" onClick={() => setReembolsoMov(m)} className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/10 transition"><Wallet className="h-4 w-4" /></button>}
                          <button title="Editar" onClick={() => setEditMovId(m.id)} className="rounded-lg p-1.5 text-cyan-400 hover:bg-cyan-500/10 transition"><Edit3 className="h-4 w-4" /></button>
                          <button title="Excluir" onClick={() => onDelete(m.id)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 transition"><Trash2 className="h-4 w-4" /></button>
                          <button title="Detalhes" onClick={() => setAttachment({ url: m.comprovante_url || m.nf_url || m.boleto_url || m.recibo_url, title: m.descricao || "Documento" })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-card-secondary hover:text-foreground transition"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            {movs.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground bg-background/30">
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

function FluxoMetric({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "green" | "red" | "amber";
}) {
  const styles = {
    green: {
      icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      value: "text-emerald-300",
      glow: "bg-emerald-500/5",
    },
    red: {
      icon: "border-rose-500/20 bg-rose-500/10 text-rose-300",
      value: "text-rose-300",
      glow: "bg-rose-500/5",
    },
    amber: {
      icon: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      value: "text-amber-300",
      glow: "bg-amber-500/5",
    },
  }[tone];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-background/50 p-4 ${styles.glow}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border p-2.5 ${styles.icon}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-1 truncate text-xl font-black ${styles.value}`}>{value}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{helper}</div>
        </div>
      </div>
    </div>
  );
}

function CaixaAlertaCard({
  tone,
  icon,
  eyebrow,
  title,
  value,
  count,
  countLabel,
  description,
  loading,
  error,
}: {
  tone: "payable" | "default";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  value: string;
  count: number;
  countLabel: string;
  description: string;
  loading: boolean;
  error: Error | null;
}) {
  const payable = tone === "payable";
  return (
    <section className={`relative overflow-hidden rounded-3xl border p-5 shadow-xl ${
      payable
        ? "border-[#daa01a]/20 bg-[#bb7602] bg-gradient-to-br from-orange-500/[0.09] via-card/80 to-background"
        : "border-[#a71029]/20 bg-[#061524] bg-gradient-to-br from-rose-500/[0.10] via-card/80 to-background"
    }`}>
      <div className={`absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl ${payable ? "bg-orange-500/10" : "bg-rose-500/10"}`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className={`rounded-2xl border p-3 ${payable ? "border-orange-400/20 bg-orange-400/10 text-orange-300" : "border-rose-400/20 bg-rose-400/10 text-rose-300"}`}>
            {icon}
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${payable ? "border-orange-400/20 bg-orange-400/10 text-orange-300" : "border-rose-400/20 bg-rose-400/10 text-rose-300"}`}>
            {payable ? "Sai dinheiro" : "Falta entrar"}
          </span>
        </div>

        <div className="mt-5">
          <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${payable ? "text-orange-300/70" : "text-rose-300/70"}`}>{eyebrow}</div>
          <h4 className="mt-1 text-lg font-black text-white">{title}</h4>
          <div className={`mt-2 text-3xl font-black tracking-tight ${payable ? "text-[#fdf5ec]" : "text-rose-300"}`}>{value}</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/5 pt-4">
          <div>
            <div className="text-2xl font-black text-foreground">{count}</div>
            <div className="max-w-[220px] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{countLabel}</div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground">
            {loading ? "Atualizando..." : error ? "Erro ao atualizar" : "Dados atualizados"}
          </div>
        </div>
      </div>
    </section>
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
  tone,
  total,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  loading: boolean;
  error: Error | null;
  empty: string;
  tone: "payable" | "overdue";
  total: number;
  children: React.ReactNode;
}) {
  const payable = tone === "payable";
  return (
    <section className={`rounded-3xl border p-5 shadow-xl backdrop-blur-sm ${payable ? "border-[#a34809]/[0.56] bg-[#040d22]/60" : "border-[#eb0930]/[0.53] bg-[#061524]/80"}`}>
      <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`rounded-2xl border p-2.5 ${payable ? "border-orange-500/20 bg-orange-500/10" : "border-rose-500/20 bg-rose-500/10"}`}>{icon}</div>
          <div className="min-w-0">
            <div className={`text-[9px] font-black uppercase tracking-[0.18em] ${payable ? "text-orange-300/70" : "text-rose-300/70"}`}>
              {payable ? "Saída prevista" : "Recebimento em atraso"}
            </div>
            <h3 className="truncate font-black text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-black ${payable ? "text-orange-300" : "text-rose-300"}`}>{formatBRL(total)}</div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">total</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-black text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</span>
        <span className="text-[10px] text-muted-foreground">{payable ? "Dinheiro que sai" : "Dinheiro que deveria entrar"}</span>
      </div>

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-rose-300">Não foi possível carregar os dados.</div>
        ) : count === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/30 px-4 py-8 text-center text-sm text-muted-foreground">{empty}</div>
        ) : children}
      </div>
    </section>
  );
}

function ResumoItem({ title, detail, value, tone }: { title: string; detail: string; value: string; tone: "orange" | "rose" }) {
  const isOrange = tone === "orange";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 transition ${
      isOrange
        ? "border-orange-500/10 bg-orange-500/[0.035] hover:border-orange-500/20 hover:bg-orange-500/[0.06]"
        : "border-rose-500/10 bg-rose-500/[0.035] hover:border-rose-500/20 hover:bg-rose-500/[0.06]"
    }`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`h-2 w-2 shrink-0 rounded-full ${isOrange ? "bg-orange-400" : "bg-rose-400"}`} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        </div>
      </div>
      <span className={`shrink-0 text-sm font-black ${isOrange ? "text-orange-300" : "text-rose-300"}`}>{value}</span>
    </div>
  );
}

function ResumoKpi({ label, value, note, tone }: { label: string; value: string; note: string; tone: "amber" | "green" | "red" | "violet" }) {
  const cls = { amber: "text-amber-300", green: "text-emerald-300", red: "text-rose-300", violet: "text-violet-300" }[tone];
  return <div className="min-w-0 px-3 py-2.5"><div className="truncate text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 truncate text-sm font-black ${cls}`}>{value}</div><div className="mt-0.5 truncate text-[9px] text-muted-foreground">{note}</div></div>;
}

function ResumoListaCompacta({ title, subtitle, total, tone, loading, error, empty, children }: { title: string; subtitle: string; total: string; tone: "orange" | "rose" | "cyan"; loading: boolean; error: unknown; empty: string; children: React.ReactNode }) {
  const accent = tone === "orange" ? "text-orange-300" : tone === "cyan" ? "text-cyan-300" : "text-rose-300";
  return <section className="overflow-hidden rounded-xl border border-border bg-background/40"><div className="flex items-center justify-between gap-3 border-b border-border/90 px-3 py-2.5"><div className="min-w-0"><h3 className={`truncate text-xs font-black ${accent}`}>{title}</h3><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{subtitle}</p></div><strong className={`shrink-0 text-sm font-black ${accent}`}>{total}</strong></div><div className="divide-y divide-border/70">{loading ? <div className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando...</div> : error ? <div className="px-3 py-6 text-center text-xs text-rose-300">Não foi possível carregar os dados.</div> : children || <div className="px-3 py-6 text-center text-xs text-muted-foreground">{empty}</div>}</div></section>;
}

function ResumoLinha({ title, detail, value, tone }: { title: string; detail: string; value: string; tone: "orange" | "rose" | "cyan" }) {
  const accent = tone === "orange" ? "bg-orange-400 text-orange-300" : tone === "cyan" ? "bg-cyan-400 text-cyan-300" : "bg-rose-400 text-rose-300";
  return <div className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-card/70"><div className="flex min-w-0 items-center gap-2"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.split(" ")[0]}`} /><div className="min-w-0"><div className="truncate text-[11px] font-semibold text-muted-foreground">{title}</div><div className="truncate text-[10px] text-muted-foreground">{detail}</div></div></div><span className={`shrink-0 text-[11px] font-black ${accent.split(" ")[1]}`}>{value}</span></div>;
}

function Card({ title, value, note, tone }: { title: string; value: string; note: string; tone: "amber" | "green" | "red" | "violet" }) {
  const cls = { amber: "text-amber-400", green: "text-emerald-400", red: "text-rose-400", violet: "text-violet-400" }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm backdrop-blur-sm relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 ${cls.replace('text-', 'bg-')}`}></div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className={`mt-2 text-3xl font-black ${cls}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{note}</div>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4 transition hover:bg-card-secondary/30">
      <div className="font-bold text-foreground">{title}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{text}</div>
    </div>
  );
}
