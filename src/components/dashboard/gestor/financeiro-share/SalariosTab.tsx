import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, RefreshCw, WalletCards, AlertTriangle, ExternalLink, Banknote, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { syncSalaryPaymentToFinancial } from "@/services/financialSyncClient";
import { getPayslipPublicUrl } from "@/hooks/usePayslips";

interface Employee { id:string; full_name:string|null; email:string|null; departamento:string|null; bank_name:string|null; bank_agency:string|null; bank_account:string|null; bank_pix:string|null; }
interface Payslip { employee_id:string; month:number; year:number; file_path:string; salario_bruto:number|null; salario_liquido:number|null; desconto_inss:number|null; desconto_irrf:number|null; outros_descontos:number|null; valor_ferias:number|null; total_descontos:number|null; ocr_status:string|null; ocr_confidence:number|null; }
interface Payment { id:string; id_usuario:string; salario_bruto:number|null; salario_liquido:number|null; salario_holerite:number|null; data_pagamento:string|null; banco_pagamento:string|null; url_comprovante:string|null; url_holerite:string|null; ferias:number|null; ferias_inicio:string|null; ferias_fim:string|null; ferias_dias:number|null; decimo_terceiro_parcela1:number|null; decimo_terceiro_parcela2:number|null; observacoes:string|null; }
interface Vacation { id:string; start_date:string; end_date:string; days:number; status:string; }

