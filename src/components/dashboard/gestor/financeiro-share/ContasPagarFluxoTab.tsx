import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Building2, CalendarDays, ChevronDown, ChevronRight, CircleDollarSign, Clock3, RefreshCw, Search, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { ContaPagarExpandedDetails } from "./contas-pagar/ContaPagarExpandedDetails";

type SubAba = "empresa" | "reembolso";
type StatusFiltro = "todos" | "abertas" | "paga" | "vencida" | "cancelada";

const normalizar = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dataLocal = (value: string | null | undefined) => {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
};
const contaEhReembolso = (conta: any) => Boolean(conta.cliente_id) || normalizar(conta.categoria).includes("reembols");
const contaEstaPaga = (conta: any) => {
  const status = normalizar(conta.status);
  return ["paga", "pago", "quitada", "liquidada", "recebida", "recebido"].includes(status) || Boolean(conta.data_pagamento);
};
const contaEstaVencida = (conta: any) => {
  if (contaEstaPaga(conta) || normalizar(conta.status) === "cancelada") return false;
  const vencimento = dataLocal(conta.data_vencimento);
  if (!vencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return vencimento < hoje;
};

export default function ContasPagarFluxoTab() {
  const [contas, setContas] = useState<any[]>([]);
  const [subAba, setSubAba] = useState<SubAba>("empresa");
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("abertas");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await (supabase as any).from("contas_apagar").select(`
      *, clientes:cliente_id(id, razao_social, proprietario), socios:socios_cliente_id(id, nome),
      fornecedores_favoritos:fornecedor_favorito_id(id, nome_completo, conta_pagamento)
    `).order("data_vencimento", { ascending: true });
    if (error) {
      setErro(error.message || "Não foi possível carregar as contas a pagar.");
      setContas([]);
    } else setContas(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => contas.filter((conta) => {
    if ((subAba === "reembolso") !== contaEhReembolso(conta)) return false;
    const contaStatus = normalizar(conta.status);
    if (status === "abertas" && (contaEstaPaga(conta) || contaStatus === "cancelada")) return false;
    if (status === "paga" && !contaEstaPaga(conta)) return false;
    if (status === "cancelada" && contaStatus !== "cancelada") return false;
    if (status === "vencida" && !contaEstaVencida(conta)) return false;
    if (mes && String(conta.data_vencimento || "").slice(0, 7) !== mes) return false;
    const texto = normalizar([
      conta.descricao, conta.fornecedor_nome, conta.fornecedores_favoritos?.nome_completo,
      conta.numero_doc, conta.nf_numero, conta.categoria, conta.clientes?.razao_social,
      conta.clientes?.proprietario, conta.aeronave_registro,
    ].join(" "));
    return !busca || texto.includes(normalizar(busca));
  }), [busca, contas, mes, status, subAba]);

  const kpis = useMemo(() => {
    const base = contas.filter((conta) => (subAba === "reembolso") === contaEhReembolso(conta));
    const soma = (items: any[]) => items.reduce((sum, conta) => sum + Number(conta.valor || 0), 0);
    return {
      total: soma(base),
      aberto: soma(base.filter((conta) => !contaEstaPaga(conta) && normalizar(conta.status) !== "cancelada")),
      vencido: soma(base.filter(contaEstaVencida)),
      pago: soma(base.filter(contaEstaPaga).map((conta) => ({ ...conta, valor: conta.valor_pago || conta.valor }))),
    };
  }, [contas, subAba]);

  return (
    <div className="space-y-5 p-1 pb-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 text-cyan-400"><CircleDollarSign className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Compromissos financeiros</span></div><h3 className="mt-1 text-xl font-black text-slate-100">Contas a Pagar</h3><p className="mt-1 text-sm text-slate-400">Acompanhe os lançamentos que pressionam cada caixa.</p></div>
        <button onClick={carregar} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-800"><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={<CircleDollarSign className="h-4 w-4" />} label="Total cadastrado" value={kpis.total} tone="cyan" />
        <Kpi icon={<Clock3 className="h-4 w-4" />} label="Em aberto" value={kpis.aberto} tone="amber" />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Vencido" value={kpis.vencido} tone="rose" />
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Já pago" value={kpis.pago} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <SubTab active={subAba === "empresa"} onClick={() => { setSubAba("empresa"); setExpandida(null); }} icon={<Building2 className="h-4 w-4" />}>Despesas da Empresa (caixa Share)</SubTab>
        <SubTab active={subAba === "reembolso"} onClick={() => { setSubAba("reembolso"); setExpandida(null); }} icon={<Users className="h-4 w-4" />}>Reembolso do Cliente</SubTab>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar fornecedor, documento, cliente ou categoria" className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/60" /></label>
        <label className="relative block"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="month" value={mes} onChange={(event) => setMes(event.target.value)} className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-slate-300 outline-none focus:border-cyan-500/60" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFiltro)} className="h-10 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 outline-none focus:border-cyan-500/60"><option value="abertas">Em aberto</option><option value="todos">Todos os status</option><option value="vencida">Vencidas</option><option value="paga">Pagas</option><option value="cancelada">Canceladas</option></select>
      </div>

      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{erro}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs text-slate-500"><span>{filtradas.length} lançamento(s) encontrado(s)</span><span className="font-bold text-slate-300">Filtrado: {formatBRL(filtradas.reduce((sum, conta) => sum + Number(conta.valor || 0), 0))}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="w-10 px-4 py-3" /><th className="px-4 py-3 text-left">Fornecedor / lançamento</th><th className="px-4 py-3 text-left">Vencimento</th><th className="px-4 py-3 text-left">Categoria / cliente</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-800/80">
          {carregando ? <tr><td colSpan={6} className="py-16 text-center text-slate-500">Carregando contas a pagar...</td></tr> : filtradas.length === 0 ? <tr><td colSpan={6} className="py-16 text-center text-slate-500">Nenhum lançamento encontrado para estes filtros.</td></tr> : filtradas.map((conta) => {
            const vencida = contaEstaVencida(conta); const paga = contaEstaPaga(conta); const aberto = expandida === conta.id; const cliente = conta.clientes?.razao_social || conta.clientes?.proprietario; const titulo = conta.fornecedores_favoritos?.nome_completo || conta.fornecedor_nome || conta.descricao || "Lançamento sem fornecedor";
            return <>{<tr key={conta.id} onClick={() => setExpandida(aberto ? null : conta.id)} className={`cursor-pointer text-slate-300 transition hover:bg-cyan-500/[0.04] ${vencida ? "bg-rose-500/[0.04]" : ""}`}><td className="px-4 py-4 text-slate-500">{aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td><td className="px-4 py-4"><div className="font-semibold text-slate-100">{titulo}</div><div className="mt-1 text-xs text-slate-500">{conta.descricao || "Sem descrição"} · {conta.numero_doc || conta.nf_numero || "Sem documento"}</div></td><td className={`px-4 py-4 font-medium ${vencida ? "text-rose-300" : "text-slate-300"}`}>{dataLocal(conta.data_vencimento) ? format(dataLocal(conta.data_vencimento)!, "dd/MM/yyyy") : "-"}</td><td className="px-4 py-4"><div className="text-slate-300">{conta.categoria || "Sem categoria"}</div><div className="mt-1 text-xs text-slate-500">{cliente || "Caixa Share"}</div></td><td className="px-4 py-4 text-right font-bold text-slate-100">{formatBRL(Number(conta.valor || 0))}</td><td className="px-4 py-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${vencida ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : paga ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{paga ? "Paga" : vencida ? "Vencida" : conta.status || "Agendada"}</span></td></tr>}{aberto && <tr key={`${conta.id}-details`}><td colSpan={6} className="border-b border-slate-800 p-0"><ContaPagarExpandedDetails conta={conta} /></td></tr>}</>;
          })}
        </tbody></table></div>
      </div>
    </div>
  );
}

function SubTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition ${active ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400" : "border-slate-800 text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"}`}>{icon}{children}</button>;
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "cyan" | "amber" | "rose" | "emerald" }) {
  const colors = { cyan: "text-cyan-400", amber: "text-amber-300", rose: "text-rose-300", emerald: "text-emerald-300" };
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${colors[tone]}`}>{icon}<span>{label}</span></div><div className="mt-2 text-lg font-black text-slate-100">{formatBRL(value)}</div></div>;
}