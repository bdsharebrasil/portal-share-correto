import React, { useMemo, useState } from "react";
import { Building2, HandCoins, Landmark, Plus, Users, X } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { dateOf, isDga, isDgaCotistaOutOfPocket, isDgaPaidByBank, isEntrada, periodOf, valueOf } from "@/utils/financeiroRules";
import NovaMovimentacaoDgaModal from "@/components/dashboard/gestor/financeiro-share/NovaMovimentacaoDgaModal";

export default function DgaSituacao({ movimentacoes, socios, onChanged }: { movimentacoes:any[]; socios:any[]; onChanged?: () => void }) {
  const [showNova, setShowNova] = useState(false);
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: any[] } | null>(null);

  const dga = movimentacoes.filter(isDga).filter(m=>String(m.status||'').toLowerCase()!=="cancelado");
  const entradas = dga.filter(isEntrada).reduce((s,m)=>s+valueOf(m),0);
  const despesasBancoList = dga.filter(isDgaPaidByBank);
  const cotistasList = dga.filter(isDgaCotistaOutOfPocket);
  const saidasBanco = despesasBancoList.reduce((s,m)=>s+valueOf(m),0);
  const saidasCotistas = cotistasList.reduce((s,m)=>s+valueOf(m),0);
  const saldo = entradas - saidasBanco;
  const cotistaMap = new Map<string,number>();
  cotistasList.forEach(m=>{const key=m.socio_id||m.socios_nome||"Cotista não identificado";cotistaMap.set(key,(cotistaMap.get(key)||0)+valueOf(m))});
  const cotistas = Array.from(cotistaMap.entries()).map(([id,total])=>({id,total,nome:socios.find(s=>s.id===id)?.nome||id})).sort((a,b)=>b.total-a.total);
  const mensal = useMemo(()=>{const map=new Map<string,any>();for(const m of dga){const p=periodOf(dateOf(m));if(!p)continue;if(!map.has(p))map.set(p,{periodo:p,aportes:0,despesasBanco:0,pagoCotistas:0});const r=map.get(p);if(isEntrada(m))r.aportes+=valueOf(m);else if(isDgaCotistaOutOfPocket(m))r.pagoCotistas+=valueOf(m);else r.despesasBanco+=valueOf(m);}return Array.from(map.values()).sort((a,b)=>a.periodo.localeCompare(b.periodo))},[dga]);

  const abrirDetalhe = (titulo: string, filtro: (m:any)=>boolean) =>
    setDetalhe({ titulo, itens: dga.filter(filtro).sort((a,b)=>String(dateOf(b)||"").localeCompare(String(dateOf(a)||""))) });

  return <div className="space-y-5">
  <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="flex items-start gap-3"><div className="rounded-xl bg-violet-500/10 p-3"><Building2 className="h-5 w-5 text-violet-400"/></div><div><div className="text-xs uppercase tracking-wider text-violet-300/70">Entidade independente</div><h2 className="text-xl font-bold">DGA </h2><p className="mt-1 text-sm text-muted-foreground">Despesas pagas pelo banco da DGA (conta <strong>DGA - BRADESCO</strong>) não geram dívida com a Share. Quando a movimentação usa outra conta, ela é registrada como paga direto do bolso do cotista/cliente e fica para acerto no balanço da DGA.</p></div></div><button onClick={()=>setShowNova(true)} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="mr-1 inline h-3.5 w-3.5"/>Nova movimentação DGA</button></div></div>

  <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
    <Kpi label="Saldo bancário" value={saldo} icon={Landmark}/>
    <Kpi label="Aportes" value={entradas} icon={Landmark} onClick={()=>abrirDetalhe("Aportes DGA", isEntrada)}/>
    <Kpi label="Despesas banco DGA" value={saidasBanco} icon={Building2} onClick={()=>abrirDetalhe("Despesas pagas pelo banco DGA", isDgaPaidByBank)}/>
    <Kpi label="Pago por cotistas" value={saidasCotistas} icon={Users} onClick={()=>abrirDetalhe("Despesas pagas por cotistas", isDgaCotistaOutOfPocket)}/>
    <Kpi label="A acertar com cotistas" value={saidasCotistas} icon={HandCoins} onClick={()=>abrirDetalhe("A acertar com cotistas", isDgaCotistaOutOfPocket)}/>
  </div>

  <div className="rounded-2xl border border-border bg-card/60 overflow-hidden"><div className="p-4 border-b border-border"><div className="font-bold">Movimentação mensal da DGA</div><div className="text-xs text-muted-foreground">Clique em um valor para ver os lançamentos que o compõem.</div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="text-left px-4 py-3">Mês</th><th className="text-right px-4 py-3">Aportes</th><th className="text-right px-4 py-3">Despesas banco</th><th className="text-right px-4 py-3">Pago cotistas</th></tr></thead><tbody>{mensal.map(r=><tr key={r.periodo} className="border-t border-border/60"><td className="px-4 py-3 font-semibold">{r.periodo}</td>
    <td className="px-4 py-3 text-right"><button className="font-semibold text-emerald-400 hover:underline" onClick={()=>abrirDetalhe(`Aportes · ${r.periodo}`,(m)=>isEntrada(m)&&periodOf(dateOf(m))===r.periodo)}>{formatBRL(r.aportes)}</button></td>
    <td className="px-4 py-3 text-right"><button className="font-semibold text-red-400 hover:underline" onClick={()=>abrirDetalhe(`Despesas banco DGA · ${r.periodo}`,(m)=>isDgaPaidByBank(m)&&periodOf(dateOf(m))===r.periodo)}>{formatBRL(r.despesasBanco)}</button></td>
    <td className="px-4 py-3 text-right"><button className="font-semibold text-amber-400 hover:underline" onClick={()=>abrirDetalhe(`Pago por cotistas · ${r.periodo}`,(m)=>isDgaCotistaOutOfPocket(m)&&periodOf(dateOf(m))===r.periodo)}>{formatBRL(r.pagoCotistas)}</button></td>
  </tr>)}</tbody></table></div></div>

  <div className="rounded-2xl border border-border bg-card/60 overflow-hidden"><div className="p-4 border-b border-border flex items-center gap-2"><Users className="h-4 w-4 text-violet-400"/><div className="font-bold">Acertos pendentes com cotistas</div></div><div className="divide-y divide-border/60">{cotistas.length===0?<div className="p-8 text-center text-sm text-muted-foreground">Nenhum pagamento pessoal de cotista identificado.</div>:cotistas.map(c=><div key={c.id} className="flex items-center justify-between px-4 py-3"><div><div className="font-semibold">{c.nome}</div><div className="text-xs text-muted-foreground">Pago diretamente pelo cotista</div></div><div className="text-lg font-bold text-amber-400">{formatBRL(c.total)}</div></div>)}</div></div>

  {detalhe && <DetalheModal titulo={detalhe.titulo} itens={detalhe.itens} onClose={()=>setDetalhe(null)}/>}
  {showNova && <NovaMovimentacaoDgaModal onClose={()=>setShowNova(false)} onSaved={()=>{setShowNova(false);onChanged?.()}}/>}
  </div>;
}

