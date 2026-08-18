import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  Edit3,
  HandCoins,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import BaixaPagamentoModal from "@/components/dashboard/gestor/financeiro-share/BaixaPagamentoModal";
import ReembolsoModal from "@/components/dashboard/gestor/financeiro-share/ReembolsoModal";
import EditLancamentoModal from "@/components/dashboard/gestor/financeiro-share/EditLancamentoModal";
import AttachmentViewerModal from "@/components/dashboard/gestor/financeiro-share/AttachmentViewerModal";
import NovaDespesaShareForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaShareForm";
import NovaDespesaClienteForm from "@/components/dashboard/gestor/financeiro-share/NovaDespesaClienteForm";
import { formatBRL } from "@/lib/format";
import { useClienteFinanceiro } from "@/hooks/useClienteFinanceiro";
import FinanceiroResumo from "@/components/dashboard/gestor/financeiro-share/FinanceiroResumo";
import ClienteSituacao from "@/components/dashboard/gestor/financeiro-share/ClienteSituacao";
import type { MovimentacaoFinanceira } from "@/types";
import {
  carregarCaixaShare,
  deleteMovimentacao,
  fetchFinanceiroData,
} from "@/services/financeiroService";
import DgaSituacao from "@/components/dashboard/gestor/financeiro-share/DgaSituacao";
import { classify, dateOf, fornecedorStatus, isDga, isEntrada, isShare, paidByShareForClient, valueOf } from "@/utils/financeiroRules";

