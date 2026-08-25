import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CalendarDays, CircleDollarSign, Clock3, RefreshCw, Search, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type StatusFiltro = "todos" | "abertas" | "recebida" | "vencida" | "cancelada";

const normalizar = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dataLocal = (value: string | null | undefined) => {
  if (!value) return null;
  try { return parseISO(value); } catch { return null; }
};
const contaRecebida = (conta: any) => {
  const status = normalizar(conta.status);
  return ["paga", "pago", "recebida", "recebido", "quitada", "liquidada"].includes(status) ||
    Boolean(conta.data_recebimento || conta.data_pagamento);
};
const contaVencida = (conta: any) => {
  if (contaRecebida(conta) || normalizar(conta.status) === "cancelada") return false;
  const vencimento = dataLocal(conta.data_vencimento);
  if (!vencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return vencimento < hoje;
};

export default function ContasReceberFluxoTab() {
  const [contas, setContas] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [mes, setMes] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("abertas");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const { data, error } = await (supabase as any)
      .from("contas_areceber")
      .select("*")
      .order("data_vencimento", { ascending: true });
    if (error) {
      setErro(error.message || "Não foi possível carregar as contas a receber.");
      setContas([]);
    } else setContas(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => contas.filter((conta) => {
    const contaStatus = normalizar(conta.status);
    if (status === "abertas" && (contaRecebida(conta) || contaStatus === "cancelada")) return false;
    if (status === "recebida" && !contaRecebida(conta)) return false;
    if (status === "cancelada" && contaStatus !== "cancelada") return false;
    if (status === "vencida" && !contaVencida(conta)) return false;
    if (mes && String(conta.data_vencimento || "").slice(0, 7) !== mes) return false;
    const texto = normalizar([
      conta.cliente_nome, conta.cliente_cnpj, conta.descricao, conta.categoria,
      conta.numero, conta.aeronave, conta.metodo_pagamento,
    ].join(" "));
    return !busca || texto.includes(normalizar(busca));
  }), [busca, contas, mes, status]);

  const kpis = useMemo(() => {
    const soma = (items: any[]) => items.reduce((sum, conta) => sum + Number(conta.valor || 0), 0);
    return {
      total: soma(contas),
      aberto: soma(contas.filter((conta) => !contaRecebida(conta) && normalizar(conta.status) !== "cancelada")),
      vencido: soma(contas.filter(contaVencida)),
      recebido: soma(contas.filter(contaRecebida)),
    };
  }, [contas]);

  return (
    <div className="space-y-5 p-1 pb-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-400"><Wallet className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Recebíveis do caixa Share</span></div>
          <h3 className="mt-1 text-xl font-black text-foreground">Contas a Receber</h3>
          <p className="mt-1 text-sm text-muted-foreground">Tudo o que o caixa Share tem a receber de clientes e cotistas.</p>
        </div>
        <button onClick={carregar} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-card-secondary"><RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar</button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi icon={<CircleDollarSign className="h-4 w-4" />} label="Total cadastrado" value={kpis.total} tone="cyan" />
        <Kpi icon={<Clock3 className="h-4 w-4" />} label="A receber" value={kpis.aberto} tone="amber" />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Vencido" value={kpis.vencido} tone="rose" />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Já recebido" value={kpis.recebido} tone="emerald" />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-background/50 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente, documento, aeronave ou categoria" className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-emerald-500/60" /></label>
        <label className="relative block"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="month" value={mes} onChange={(event) => setMes(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-muted-foreground outline-none focus:border-emerald-500/60" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFiltro)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground outline-none focus:border-emerald-500/60"><option value="abertas">Em aberto</option><option value="todos">Todos os status</option><option value="vencida">Vencidas</option><option value="recebida">Recebidas</option><option value="cancelada">Canceladas</option></select>
      </div>

      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{erro}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-background/40">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{filtradas.length} lançamento(s) encontrado(s)</span>
          <span className="font-bold text-muted-foreground">Total filtrado: {formatBRL(filtradas.reduce((sum, conta) => sum + Number(conta.valor || 0), 0))}</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead className="bg-card/90 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 text-left">Cliente / lançamento</th><th className="px-4 py-3 text-left">Vencimento</th><th className="px-4 py-3 text-left">Categoria / aeronave</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-center">Status</th></tr></thead>
          <tbody className="divide-y divide-border/80">
            {carregando ? <tr><td colSpan={5} className="py-16 text-center text-muted-foreground">Carregando contas a receber...</td></tr>
              : filtradas.length === 0 ? <tr><td colSpan={5} className="py-16 text-center text-muted-foreground">Nenhum recebível encontrado para estes filtros.</td></tr>
              : filtradas.map((conta) => {
                const vencida = contaVencida(conta); const recebida = contaRecebida(conta);
                return (
                  <tr key={conta.id} className={`text-muted-foreground transition hover:bg-emerald-500/[0.04] ${vencida ? "bg-rose-500/[0.04]" : ""}`}>
                    <td className="px-4 py-4"><div className="font-semibold text-foreground">{conta.cliente_nome || "Cliente não informado"}</div><div className="mt-1 text-xs text-muted-foreground">{conta.descricao || "Sem descrição"} · {conta.numero || "Sem documento"}</div></td>
                    <td className={`px-4 py-4 font-medium ${vencida ? "text-rose-300" : "text-muted-foreground"}`}>{dataLocal(conta.data_vencimento) ? format(dataLocal(conta.data_vencimento)!, "dd/MM/yyyy") : "-"}</td>
                    <td className="px-4 py-4"><div className="text-muted-foreground">{conta.categoria || "Sem categoria"}</div><div className="mt-1 text-xs text-muted-foreground">{conta.aeronave || "—"}</div></td>
                    <td className="px-4 py-4 text-right font-bold text-foreground">{formatBRL(Number(conta.valor || 0))}</td>
                    <td className="px-4 py-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${vencida ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : recebida ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{recebida ? "Recebida" : vencida ? "Vencida" : conta.status || "Em aberto"}</span></td>
                  </tr>
                );
              })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "cyan" | "amber" | "rose" | "emerald" }) {
  const colors = { cyan: "text-cyan-400", amber: "text-amber-300", rose: "text-rose-300", emerald: "text-emerald-300" };
  return <div className="rounded-2xl border border-border bg-card/60 p-4"><div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${colors[tone]}`}>{icon}<span>{label}</span></div><div className="mt-2 text-lg font-black text-foreground">{formatBRL(value)}</div></div>;
}
