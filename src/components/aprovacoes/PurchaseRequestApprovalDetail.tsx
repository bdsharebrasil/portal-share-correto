import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, MessageSquare,
  Package, Building2, User, Calendar, FileText, AlertTriangle, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  requestId: string;
  onBack: () => void;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  enviado: { label: "Enviado", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  em_analise: { label: "Em Análise", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  reprovado: { label: "Reprovado", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  cancelado: { label: "Cancelado", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  entregue: { label: "Entregue", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

const PRIORITY_MAP: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  media: { label: "Média", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  alta: { label: "Alta", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  urgente: { label: "Urgente", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const fmtDate = (v?: string | null) => v ? format(new Date(v), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-";
const fmtCurrency = (v: number) => `R$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function PurchaseRequestApprovalDetail({ requestId, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [nivel, setNivel] = useState<"1" | "2">("1");
  const [novoStatus, setNovoStatus] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [comentario, setComentario] = useState("");
  const [comentarioSolto, setComentarioSolto] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["purchase-request-detail", requestId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["purchase-request-items", requestId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_request_items")
        .select("*")
        .eq("purchase_request_id", requestId)
        .order("numero_item", { ascending: true });
      return (data || []) as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["purchase-request-suppliers", requestId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_request_suppliers")
        .select("*")
        .eq("purchase_request_id", requestId);
      return (data || []) as any[];
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ["purchase-request-approvals", requestId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_request_approvals")
        .select("*")
        .eq("purchase_request_id", requestId)
        .order("data_acao", { ascending: false });
      return (data || []) as any[];
    },
  });

  const totalItems = useMemo(
    () => items.reduce((s: number, i: any) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0),
    [items]
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["purchase-request-detail", requestId] });
    qc.invalidateQueries({ queryKey: ["purchase-request-approvals", requestId] });
    qc.invalidateQueries({ queryKey: ["aprovacoes-orcamentos-purchases"] });
    qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  const handleSubmitDecision = async () => {
    if (!user) return;
    if (!novoStatus) {
      toast({ title: "Selecione o novo status", variant: "destructive" });
      return;
    }
    if (novoStatus === "reprovado" && !motivo.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const nivelNum = Number(nivel);
      const now = new Date().toISOString();

      // 1) update purchase_requests
      const upd: Record<string, any> = { status: novoStatus, updated_at: now };
      if (novoStatus === "aprovado") {
        if (nivelNum === 1) { upd.aprovador_1_id = user.id; upd.data_aprovacao_1 = now; }
        else { upd.aprovador_2_id = user.id; upd.data_aprovacao_2 = now; }
      } else if (novoStatus === "reprovado") {
        if (nivelNum === 1) upd.motivo_rejeicao_1 = motivo;
        else upd.motivo_rejeicao_2 = motivo;
      }
      const { error: e1 } = await (supabase as any)
        .from("purchase_requests").update(upd).eq("id", requestId);
      if (e1) throw e1;

      // 2) insert approval history row
      const acao =
        novoStatus === "aprovado" ? "aprovar" :
        novoStatus === "reprovado" ? "reprovar" :
        novoStatus === "em_analise" ? "analisar" :
        "atualizar";

      const { error: e2 } = await (supabase as any)
        .from("purchase_request_approvals").insert({
          purchase_request_id: requestId,
          user_id: user.id,
          nivel_aprovacao: nivelNum,
          acao,
          motivo: motivo || null,
          comentarios: comentario || null,
          data_acao: now,
        });
      if (e2) throw e2;

      toast({ title: "Solicitação atualizada com sucesso" });
      setNovoStatus(""); setMotivo(""); setComentario("");
      invalidateAll();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !comentarioSolto.trim()) return;
    setSavingComment(true);
    try {
      const { error } = await (supabase as any)
        .from("purchase_request_approvals").insert({
          purchase_request_id: requestId,
          user_id: user.id,
          nivel_aprovacao: Number(nivel),
          acao: "comentario",
          comentarios: comentarioSolto,
          data_acao: new Date().toISOString(),
        });
      if (error) throw error;
      setComentarioSolto("");
      toast({ title: "Comentário adicionado" });
      qc.invalidateQueries({ queryKey: ["purchase-request-approvals", requestId] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando solicitação...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground mb-4">Solicitação não encontrada</p>
        <Button variant="outline" onClick={onBack}>Voltar</Button>
      </div>
    );
  }

  const statusCfg = STATUS_MAP[request.status] || { label: request.status, className: "bg-muted" };
  const priorityCfg = request.priority ? PRIORITY_MAP[request.priority] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold text-foreground truncate">
                {request.numero_solicitacao}
              </h2>
              <Badge variant="outline" className={statusCfg.className}>{statusCfg.label}</Badge>
              {priorityCfg && (
                <Badge variant="outline" className={priorityCfg.className}>
                  {priorityCfg.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{request.descricao}</p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" /> Solicitante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{request.solicitante_nome || "-"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {request.departamento || "Sem departamento"}
              {request.centro_custo ? ` • ${request.centro_custo}` : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Datas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Solicitação:</span><span>{fmtDate(request.data_solicitacao)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Necessária:</span><span>{fmtDate(request.data_necessaria)}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium capitalize">{request.tipo || "-"}</p>
            {request.tipo_de_servico && (
              <p className="text-xs text-muted-foreground mt-1">{request.tipo_de_servico}</p>
            )}
            <p className="text-lg font-bold text-emerald-400 mt-2">{fmtCurrency(totalItems)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Observações */}
      {request.observacoes && (
        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Observações</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{request.observacoes}</CardContent>
        </Card>
      )}

      {/* Rejection reasons if any */}
      {(request.motivo_rejeicao_1 || request.motivo_rejeicao_2) && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Motivos de rejeição
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {request.motivo_rejeicao_1 && <p><span className="text-muted-foreground">Nível 1:</span> {request.motivo_rejeicao_1}</p>}
            {request.motivo_rejeicao_2 && <p><span className="text-muted-foreground">Nível 2:</span> {request.motivo_rejeicao_2}</p>}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card className="bg-white/[0.02] border-white/[0.05]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Itens ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item cadastrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.05] text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">#</th>
                    <th className="text-left py-2 px-2 font-medium">Descrição</th>
                    <th className="text-right py-2 px-2 font-medium">Qtd</th>
                    <th className="text-left py-2 px-2 font-medium">Un.</th>
                    <th className="text-right py-2 px-2 font-medium">Vlr. Unit.</th>
                    <th className="text-right py-2 px-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-b border-white/[0.02]">
                      <td className="py-2 px-2 text-muted-foreground">{it.numero_item}</td>
                      <td className="py-2 px-2">
                        {it.descricao}
                        {it.especificacoes && <p className="text-xs text-muted-foreground mt-0.5">{it.especificacoes}</p>}
                        {it.codigo_fornecedor && <p className="text-xs text-muted-foreground">Cód: {it.codigo_fornecedor}</p>}
                      </td>
                      <td className="py-2 px-2 text-right">{it.quantidade}</td>
                      <td className="py-2 px-2">{it.unidade}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(Number(it.valor_unitario))}</td>
                      <td className="py-2 px-2 text-right font-medium">
                        {fmtCurrency(Number(it.quantidade) * Number(it.valor_unitario))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="text-right py-2 px-2 font-semibold">Total</td>
                    <td className="text-right py-2 px-2 font-bold text-emerald-400">{fmtCurrency(totalItems)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppliers */}
      <Card className="bg-white/[0.02] border-white/[0.05]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Fornecedores / Cotações ({suppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma cotação registrada</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suppliers.map((s: any) => (
                <div key={s.id} className={`p-3 rounded-lg border ${s.fornecedor_selecionado ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.05] bg-white/[0.02]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.nome_fornecedor}</p>
                      {s.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {s.cnpj}</p>}
                    </div>
                    {s.fornecedor_selecionado && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Selecionado</Badge>
                    )}
                  </div>
                  <Separator className="my-2 bg-white/[0.05]" />
                  <div className="text-xs space-y-1">
                    {s.valor_cotado != null && <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-semibold text-emerald-400">{fmtCurrency(Number(s.valor_cotado))}</span></div>}
                    {s.prazo_entrega && <div className="flex justify-between"><span className="text-muted-foreground">Prazo:</span><span>{s.prazo_entrega}</span></div>}
                    {s.condicoes_pagamento && <div className="flex justify-between"><span className="text-muted-foreground">Pagto:</span><span>{s.condicoes_pagamento}</span></div>}
                    {s.email && <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="truncate ml-2">{s.email}</span></div>}
                    {s.telefone && <div className="flex justify-between"><span className="text-muted-foreground">Tel:</span><span>{s.telefone}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision panel */}
      <Card className="bg-primary/[0.02] border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Gerenciar solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Nível de aprovação</Label>
              <Select value={nivel} onValueChange={(v) => setNivel(v as "1" | "2")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Nível 1</SelectItem>
                  <SelectItem value="2">Nível 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Novo status</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="aprovado">Aprovar</SelectItem>
                  <SelectItem value="reprovado">Reprovar</SelectItem>
                  <SelectItem value="cancelado">Cancelar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {novoStatus === "reprovado" && (
            <div>
              <Label className="text-xs mb-1.5 block text-red-400">Motivo da rejeição *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da rejeição..."
                rows={2}
              />
            </div>
          )}

          <div>
            <Label className="text-xs mb-1.5 block">Comentário (opcional)</Label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Adicione observações sobre a decisão..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSubmitDecision}
              disabled={saving || !novoStatus}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar decisão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline / comments */}
      <Card className="bg-white/[0.02] border-white/[0.05]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Histórico e comentários ({approvals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              value={comentarioSolto}
              onChange={(e) => setComentarioSolto(e.target.value)}
              placeholder="Adicionar um comentário..."
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAddComment}
              disabled={savingComment || !comentarioSolto.trim()}
              variant="outline"
              className="self-start gap-2"
            >
              {savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Comentar
            </Button>
          </div>

          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada ainda</p>
          ) : (
            <div className="space-y-3">
              {approvals.map((a: any) => {
                const icon = a.acao === "aprovar" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                             a.acao === "reprovar" ? <XCircle className="h-4 w-4 text-red-400" /> :
                             a.acao === "comentario" ? <MessageSquare className="h-4 w-4 text-blue-400" /> :
                             <Clock className="h-4 w-4 text-amber-400" />;
                const label = a.acao === "aprovar" ? "Aprovou" :
                              a.acao === "reprovar" ? "Reprovou" :
                              a.acao === "comentario" ? "Comentou" :
                              a.acao === "analisar" ? "Marcou em análise" :
                              a.acao;
                return (
                  <div key={a.id} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{label}</span>
                        <Badge variant="outline" className="text-xs">Nível {a.nivel_aprovacao}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtDate(a.data_acao)}</span>
                      </div>
                      {a.motivo && (
                        <p className="text-sm text-red-300 mt-1"><span className="text-muted-foreground">Motivo:</span> {a.motivo}</p>
                      )}
                      {a.comentarios && (
                        <p className="text-sm mt-1 whitespace-pre-wrap">{a.comentarios}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