const months=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const money=(v:any)=>formatBRL(Number(v)||0);
const dateBR=(v?:string|null)=>v?new Date(`${v.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";
const input="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";
const toNumber=(v:string|number|null|undefined)=>{if(v===null||v===undefined||v==="")return 0;if(typeof v==="number")return Number.isFinite(v)?v:0;const s=String(v).trim();return Number(s.includes(",")?s.replace(/\./g,"").replace(",","."):s)||0};

export default function SalariosTab(){
 const qc=useQueryClient(); const now=new Date();
 const [month,setMonth]=useState(now.getMonth()+1),[year,setYear]=useState(now.getFullYear());
 const [employees,setEmployees]=useState<Employee[]>([]),[payslips,setPayslips]=useState<Record<string,Payslip|null>>({}),[payments,setPayments]=useState<Record<string,Payment|null>>({}),[vacations,setVacations]=useState<Record<string,Vacation[]>>({});
 const [open,setOpen]=useState<string|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState<string|null>(null),[toast,setToast]=useState<string|null>(null);
 const [bank,setBank]=useState<Record<string,string>>({}),[payDate,setPayDate]=useState<Record<string,string>>({}),[proof,setProof]=useState<Record<string,string>>({});

 const load=useCallback(async()=>{
  setLoading(true);setToast(null);
  try{
   const {data:emps,error:ee}=await supabase.from("user_profiles").select("id,full_name,email,departamento,bank_name,bank_agency,bank_account,bank_pix").eq("tipo","colaborador").eq("employment_status","ativo").order("full_name"); if(ee)throw ee;
   const list=(emps||[]) as Employee[]; setEmployees(list); const ids=list.map(x=>x.id); if(!ids.length){setLoading(false);return;}
   const [{data:ps,error:pe},{data:pg,error:ge},{data:vr,error:ve}]=await Promise.all([
    (supabase as any).from("employee_payslips").select("employee_id,month,year,file_path,salario_bruto,salario_liquido,desconto_inss,desconto_irrf,outros_descontos,valor_ferias,total_descontos,ocr_status,ocr_confidence").in("employee_id",ids).eq("month",month).eq("year",year),
    (supabase as any).from("historico_pagamentos_funcionarios").select("*").in("id_usuario",ids).eq("mes_referencia",month).eq("ano_referencia",year),
    (supabase as any).from("vacation_requests").select("id,user_id,start_date,end_date,days,status").in("user_id",ids).order("start_date",{ascending:false})
   ]); if(pe)throw pe;if(ge)throw ge;if(ve)throw ve;
   const pm:Record<string,Payslip|null>={},gm:Record<string,Payment|null>={},vm:Record<string,Vacation[]>={}; const bm:Record<string,string>={},dm:Record<string,string>={},cm:Record<string,string>={};
   (ps||[]).forEach((p:any)=>pm[p.employee_id]=p); (pg||[]).forEach((p:any)=>gm[p.id_usuario]=p); (vr||[]).forEach((v:any)=>(vm[v.user_id]??=[]).push(v));
   list.forEach(e=>{const g=gm[e.id];bm[e.id]=g?.banco_pagamento??"";dm[e.id]=g?.data_pagamento??"";cm[e.id]=g?.url_comprovante??""});
   setPayslips(pm);setPayments(gm);setVacations(vm);setBank(bm);setPayDate(dm);setProof(cm);
  }catch(e:any){setToast(e.message||"Não foi possível carregar a folha.")}finally{setLoading(false)}
 },[month,year]);
 useEffect(()=>{load()},[load]);

 const totals=useMemo(()=>{let due=0,paid=0,pending=0;employees.forEach(e=>{const p=payslips[e.id],g=payments[e.id];const n=Number(p?.salario_liquido||0);due+=n;if(g?.data_pagamento)paid+=Number(g.salario_liquido||0);else if(n)pending+=n});return{due,paid,pending}},[employees,payslips,payments]);
 const uploadProof=async(id:string,file:File)=>{try{const ext=file.name.split(".").pop();const path=`pagamento-salario/comprovantes/${Date.now()}_${id}.${ext}`;const {error}=await supabase.storage.from("comprovantes").upload(path,file,{upsert:true});if(error)throw error;const {data}=supabase.storage.from("comprovantes").getPublicUrl(path);setProof(x=>({...x,[id]:data.publicUrl}));setToast("Comprovante anexado. Registre o pagamento para concluir.")}catch(e:any){setToast(e.message||"Erro no upload do comprovante.")}};

 const registerPayment=async(id:string)=>{
  const e=employees.find(x=>x.id===id),p=payslips[id];if(!e||!p)return;
  if(!p.salario_bruto||!p.salario_liquido) {setToast("O holerite ainda não possui bruto e líquido válidos.");return}
  setSaving(id);setToast(null);
  try{
   const vacationsForEmployee=vacations[id]||[];
   const vacation=vacationsForEmployee.find(v=>v.status==="approved"&&p.valor_ferias&&Number(p.valor_ferias)>0);
   const paymentPayload={id_usuario:id,mes_referencia:month,ano_referencia:year,salario_holerite:Number(p.salario_bruto),salario_bruto:Number(p.salario_bruto),salario_liquido:Number(p.salario_liquido),descontos_detalhes:[{tipo:"INSS",valor:Number(p.desconto_inss)||0},{tipo:"IRRF",valor:Number(p.desconto_irrf)||0},{tipo:"Outros descontos",valor:Number(p.outros_descontos)||0}],ferias:p.valor_ferias?Number(p.valor_ferias):null,ferias_inicio:vacation?.start_date||null,ferias_fim:vacation?.end_date||null,ferias_dias:vacation?.days||null,banco_pagamento:bank[id]||null,data_pagamento:payDate[id]||new Date().toISOString().slice(0,10),url_holerite:getPayslipPublicUrl(p.file_path),url_comprovante:proof[id]||null,observacoes:"Pagamento registrado pelo Financeiro a partir do holerite apurado pela Contabilidade.",atualizado_em:new Date().toISOString()};
   let paymentId=payments[id]?.id;
   if(paymentId){const {error}=await (supabase as any).from("historico_pagamentos_funcionarios").update(paymentPayload).eq("id",paymentId);if(error)throw error}
   else{const {data,error}=await (supabase as any).from("historico_pagamentos_funcionarios").insert({...paymentPayload,criado_em:new Date().toISOString()}).select("id").single();if(error)throw error;paymentId=data.id}
   const sync=await syncSalaryPaymentToFinancial(paymentId,id,e.full_name||"Colaborador",id,{salary_net:Number(p.salario_liquido),ferias:p.valor_ferias?Number(p.valor_ferias):0,comprovante_url:proof[id]||null,obs:paymentPayload.observacoes,banco:bank[id]||null,data_pagamento:paymentPayload.data_pagamento});
   if(!sync.success)throw new Error(sync.error||"Pagamento salvo, mas não foi sincronizado no Financeiro.");
   if(vacation && new Date(`${vacation.end_date}T23:59:59`) < new Date()) await (supabase as any).from("vacation_requests").update({status:"gozada"}).eq("id",vacation.id);
   await load();qc.invalidateQueries({queryKey:["vacation-history",id]});setToast(`Pagamento de ${e.full_name||"colaborador"} registrado com sucesso.`);
  }catch(err:any){setToast(err.message||"Erro ao registrar pagamento.")}finally{setSaving(null)}
 };

 return <div className="space-y-5">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-bold">Salários</h2><p className="text-sm text-muted-foreground">Conferência da folha e registro do pagamento pelo Financeiro.</p></div><div className="flex flex-wrap gap-2"><select className={input+" w-auto"} value={month} onChange={e=>setMonth(Number(e.target.value))}>{months.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select><select className={input+" w-auto"} value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:6},(_,i)=>now.getFullYear()-2+i).map(y=><option key={y}>{y}</option>)}</select><button onClick={load} disabled={loading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><RefreshCw className={"mr-2 inline h-4 w-4 "+(loading?"animate-spin":"")}/>Atualizar</button></div></div>
  {toast&&<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{toast}</div>}
  <div className="grid gap-3 sm:grid-cols-3"><Kpi icon={WalletCards} title="Total apurado" value={money(totals.due)}/><Kpi icon={CheckCircle2} title="Total pago" value={money(totals.paid)}/><Kpi icon={AlertTriangle} title="Pendente" value={money(totals.pending)}/></div>
  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><LockKeyhole className="mr-2 inline h-4 w-4"/><strong>Regra do módulo:</strong> a Contabilidade informa os valores e anexa o holerite. <strong>Somente o Financeiro registra o pagamento.</strong></div>
  {loading?<div className="py-12 text-center text-muted-foreground">Carregando folha...</div>:<div className="space-y-3">{employees.map(e=>{const p=payslips[e.id],g=payments[e.id],expanded=open===e.id,paid=Boolean(g?.data_pagamento);return <div key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card/60"><button className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30" onClick={()=>setOpen(expanded?null:e.id)}><div className="flex min-w-0 items-center gap-3">{expanded?<ChevronDown className="h-4 w-4 text-primary"/>:<ChevronRight className="h-4 w-4 text-primary"/>}<div className="min-w-0"><div className="truncate font-semibold">{e.full_name||"Sem nome"}</div><div className="truncate text-xs text-muted-foreground">{e.departamento||e.email||"Colaborador"}</div></div></div><div className="flex items-center gap-2">{paid?<span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Pago</span>:<span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">Pendente</span>}<span className="hidden text-sm font-bold sm:block">{money(p?.salario_liquido)}</span></div></button>{expanded&&<div className="space-y-5 border-t border-border p-4">
   <div className="grid gap-3 md:grid-cols-4"><Metric label="Bruto" value={money(p?.salario_bruto)}/><Metric label="Líquido" value={money(p?.salario_liquido)}/><Metric label="Férias no holerite" value={money(p?.valor_ferias)}/><Metric label="Status" value={paid?"Pago":"Aguardando pagamento"}/></div>
   <div className="rounded-xl border border-border p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-semibold">Holerite da competência</p><p className="text-xs text-muted-foreground">Documento e valores apurados pela Contabilidade.</p></div>{p&&<a href={getPayslipPublicUrl(p.file_path)} target="_blank" rel="noreferrer" className="whitespace-nowrap text-sm font-semibold text-primary"><FileText className="mr-1 inline h-4 w-4"/>Abrir holerite<ExternalLink className="ml-1 inline h-3 w-3"/></a>}</div>{p?<div className="grid gap-3 sm:grid-cols-4"><Metric label="Bruto" value={money(p.salario_bruto)}/><Metric label="INSS" value={money(p.desconto_inss)}/><Metric label="IRRF" value={money(p.desconto_irrf)}/><Metric label="Líquido" value={money(p.salario_liquido)}/></div>:<div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Ainda não há holerite anexado para esta competência.</div>}</div>
   <div className="rounded-xl border border-border p-4"><p className="mb-3 font-semibold">Férias e direitos relacionados</p>{(vacations[e.id]||[]).filter(v=>["pending","approved","agendada","scheduled","em_andamento","in_progress","gozada","taken","completed"].includes(v.status)).slice(0,5).map(v=><div key={v.id} className="flex flex-col gap-1 border-b border-border py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between"><span>{dateBR(v.start_date)} → {dateBR(v.end_date)} · {v.days} dias</span><span className="text-xs font-semibold uppercase text-muted-foreground">{v.status}</span></div>)}{!(vacations[e.id]||[]).length&&<p className="text-sm text-muted-foreground">Nenhuma férias registrada.</p>}</div>
   {!paid&&<><div className="grid gap-3 md:grid-cols-3"><div><label className="mb-1 block text-xs font-semibold">Conta de origem</label><input className={input} value={bank[e.id]||""} onChange={x=>setBank(b=>({...b,[e.id]:x.target.value}))} placeholder="Banco / conta"/></div><div><label className="mb-1 block text-xs font-semibold">Data do pagamento</label><input className={input} type="date" value={payDate[e.id]||new Date().toISOString().slice(0,10)} onChange={x=>setPayDate(d=>({...d,[e.id]:x.target.value}))}/></div><div><label className="mb-1 block text-xs font-semibold">Comprovante bancário</label>{proof[e.id]?<a href={proof[e.id]} target="_blank" rel="noreferrer" className="block rounded-xl border p-2.5 text-sm text-primary"><ExternalLink className="mr-1 inline h-4 w-4"/>Ver comprovante</a>:<label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-sm text-muted-foreground"><Banknote className="h-4 w-4"/>Anexar comprovante<input type="file" className="hidden" accept="image/*,application/pdf" onChange={x=>{const f=x.target.files?.[0];if(f)uploadProof(e.id,f)}}/></label>}</div></div><div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Conferido pelo Financeiro?</p><p className="text-xs text-muted-foreground">O botão abaixo é a única ação que registra o pagamento e envia a movimentação financeira.</p></div><button disabled={saving===e.id||!p} onClick={()=>registerPayment(e.id)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving===e.id?<><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Registrando...</>:"Registrar pagamento"}</button></div></>}
   {paid&&<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-500"/>Pagamento registrado em {dateBR(g?.data_pagamento)}. {g?.url_comprovante&&<a className="ml-1 font-semibold text-primary" href={g.url_comprovante} target="_blank" rel="noreferrer">Ver comprovante</a>}</div>}
  </div>}</div>})}</div>}
 </div>
}
function Kpi({icon:Icon,title,value}:{icon:any,title:string,value:string}){return <div className="rounded-2xl border border-border bg-card p-4"><Icon className="mb-3 h-5 w-5 text-primary"/><p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p><p className="mt-1 text-xl font-bold">{value}</p></div>}
function Metric({label,value}:{label:string,value:string}){return <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>}
