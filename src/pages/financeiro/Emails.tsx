import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, Send, History, RefreshCw, Loader2, PlusCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EnviarEmailClienteDialog } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { HistoricoEmailsEnviados } from "@/components/dashboard/financeiro/HistoricoEmailsEnviados";

interface Contato {
  id: string;
  nome: string;
  email: string;
  origem: "cliente" | "socio";
}

interface MovimentacaoEmailResumo {
  id: string;
  descricao?: string | null;
  numero_recibo?: string | null;
  numero_nf?: string | null;
  valor?: number | null;
  tipo?: string | null;
  enviado_por_email?: boolean | null;
  enviado_por_email_em?: string | null;
  criado_em?: string | null;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function EmailsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [assunto, setAssunto] = useState("Atualização financeira");
  const [mensagem, setMensagem] = useState("Olá, segue uma atualização financeira referente ao dashboard da Share Brasil.");
  const [enviando, setEnviando] = useState(false);
  const [historicoKey, setHistoricoKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"envio" | "historico">("envio");
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEmailResumo[]>([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false);

  const referenceIds = useMemo(() => (user?.id ? [user.id] : []), [user?.id]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoadingContatos(true);
      try {
        const [clientesRes, sociosRes] = await Promise.all([
          (supabase as any).from("clientes").select("id, razao_social, email").not("email", "is", null),
          (supabase as any).from("socios").select("id, nome, email, clientes_id").not("email", "is", null),
        ]);

        const lista: Contato[] = [];
        for (const c of clientesRes.data || []) {
          if (c.email && isEmail(c.email)) {
            lista.push({ id: `cliente-${c.id}`, nome: c.razao_social || "Cliente", email: c.email, origem: "cliente" });
          }
        }
        for (const s of sociosRes.data || []) {
          if (s.email && isEmail(s.email)) {
            lista.push({ id: `socio-${s.id}`, nome: s.nome || "Sócio", email: s.email, origem: "socio" });
          }
        }
        if (ativo) setContatos(lista);
      } finally {
        if (ativo) setLoadingContatos(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const adicionarCc = (raw?: string) => {
    const fonte = (raw ?? ccInput) || "";
    const novos = fonte
      .split(/[,;\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    const invalidos = novos.filter((v) => !isEmail(v));
    if (invalidos.length > 0) {
      toast.error(`E-mail inválido: ${invalidos.join(", ")}`);
      return;
    }
    if (novos.length === 0) return;
    setCcList((prev) => Array.from(new Set([...prev, ...novos])));
    setCcInput("");
  };

  const enviar = async () => {
    if (!isEmail(destinatario)) {
      toast.error("Informe um e-mail válido para o destinatário");
      return;
    }
    if (!assunto.trim()) {
      toast.error("Informe o assunto do e-mail");
      return;
    }
    if (!mensagem.trim()) {
      toast.error("Escreva a mensagem do e-mail");
      return;
    }

    setEnviando(true);
    try {
      const ccFinal = Array.from(
        new Set([
          ...ccList,
          ...ccInput
            .split(/[,;\s]+/)
            .map((v) => v.trim())
            .filter((v) => isEmail(v)),
        ]),
      );

      const { data, error } = await supabase.functions.invoke("enviar-email-cliente", {
        body: {
          to: destinatario.trim(),
          cc: ccFinal.length === 0 ? null : ccFinal.length === 1 ? ccFinal[0] : ccFinal,
          cc_list: ccFinal,
          assunto: assunto.trim(),
          mensagem: mensagem.trim(),
          anexos: [],
          tipo: "dashboard_financeiro",
          reference_type: "dashboard_financeiro",
          reference_ids: referenceIds,
        },
      });

      if (error) {
        const detalhe = (error as any)?.context
          ? await (error as any).context.text().catch(() => error.message)
          : error.message;
        throw new Error(detalhe);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("E-mail enviado com sucesso");
      setHistoricoKey((k) => k + 1);
    } catch (e) {
      toast.error(`Falha ao enviar e-mail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnviando(false);
    }
  };

  const carregarMovimentacoes = async () => {
    if (!user?.id) return;
    setLoadingMovimentacoes(true);
    try {
      const { data, error } = await (supabase as any)
        .from("movimentacoes")
        .select("id, descricao, numero_recibo, numero_nf, valor, tipo, enviado_por_email, enviado_por_email_em, criado_em")
        .or(`reference_id.eq.${user.id},contas_apagar_id.eq.${user.id},contas_areceber_id.eq.${user.id}`)
        .order("criado_em", { ascending: false })
        .limit(20);

      if (error) throw error;
      setMovimentacoes((data || []) as MovimentacaoEmailResumo[]);
    } catch (e) {
      console.error("Erro ao carregar movimentações para histórico", e);
    } finally {
      setLoadingMovimentacoes(false);
    }
  };

  useEffect(() => {
    carregarMovimentacoes();
  }, [user?.id, historicoKey]);

  const refreshHistory = async () => {
    setRefreshing(true);
    try {
      setHistoricoKey((k) => k + 1);
      toast.success("Histórico atualizado");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro") }>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-sky-500" />
                <h1 className="text-2xl font-semibold text-foreground">E-mails</h1>
              </div>
              <p className="text-sm text-muted-foreground">Envie mensagens e acompanhe o histórico de envios.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === "envio" ? "default" : "outline"}
            className={view === "envio" ? "bg-sky-600 hover:bg-sky-500 text-white" : ""}
            onClick={() => setView("envio")}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar um email
          </Button>
          <Button
            variant={view === "historico" ? "default" : "outline"}
            className={view === "historico" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""}
            onClick={() => setView("historico")}
          >
            <History className="mr-2 h-4 w-4" />
            Ver emails enviados
          </Button>
        </div>

        {view === "envio" ? (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4 md:p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-sky-500" />
              <h2 className="text-lg font-semibold">Novo envio</h2>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Contato cadastrado</Label>
                <select
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={loadingContatos}
                >
                  <option value="">{loadingContatos ? "Carregando contatos..." : "Selecionar e-mail cadastrado"}</option>
                  {contatos.map((c) => (
                    <option key={c.id} value={c.email}>
                      {c.origem === "socio" ? "👤" : "🏢"} {c.nome} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Para *</Label>
                <Input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="cliente@empresa.com" />
              </div>

              <div className="grid gap-2">
                <Label>Cópia (opcional)</Label>
                <div className="flex gap-2">
                  <Input value={ccInput} onChange={(e) => setCcInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "," || e.key === ";") { e.preventDefault(); adicionarCc(); } }} onBlur={() => ccInput.trim() && adicionarCc()} placeholder="financeiro@empresa.com" />
                  <Button type="button" variant="outline" size="icon" onClick={() => adicionarCc()}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
                {ccList.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ccList.map((mail) => (
                      <Badge key={mail} variant="secondary" className="gap-1 pr-1">
                        {mail}
                        <button type="button" onClick={() => setCcList((prev) => prev.filter((m) => m !== mail))} className="rounded-full hover:bg-background/60 p-0.5" aria-label={`Remover ${mail}`}>
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Assunto *</Label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Mensagem *</Label>
                <Textarea rows={8} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
              </div>

              <Button onClick={enviar} disabled={enviando} className="w-full bg-sky-600 hover:bg-sky-500 text-white">
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {enviando ? "Enviando..." : "Enviar e-mail"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4 md:p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-500" />
                <h2 className="text-lg font-semibold">Histórico</h2>
              </div>
              <Button variant="outline" size="sm" onClick={refreshHistory} disabled={refreshing}>
                {refreshing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                Atualizar
              </Button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Movimentações</p>
                {loadingMovimentacoes ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando registros...
                  </div>
                ) : movimentacoes.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {movimentacoes.map((mov) => (
                      <div key={mov.id} className="rounded-md border border-border/50 bg-card/50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{mov.descricao || "Movimentação"}</p>
                            <p className="text-xs text-muted-foreground">
                              Recibo: {mov.numero_recibo || "—"} • NF: {mov.numero_nf || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {mov.enviado_por_email ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" /> enviado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-amber-600">
                                <AlertCircle className="h-3.5 w-3.5" /> pendente
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Tipo: {mov.tipo || "—"}</span>
                          <span>Valor: {mov.valor != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(mov.valor)) : "—"}</span>
                          {mov.enviado_por_email_em && <span>Enviado em: {new Date(mov.enviado_por_email_em).toLocaleString("pt-BR")}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <HistoricoEmailsEnviados referenceType="dashboard_financeiro" referenceIds={referenceIds} refreshKey={historicoKey} className="border-0 bg-transparent p-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