export default function FluxoCaixaTab(){
  const [data,setData]=useState<any>({movimentacoes:[],rateios:[],clientes:[],socios:[]});
  const [loading,setLoading]=useState(true); const [erro,setErro]=useState<string|null>(null);
  const [aba,setAba]=useState<"visao"|"caixa"|"clientes"|"dga">("visao");
  const [busca,setBusca]=useState(""); const [mes,setMes]=useState(""); const [caixa,setCaixa]=useState<"todos"|"share"|"cliente"|"dga">("todos");
  const [baixaMov,setBaixaMov]=useState<any>(null); const [reembolsoMov,setReembolsoMov]=useState<any>(null); const [editMovId,setEditMovId]=useState<string|null>(null);
  const [attachment,setAttachment]=useState<any>(null); const [showNew,setShowNew]=useState(false); const [newCaixa,setNewCaixa]=useState<"share"|"cliente">("share");
  const queryClient=useQueryClient();

  const load=useCallback(async()=>{setLoading(true);setErro(null);try{setData(await fetchFinanceiroData())}catch(e:any){setErro(e.message||"Erro ao carregar financeiro")}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);

  const movs=useMemo(()=>data.movimentacoes.filter((m:any)=>{if(String(m.status||'').toLowerCase()==='cancelado')return false;if(caixa==='dga'&&!isDga(m))return false;if(caixa==='share'&&!isShare(m))return false;if(caixa==='cliente'&&(isDga(m)||isShare(m)))return false;if(mes&&String(dateOf(m)||'').slice(0,7)!==mes)return false;if(busca){const q=busca.toLowerCase();const text=`${m.descricao||''} ${m.fornecedor_nome||''} ${m.numero_doc||''} ${m.pago_por||''}`.toLowerCase();if(!text.includes(q))return false}return true}),[data.movimentacoes,caixa,mes,busca]);
  const resumo=useMemo(()=>{const entradas=data.movimentacoes.filter((m:any)=>!isDga(m)&&isEntrada(m)).reduce((s,m)=>s+valueOf(m),0);const saidas=data.movimentacoes.filter((m:any)=>!isDga(m)&&!isEntrada(m)).reduce((s,m)=>s+valueOf(m),0);const adiantado=data.movimentacoes.filter((m:any)=>paidByShareForClient(m)).reduce((s,m)=>s+valueOf(m),0);const recebido=data.movimentacoes.filter((m:any)=>!isDga(m)&&isEntrada(m)&&m.clientes_id).reduce((s,m)=>s+valueOf(m),0);const aReceber=Math.max(0,adiantado-recebido);const dgaEntrada=data.movimentacoes.filter((m:any)=>isDga(m)&&isEntrada(m)).reduce((s,m)=>s+valueOf(m),0);const dgaSaida=data.movimentacoes.filter((m:any)=>isDga(m)&&!isEntrada(m)&&!String(m.pago_por||'').toLowerCase().includes('cotista')&&!m.pago_diretamente).reduce((s,m)=>s+valueOf(m),0);return{entradas,saidas,saldo:entradas-saidas,aReceber,dgaSaldo:dgaEntrada-dgaSaida}},[data.movimentacoes]);

  const onBaixaSuccess=async()=>{setBaixaMov(null);await load();await queryClient.invalidateQueries({queryKey:["movimentacoes"]})};
  const onDelete=async(id:string)=>{if(!confirm("Deseja realmente excluir esta movimentação?"))return;try{await deleteMovimentacao(id);await load()}catch(e:any){setErro(e.message)}};
  const deveMostrarBotaoBaixa = (m:any) => {
    if (m?.data_pagamento || isEntrada(m)) return false;
    const texto = String([
      m?.tipo_rateio,
      m?.grupo_categoria,
      m?.categoria_nome,
      m?.categoria_id,
    ].filter(Boolean).join(" "))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[_-]+/g, " ");

    return ![
      "DESPESAS EMPRESA",
      "DESPESAS PARTICULARES",
      "DESPESAS EMPRESA - BANCO",
    ].some((grupo) => texto.includes(grupo));
  };

  if(loading)return <div className="rounded-2xl border border-border bg-card/50 p-10 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary"/><div className="mt-3 text-sm text-muted-foreground">Carregando financeiro...</div></div>;

  return <div className="space-y-5">
    {erro&&<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</div>}
    <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financeiro</div><h2 className="text-2xl font-bold">Fluxo de Caixa</h2><p className="text-sm text-muted-foreground">Share, clientes e DGA com regras financeiras separadas.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>load()} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"><RefreshCw className="inline h-3.5 w-3.5 mr-1"/>Atualizar</button><button onClick={()=>{setNewCaixa("share");setShowNew(true)}} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="inline h-3.5 w-3.5 mr-1"/>Nova movimentação</button></div></div>
    <FinanceiroResumo resumo={resumo}/>
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">{([["visao","Visão Geral"],["caixa","Caixa"],["clientes","Situação dos Clientes"],["dga","DGA — Holding"]] as const).map(([k,l])=><button key={k} onClick={()=>setAba(k)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${aba===k?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground"}`}>{l}</button>)}</div>
    {aba==="visao"&&<>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Card title="Dívidas de clientes" value={formatBRL(resumo.aReceber)} note="somente valores antecipados pela Share" tone="amber"/><Card title="Resultado líquido" value={formatBRL(resumo.saldo)} note="Share + clientes; DGA separado" tone={resumo.saldo>=0?"green":"red"}/><Card title="Saldo DGA" value={formatBRL(resumo.dgaSaldo)} note="não integra dívida de clientes" tone="violet"/></div>
      <div className="rounded-2xl border border-border bg-card/60 p-5"><div className="font-bold">Regra financeira</div><div className="mt-2 grid md:grid-cols-3 gap-3 text-sm"><Rule title="Cliente" text="Se a Share paga uma despesa do cliente, ela fica em aberto contra o cliente até o recebimento."/><Rule title="Pagamento direto" text="Se o cliente paga diretamente o fornecedor, não vira dívida com a Share."/><Rule title="DGA" text="Despesas pagas pela conta DGA não geram dívida com a Share. Pagamentos pessoais de cotistas ficam para acerto no balanço DGA."/></div></div>
    </>}
    {aba==="clientes"&&<ClienteSituacao clientes={data.clientes} movimentacoes={data.movimentacoes}/>} 
    {aba==="dga"&&<DgaSituacao movimentacoes={data.movimentacoes} socios={data.socios}/>} 
    {aba==="caixa"&&<>
      <div className="flex flex-wrap gap-2"><select value={caixa} onChange={e=>setCaixa(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="todos">Todos os caixas</option><option value="share">Caixa Share</option><option value="cliente">Caixas Cliente</option><option value="dga">DGA</option></select><select value={mes} onChange={e=>setMes(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">Todos os meses</option>{Array.from(new Set(data.movimentacoes.map((m:any)=>String(dateOf(m)||'').slice(0,7)).filter(Boolean))).sort().reverse().map((x:any)=><option key={x}>{x}</option>)}</select><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar..." className="rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm"/></div></div>
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden"><div className="p-4 border-b border-border font-bold">Lançamentos ({movs.length})</div><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">Descrição</th><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">Caixa</th><th className="text-left px-4 py-3">Pago por</th><th className="text-right px-4 py-3">Valor</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"/></tr></thead><tbody>{movs.map((m:any)=><tr key={m.id} className="border-t border-border/60 hover:bg-muted/20"><td className="px-4 py-3 whitespace-nowrap">{dateOf(m)?new Date(dateOf(m)+"T00:00:00").toLocaleDateString("pt-BR"):"—"}</td><td className="px-4 py-3"><div className="font-semibold">{m.descricao||"—"}</div><div className="text-[10px] text-muted-foreground">{classify(m).natureza}</div></td><td className="px-4 py-3">{data.clientes.find((c:any)=>c.id===m.clientes_id)?.nome||"—"}</td><td className="px-4 py-3">{isDga(m)?"DGA":isShare(m)?"Share":"Cliente"}</td><td className="px-4 py-3">{m.pago_por||"—"}</td><td className="px-4 py-3 text-right font-bold">{formatBRL(valueOf(m))}</td><td className="px-4 py-3">{fornecedorStatus(m)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{deveMostrarBotaoBaixa(m)&&<button title="Dar baixa" onClick={()=>setBaixaMov(m)} className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10"><HandCoins className="h-4 w-4"/></button>} {m.reembolsavel&&!m.reembolso_quitado&&<button title="Reembolso" onClick={()=>setReembolsoMov(m)} className="rounded p-1.5 text-amber-400 hover:bg-amber-500/10"><Wallet className="h-4 w-4"/></button>} <button title="Editar" onClick={()=>setEditMovId(m.id)} className="rounded p-1.5 text-cyan-400 hover:bg-cyan-500/10"><Edit3 className="h-4 w-4"/></button><button title="Excluir" onClick={()=>onDelete(m.id)} className="rounded p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4"/></button><button title="Detalhes" onClick={()=>setAttachment({url:m.comprovante_url||m.nf_url||m.boleto_url||m.recibo_url,title:m.descricao||"Documento"})} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><ChevronDown className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div>{movs.length===0&&<div className="p-10 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</div>}</div>
    </>}
    {showNew&&<div className="rounded-2xl border border-border bg-card/60 p-4">{newCaixa==="cliente"?<NovaDespesaClienteForm onCancel={()=>setShowNew(false)} onSaved={async()=>{setShowNew(false);await load()}}/>:<NovaDespesaShareForm onCancel={()=>setShowNew(false)} onSaved={async()=>{setShowNew(false);await load()}}/>}</div>}
    {baixaMov&&<BaixaPagamentoModal mov={baixaMov} onClose={()=>setBaixaMov(null)} onSuccess={onBaixaSuccess}/>} {reembolsoMov&&<ReembolsoModal mov={reembolsoMov} onClose={()=>setReembolsoMov(null)} onSuccess={async()=>{setReembolsoMov(null);await load()}}/>} {editMovId&&<EditLancamentoModal movId={editMovId} onClose={()=>setEditMovId(null)} onSaved={async()=>{setEditMovId(null);await load()}}/>} {attachment?.url&&<AttachmentViewerModal url={attachment.url} title={attachment.title} onClose={()=>setAttachment(null)}/>} 
  </div>;
}
function Card({title,value,note,tone}:{title:string;value:string;note:string;tone:"amber"|"green"|"red"|"violet"}){const cls={amber:"text-amber-400",green:"text-emerald-400",red:"text-red-400",violet:"text-violet-400"}[tone];return <div className="rounded-2xl border border-border bg-card/60 p-4"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div><div className={`mt-2 text-2xl font-bold ${cls}`}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div>}
function Rule({title,text}:{title:string;text:string}){return <div className="rounded-xl border border-border bg-background/40 p-3"><div className="font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{text}</div></div>}
