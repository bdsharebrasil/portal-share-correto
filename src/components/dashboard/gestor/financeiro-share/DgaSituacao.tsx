import { Fragment, useMemo, useState } from "react";
import { Building2, HandCoins, Landmark, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import {
  dateOf,
  isDga,
  isDgaCotistaOutOfPocket,
  isDgaPaidByBank,
  isEntrada,
  periodOf,
  valueOf,
} from "@/utils/financeiroRules";
import { deleteMovimentacao } from "@/services/financeiroService";
import NovaDespesaClienteForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaClienteForm";
import EditLancamentoModal from "@/components/dashboard/gestor/financeiro-share/EditLancamentoModal";

function formatarPeriodo(periodo: string) {
  const [ano, mes] = periodo.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(mes) - 1]} / ${ano}`;
}

function nomeCategoria(m: any) {
  return String(m.grupo_categoria || m.categoria_nome || "Sem categoria").trim() || "Sem categoria";
}

export default function DgaSituacao({
  movimentacoes,
  socios,
  onChanged,
}: {
  movimentacoes: any[];
  socios: any[];
  onChanged?: () => void;
}) {
  const [showNova, setShowNova] = useState(false);
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: any[] } | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState("");
  const [editMovId, setEditMovId] = useState<string | null>(null);

  const dga = useMemo(
    () => movimentacoes.filter(isDga).filter((m) => String(m.status || "").toLowerCase() !== "cancelado"),
    [movimentacoes],
  );
  const entradas = dga.filter(isEntrada).reduce((s, m) => s + valueOf(m), 0);
  const despesasBancoList = dga.filter(isDgaPaidByBank);
  const cotistasList = dga.filter(isDgaCotistaOutOfPocket);
  const saidasBanco = despesasBancoList.reduce((s, m) => s + valueOf(m), 0);
  const saidasCotistas = cotistasList.reduce((s, m) => s + valueOf(m), 0);
  const saldo = entradas - saidasBanco;

  const cotistas = useMemo(() => {
    const cotistaMap = new Map<string, number>();
    cotistasList.forEach((m) => {
      const key = m.socio_id || m.socios_nome || "Cotista não identificado";
      cotistaMap.set(key, (cotistaMap.get(key) || 0) + valueOf(m));
    });
    return Array.from(cotistaMap.entries())
      .map(([id, total]) => ({ id, total, nome: socios.find((s) => s.id === id)?.nome || id }))
      .sort((a, b) => b.total - a.total);
  }, [cotistasList, socios]);

  const mensal = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of dga) {
      const periodo = periodOf(dateOf(m));
      if (!periodo) continue;
      if (!map.has(periodo)) map.set(periodo, { periodo, aportes: 0, despesasBanco: 0, pagoCotistas: 0 });
      const row = map.get(periodo);
      if (isEntrada(m)) row.aportes += valueOf(m);
      else if (isDgaCotistaOutOfPocket(m)) row.pagoCotistas += valueOf(m);
      else row.despesasBanco += valueOf(m);
    }
    return Array.from(map.values()).sort((a, b) => b.periodo.localeCompare(a.periodo));
  }, [dga]);

  const periodos = useMemo(() => mensal.map((row) => row.periodo), [mensal]);
  const extrato = useMemo(
    () => dga
      .filter((m) => !mesSelecionado || periodOf(dateOf(m)) === mesSelecionado)
      .sort((a, b) => String(dateOf(b) || "").localeCompare(String(dateOf(a) || ""))),
    [dga, mesSelecionado],
  );
  const extratoPorCategoria = useMemo(() => {
    const grupos = new Map<string, any[]>();
    extrato.forEach((m) => {
      const categoria = nomeCategoria(m);
      if (!grupos.has(categoria)) grupos.set(categoria, []);
      grupos.get(categoria)!.push(m);
    });
    return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [extrato]);

  const abrirDetalhe = (titulo: string, filtro: (m: any) => boolean) =>
    setDetalhe({
      titulo,
      itens: dga.filter(filtro).sort((a, b) => String(dateOf(b) || "").localeCompare(String(dateOf(a) || ""))),
    });

  const excluir = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta movimentação DGA?")) return;
    try {
      await deleteMovimentacao(id);
      toast.success("Movimentação excluída.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir movimentação.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/10 p-3"><Building2 className="h-5 w-5 text-violet-400" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-violet-300/70">Entidade independente</div>
              <h2 className="text-xl font-bold">DGA</h2>
              <p className="mt-1 text-sm text-muted-foreground">Despesas e aportes vinculados ao caixa DGA.</p>
            </div>
          </div>
          <button onClick={() => setShowNova((value) => !value)} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Nova movimentação DGA
          </button>
        </div>
      </div>

      {showNova && (
        <NovaDespesaClienteForm
          modo="dga"
          onCancel={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); onChanged?.(); }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Saldo bancário" value={saldo} icon={Landmark} />
        <Kpi label="Aportes" value={entradas} icon={Landmark} onClick={() => abrirDetalhe("Aportes DGA", isEntrada)} />
        <Kpi label="Despesas banco DGA" value={saidasBanco} icon={Building2} onClick={() => abrirDetalhe("Despesas pagas pelo banco DGA", isDgaPaidByBank)} />
        <Kpi label="Pago por cotistas" value={saidasCotistas} icon={Users} onClick={() => abrirDetalhe("Despesas pagas por cotistas", isDgaCotistaOutOfPocket)} />
        <Kpi label="A acertar com cotistas" value={saidasCotistas} icon={HandCoins} onClick={() => abrirDetalhe("A acertar com cotistas", isDgaCotistaOutOfPocket)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="border-b border-border p-4">
          <div className="font-bold">Movimentação mensal da DGA</div>
          <div className="text-xs text-muted-foreground">Clique em um valor para ver os lançamentos que o compõem.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 text-left">Mês</th><th className="px-4 py-3 text-right">Aportes</th><th className="px-4 py-3 text-right">Saídas</th><th className="px-4 py-3 text-right">Pagamentos direto cotista</th></tr></thead>
            <tbody>{mensal.map((row) => {
              const periodoFormatado = formatarPeriodo(row.periodo);
              return <tr key={row.periodo} className="border-t border-border/60">
                <td className="px-4 py-3 font-semibold">{periodoFormatado}</td>
                <td className="px-4 py-3 text-right"><button className="font-semibold text-emerald-400 hover:underline" onClick={() => abrirDetalhe(`Aportes · ${periodoFormatado}`, (m) => isEntrada(m) && periodOf(dateOf(m)) === row.periodo)}>{formatBRL(row.aportes)}</button></td>
                <td className="px-4 py-3 text-right"><button className="font-semibold text-red-400 hover:underline" onClick={() => abrirDetalhe(`Despesas banco DGA · ${periodoFormatado}`, (m) => isDgaPaidByBank(m) && periodOf(dateOf(m)) === row.periodo)}>{formatBRL(row.despesasBanco)}</button></td>
                <td className="px-4 py-3 text-right"><button className="font-semibold text-amber-400 hover:underline" onClick={() => abrirDetalhe(`Pago por cotistas · ${periodoFormatado}`, (m) => isDgaCotistaOutOfPocket(m) && periodOf(dateOf(m)) === row.periodo)}>{formatBRL(row.pagoCotistas)}</button></td>
              </tr>;
            })}</tbody>
          </table>
          {mensal.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação DGA.</div>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="font-bold">Extrato DGA</div><div className="text-xs text-muted-foreground">Lançamentos agrupados por categoria. Clique em uma linha para editar.</div></div>
          <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Todos os meses</option>
            {periodos.map((periodo) => <option key={periodo} value={periodo}>{formatarPeriodo(periodo)}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-left">Descrição</th><th className="px-4 py-3 text-left">Categoria</th><th className="px-4 py-3 text-left">Pago por</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody>{extratoPorCategoria.map(([categoria, itens]) => <Fragment key={categoria}>
              <tr className="border-t border-border bg-muted/20"><td colSpan={6} className="px-4 py-2 font-bold text-violet-300">{categoria} · {formatBRL(itens.reduce((s, m) => s + valueOf(m), 0))}</td></tr>
              {itens.map((m) => <tr key={m.id} className="cursor-pointer border-t border-border/60 hover:bg-muted/20" onClick={() => setEditMovId(m.id)}>
                <td className="whitespace-nowrap px-4 py-3">{dateOf(m) ? new Date(`${String(dateOf(m)).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="px-4 py-3 font-semibold">{m.descricao || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.categoria_nome || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.socios_nome || m.pago_por || "—"}</td>
                <td className="px-4 py-3 text-right font-bold">{formatBRL(valueOf(m))}</td>
                <td className="px-4 py-3 text-right"><button aria-label="Editar" className="mr-1 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); setEditMovId(m.id); }}><Pencil className="h-3.5 w-3.5" /></button><button aria-label="Excluir" className="rounded p-1.5 text-red-400 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); void excluir(m.id); }}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>)}
            </Fragment>)}</tbody>
          </table>
          {extrato.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhum lançamento para o período.</div>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex items-center gap-2 border-b border-border p-4"><Users className="h-4 w-4 text-violet-400" /><div className="font-bold">Acertos pendentes com cotistas</div></div>
        <div className="divide-y divide-border/60">{cotistas.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pagamento pessoal de cotista identificado.</div> : cotistas.map((c) => <div key={c.id} className="flex items-center justify-between px-4 py-3"><div><div className="font-semibold">{c.nome}</div><div className="text-xs text-muted-foreground">Pago diretamente pelo cotista</div></div><div className="text-lg font-bold text-amber-400">{formatBRL(c.total)}</div></div>)}</div>
      </div>

      {detalhe && <DetalheModal titulo={detalhe.titulo} itens={detalhe.itens} onClose={() => setDetalhe(null)} />}
      {editMovId && <EditLancamentoModal movId={editMovId} onClose={() => setEditMovId(null)} onSaved={() => { setEditMovId(null); onChanged?.(); }} />}
    </div>
  );
}