function DetalheModal({titulo,itens,onClose}:{titulo:string;itens:any[];onClose:()=>void}){
  const total = itens.reduce((s,m)=>s+valueOf(m),0);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
    <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="text-lg font-bold">{titulo}</h3><div className="text-xs text-muted-foreground">{itens.length} lançamento(s) · total {formatBRL(total)}</div></div><button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4"/></button></div>
      <div className="max-h-[65vh] overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted/40"><tr className="text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-left">Descrição</th><th className="px-4 py-3 text-left">Categoria</th><th className="px-4 py-3 text-left">Conta</th><th className="px-4 py-3 text-left">Pago por</th><th className="px-4 py-3 text-right">Valor</th></tr></thead><tbody>{itens.map(m=><tr key={m.id} className="border-t border-border/60"><td className="px-4 py-3 whitespace-nowrap">{dateOf(m)?new Date(String(dateOf(m)).slice(0,10)+"T00:00:00").toLocaleDateString("pt-BR"):"—"}</td><td className="px-4 py-3 font-semibold">{m.descricao||"—"}</td><td className="px-4 py-3 text-muted-foreground">{m.categoria_nome||"—"}</td><td className="px-4 py-3 text-muted-foreground">{m.conta_bancaria||"—"}</td><td className="px-4 py-3 text-muted-foreground">{m.socios_nome||m.pago_por||"—"}</td><td className="px-4 py-3 text-right font-bold">{formatBRL(valueOf(m))}</td></tr>)}</tbody></table>{itens.length===0&&<div className="p-10 text-center text-sm text-muted-foreground">Nenhum lançamento.</div>}</div>
    </div>
  </div>;
}

function Kpi({label,value,icon:Icon,onClick}:{label:string;value:number;icon:any;onClick?:()=>void}){
  const Wrapper:any = onClick ? "button" : "div";
  return <Wrapper onClick={onClick} className={`rounded-xl border border-border bg-card/60 p-3 text-left ${onClick?"transition hover:border-violet-500/40 hover:bg-violet-500/[0.06]":""}`}><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-violet-400"/></div><div className="mt-1 text-lg font-bold">{formatBRL(value)}</div>{onClick&&<div className="mt-0.5 text-[10px] text-violet-300/70">ver lançamentos</div>}</Wrapper>;
}