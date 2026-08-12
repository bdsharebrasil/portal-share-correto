import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, History, Mail, Send, UserRound, Wallet } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const statusLabel = (status: string | null) => {
  if (status === "pago") return "Pago";
  if (status === "cancelado") return "Cancelado";
  if (status === "rascunho") return "Rascunho";
  return "Pendente";
};

const statusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "pago") return "default";
  if (status === "cancelado") return "destructive";
  if (status === "rascunho") return "secondary";
  return "outline";
};

type PaymentMovement = {
  id: string;
  descricao: string;
  fornecedor_nome: string | null;
  valor_total: number | null;
  valor_rateado: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  criado_em: string;
  criado_por: string | null;
  tipo_caixa: string | null;
  status: string;
  clientes_id: string | null;
  enviado_por_email: boolean;
  enviado_por_email_em: string | null;
  reference_type: string | null;
  reference_id: string | null;
  observacoes: string | null;
};

type PaymentEmail = {
  id: string;
  reference_id: string | null;
  destinatario: string;
  assunto: string;
  status: string;
  criado_em: string;
  enviado_por: string | null;
};

export default function HistoricoProgramacaoPagamentos() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["historico-programacao-pagamentos"],
    queryFn: async () => {
      const { data: movements, error: movementsError } = await supabase
        .from("movimentacoes")
        .select("id, descricao, fornecedor_nome, valor_total, valor_rateado, data_emissao, data_vencimento, data_pagamento, criado_em, criado_por, tipo_caixa, status, clientes_id, enviado_por_email, enviado_por_email_em, reference_type, reference_id, observacoes")
        .or("reference_type.eq.solicitacao_pagamento,reference_type.eq.travel_expense_report")
        .order("criado_em", { ascending: false });

      if (movementsError) throw movementsError;

      const rows = (movements || []) as PaymentMovement[];
      const authorIds = Array.from(new Set(rows.map((row) => row.criado_por).filter(Boolean)));
      const clientIds = Array.from(new Set(rows.map((row) => row.clientes_id).filter(Boolean)));
      const movementIds = rows.map((row) => row.id);

      const [profilesResponse, clientsResponse, emailsResponse] = await Promise.all([
        authorIds.length
          ? supabase.from("user_profiles").select("id, full_name, display_name").in("id", authorIds)
          : Promise.resolve({ data: [], error: null }),
        clientIds.length
          ? supabase.from("clientes").select("id, razao_social").in("id", clientIds)
          : Promise.resolve({ data: [], error: null }),
        movementIds.length
          ? supabase
              .from("emails_enviados")
              .select("id, reference_id, destinatario, assunto, status, criado_em, enviado_por")
              .eq("reference_type", "movimentacoes")
              .in("reference_id", movementIds)
              .order("criado_em", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResponse.error) throw profilesResponse.error;
      if (clientsResponse.error) throw clientsResponse.error;
      if (emailsResponse.error) throw emailsResponse.error;

      return {
        movements: rows,
        profiles: Object.fromEntries(
          ((profilesResponse.data || []) as Array<{ id: string; full_name: string | null; display_name?: string | null }>).map((profile) => [
            profile.id,
            profile.display_name || profile.full_name || "Usuário",
          ]),
        ) as Record<string, string>,
        clients: Object.fromEntries(
          ((clientsResponse.data || []) as Array<{ id: string; razao_social: string | null }>).map((client) => [client.id, client.razao_social || "Cliente"]),
        ) as Record<string, string>,
        emails: (emailsResponse.data || []) as PaymentEmail[],
      };
    },
  });

  const stats = useMemo(() => {
    const rows = data?.movements || [];
    const emails = data?.emails || [];
    return {
      total: rows.length,
      share: rows.filter((row) => row.tipo_caixa === "share").length,
      emails: new Set(emails.filter((email) => email.status !== "erro").map((email) => email.reference_id)).size,
      value: rows.reduce((total, row) => total + Number(row.valor_total ?? row.valor_rateado ?? 0), 0),
    };
  }, [data]);

  return (
    <Layout>
      <main className="min-h-[calc(100vh-4rem)] space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-semibold tracking-tight">Histórico de programação de pagamentos</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe a criação, o envio para a Share, os e-mails e a evolução de cada programação.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/financeiro")}>
            Voltar ao financeiro
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Registros" value={String(stats.total)} icon={<History className="h-5 w-5" />} />
          <StatCard label="Enviados à Share" value={String(stats.share)} icon={<Send className="h-5 w-5" />} />
          <StatCard label="Com e-mail enviado" value={String(stats.emails)} icon={<Mail className="h-5 w-5" />} />
          <StatCard label="Valor programado" value={formatCurrency(stats.value)} icon={<Wallet className="h-5 w-5" />} />
        </div>

        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando histórico...</CardContent></Card>
        ) : error ? (
          <Card className="border-destructive/40"><CardContent className="p-8 text-center text-destructive">Não foi possível carregar o histórico.</CardContent></Card>
        ) : data?.movements.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhuma programação de pagamento foi registrada.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {data?.movements.map((movement) => {
              const emails = data.emails.filter((email) => email.reference_id === movement.id && email.status !== "erro");
              const author = movement.criado_por ? data.profiles[movement.criado_por] || "Usuário não identificado" : "Usuário não identificado";
              const client = movement.clientes_id ? data.clients[movement.clientes_id] || "Cliente não identificado" : "Sem cliente vinculado";
              const emailed = movement.enviado_por_email || emails.length > 0;

              return (
                <Card key={movement.id} className="overflow-hidden border-border/70">
                  <CardHeader className="gap-3 border-b border-border/50 bg-muted/20 pb-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{movement.descricao || "Programação sem descrição"}</CardTitle>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {author}</span>
                        <span>Cliente: {client}</span>
                        {movement.fornecedor_nome && <span>Fornecedor: {movement.fornecedor_nome}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(movement.status)}>{statusLabel(movement.status)}</Badge>
                      {movement.tipo_caixa === "share" && <Badge variant="secondary">Caixa Share</Badge>}
                      <span className="font-semibold text-primary">{formatCurrency(movement.valor_total ?? movement.valor_rateado)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <InfoItem label="Criado em" value={formatDateTime(movement.criado_em)} />
                      <InfoItem label="Emissão" value={formatDate(movement.data_emissao)} />
                      <InfoItem label="Vencimento" value={formatDate(movement.data_vencimento)} />
                      <InfoItem label="Referência" value={movement.reference_type === "travel_expense_report" ? "Relatório de viagem" : "Solicitação de pagamento"} />
                      <InfoItem label="Envio para Share" value={movement.tipo_caixa === "share" ? "Sim" : "Não"} />
                      <InfoItem label="E-mail ao cliente" value={emailed ? "Enviado" : "Não enviado"} />
                      {movement.observacoes && <div className="sm:col-span-3"><InfoItem label="Observações" value={movement.observacoes} /></div>}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trilha da programação</p>
                      <div className="space-y-4">
                        <TimelineItem icon={<UserRound className="h-3.5 w-3.5" />} title="Programação criada" detail={`${author} • ${formatDateTime(movement.criado_em)}`} />
                        {movement.tipo_caixa === "share" && <TimelineItem icon={<Send className="h-3.5 w-3.5" />} title="Enviada ao caixa Share" detail="Registro criado no fluxo financeiro da Share" />}
                        {emailed && (
                          <TimelineItem
                            icon={<Mail className="h-3.5 w-3.5" />}
                            title="Enviada ao cliente por e-mail"
                            detail={emails[0] ? `${emails[0].destinatario} • ${formatDateTime(emails[0].criado_em)}` : formatDateTime(movement.enviado_por_email_em)}
                          />
                        )}
                        {movement.status === "pago" && <TimelineItem icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Pagamento concluído" detail={formatDateTime(movement.data_pagamento)} />}
                        {movement.status === "rascunho" && <TimelineItem icon={<Clock3 className="h-3.5 w-3.5" />} title="Salvo como rascunho" detail="A programação ainda não foi enviada" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </Layout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>;
}

function TimelineItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex gap-3"><div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">{icon}</div><div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>;
}
