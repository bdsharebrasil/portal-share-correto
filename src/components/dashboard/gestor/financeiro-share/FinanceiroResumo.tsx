import React from "react";
import { ArrowDownRight, ArrowUpRight, HandCoins, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/format";

export default function FinanceiroResumo({ resumo }: { resumo: { entradas:number; saidas:number; saldo:number; aReceber:number; dgaSaldo:number; } }) {
  const cards = [
    { label:"Entradas", value:resumo.entradas, icon:ArrowUpRight, tone:"text-emerald-400" },
    { label:"Saídas", value:resumo.saidas, icon:ArrowDownRight, tone:"text-red-400" },
    { label:"A receber da Share", value:resumo.aReceber, icon:HandCoins, tone:"text-amber-400" },
    { label:"Saldo DGA", value:resumo.dgaSaldo, icon:Wallet, tone:"text-violet-400" },
  ];
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map(c=>{const I=c.icon;return <div key={c.label} className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span><I className={`h-4 w-4 ${c.tone}`} /></div><div className={`mt-2 text-2xl font-bold ${c.tone}`}>{formatBRL(c.value)}</div></div>})}</div>;
}