function DetalheModal({ titulo, itens, onClose }: { titulo: string; itens: any[]; onClose: () => void }) {
  const total = itens.reduce((s, m) => s + valueOf(m), 0);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="text-lg font-bold">{titulo}</h3><div className="text-xs text-muted-foreground">{itens.length} lançamento(s) · total {formatBRL(total)}</div></div><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button></div><div className="max-h-[65vh] overflow-auto"><table className="w-full text-xs"><tbody>{itens.map((m) => <tr key={m.id} className="border-t border-border/60"><td className="whitespace-nowrap px-4 py-3">{dateOf(m) ? new Date(`${String(dateOf(m)).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td className="px-4 py-3 font-semibold">{m.descricao || "—"}</td><td className="px-4 py-3 text-muted-foreground">{m.categoria_nome || "—"}</td><td className="px-4 py-3 text-right font-bold">{formatBRL(valueOf(m))}</td></tr>)}</tbody></table>{itens.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Nenhum lançamento.</div>}</div></div></div>;
}

function Kpi({ label, value, icon: Icon, onClick }: { label: string; value: number; icon: any; onClick?: () => void }) {
  const Wrapper: any = onClick ? "button" : "div";
  return <Wrapper onClick={onClick} className={`rounded-xl border border-border bg-card/60 p-3 text-left ${onClick ? "transition hover:border-violet-500/40 hover:bg-violet-500/[0.06]" : ""}`}><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-violet-400" /></div><div className="mt-1 text-lg font-bold">{formatBRL(value)}</div>{onClick && <div className="mt-0.5 text-[10px] text-violet-300/70">ver lançamentos</div>}</Wrapper>;
}
