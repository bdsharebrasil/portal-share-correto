import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  History,
  Loader2,
  Mail,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HistoricoEmailsGeral } from "@/components/dashboard/financeiro/HistoricoEmailsGeral";
import { verificarEmailJaEnviado } from "@/lib/emailJaEnviado";

interface Contato {
  id: string;
  nome: string;
  email: string;
  origem: "cliente" | "socio";
}

interface AnexoEmail {
  id: string;
  origem: "Recibo" | "Nota fiscal de saída" | "Recibo de saída" | "Arquivo PDF";
  label: string;
  filename: string;
  url: string;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const filenameFromUrl = (url: string, fallback: string) =>
  url.split("?")[0].split("/").pop() || fallback;

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
  const [view, setView] = useState<"envio" | "historico">("envio");
  const [anexosDisponiveis, setAnexosDisponiveis] = useState<AnexoEmail[]>([]);
  const [anexosSelecionados, setAnexosSelecionados] = useState<string[]>([]);
  const [buscaAnexos, setBuscaAnexos] = useState("");
  const [loadingAnexos, setLoadingAnexos] = useState(false);

  const referenceIds = useMemo(() => (user?.id ? [user.id] : []), [user?.id]);

  useEffect(() => {
    let ativo = true;

    (async () => {
      setLoadingAnexos(true);
      try {
        const db = supabase as any;
        const [recibosRes, notasRes, recibosSaidaRes, contasApagarRes, contasReceberRes] =
          await Promise.all([
            db
              .from("recibos")
              .select("id, numero_recibo, descricao_servico, pdf_url, data_emissao")
              .not("pdf_url", "is", null)
              .order("data_emissao", { ascending: false })
              .limit(100),
            db
              .from("notas_fiscais_saida")
              .select("id, numero, cliente_nome, arquivo_pdf_url, data_criacao")
              .not("arquivo_pdf_url", "is", null)
              .order("data_criacao", { ascending: false })
              .limit(100),
            db
              .from("recibos_saida")
              .select("id, numero_recibo, nome_pagador, pdf_url, data_emissao")
              .not("pdf_url", "is", null)
              .order("data_emissao", { ascending: false })
              .limit(100),
            db
              .from("contas_apagar")
              .select("id, descricao, fornecedor_nome, arquivo_pdf_url, data_vencimento")
              .not("arquivo_pdf_url", "is", null)
              .order("data_vencimento", { ascending: false })
              .limit(100),
            db
              .from("contas_areceber")
              .select("id, descricao, cliente_nome, arquivo_pdf_url, data_criacao")
              .not("arquivo_pdf_url", "is", null)
              .order("data_criacao", { ascending: false })
              .limit(100),
          ]);

        const lista: AnexoEmail[] = [];
        const urls = new Set<string>();
        const adicionar = (
          id: string,
          origem: AnexoEmail["origem"],
          label: string,
          url: string | null | undefined,
          fallback: string,
        ) => {
          if (!url || urls.has(url)) return;
          urls.add(url);
          lista.push({
            id: `${origem}-${id}-${url}`,
            origem,
            label,
            filename: filenameFromUrl(url, fallback),
            url,
          });
        };

        for (const recibo of recibosRes.data || []) {
          adicionar(
            recibo.id,
            "Recibo",
            `Recibo ${recibo.numero_recibo || recibo.id}`,
            recibo.pdf_url,
            "recibo.pdf",
          );
        }
        for (const nota of notasRes.data || []) {
          adicionar(
            nota.id,
            "Nota fiscal de saída",
            `NF ${nota.numero || nota.id}${nota.cliente_nome ? ` — ${nota.cliente_nome}` : ""}`,
            nota.arquivo_pdf_url,
            "nota-fiscal.pdf",
          );
        }
        for (const recibo of recibosSaidaRes.data || []) {
          adicionar(
            recibo.id,
            "Recibo de saída",
            `Recibo de saída ${recibo.numero_recibo || recibo.id}${recibo.nome_pagador ? ` — ${recibo.nome_pagador}` : ""}`,
            recibo.pdf_url,
            "recibo-saida.pdf",
          );
        }
        for (const conta of [...(contasApagarRes.data || []), ...(contasReceberRes.data || [])]) {
          adicionar(
            conta.id,
            "Arquivo PDF",
            conta.descricao || conta.fornecedor_nome || conta.cliente_nome || `Arquivo PDF ${conta.id}`,
            conta.arquivo_pdf_url,
            "documento.pdf",
          );
        }

        if (ativo) setAnexosDisponiveis(lista);
      } catch (e) {
        if (ativo) toast.error(`Não foi possível carregar os anexos: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (ativo) setLoadingAnexos(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const anexosFiltrados = useMemo(() => {
    const termo = buscaAnexos.trim().toLocaleLowerCase();
    if (!termo) return anexosDisponiveis;
    return anexosDisponiveis.filter((anexo) =>
      `${anexo.origem} ${anexo.label} ${anexo.filename}`.toLocaleLowerCase().includes(termo),
    );
  }, [anexosDisponiveis, buscaAnexos]);

  const anexosParaEnvio = useMemo(
    () => anexosDisponiveis.filter((anexo) => anexosSelecionados.includes(anexo.id)),
    [anexosDisponiveis, anexosSelecionados],
  );

  const alternarAnexo = (id: string) => {
    setAnexosSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

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

  const enviar = async (ignorarDuplicado = false) => {
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

    if (!ignorarDuplicado) {
      const duplicado = await verificarEmailJaEnviado({ destinatario, assunto });
      if (duplicado) {
        const quando = new Date(duplicado.criado_em).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        toast.warning("Este e-mail já foi enviado", {
          description: `${duplicado.destinatario} já recebeu "${duplicado.assunto || assunto}" em ${quando}.`,
          duration: 8000,
          action: { label: "Enviar novamente", onClick: () => void enviar(true) },
        });
        return;
      }
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
          anexos: anexosParaEnvio.map(({ filename, label, url }) => ({ filename, label, url })),
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

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-sky-500" />
                  Anexos (opcional)
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={buscaAnexos}
                    onChange={(e) => setBuscaAnexos(e.target.value)}
                    placeholder="Buscar recibo, nota fiscal ou arquivo PDF..."
                    className="pl-9"
                  />
                </div>

                {anexosParaEnvio.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-md border border-sky-500/20 bg-sky-500/[0.04] p-3">
                    {anexosParaEnvio.map((anexo) => (
                      <Badge key={anexo.id} variant="secondary" className="gap-1 pr-1">
                        {anexo.label}
                        <button
                          type="button"
                          onClick={() => alternarAnexo(anexo.id)}
                          className="rounded-full p-0.5 hover:bg-background/60"
                          aria-label={`Remover ${anexo.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
                  {loadingAnexos ? (
                    <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando anexos...
                    </div>
                  ) : anexosFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      {anexosDisponiveis.length === 0
                        ? "Nenhum anexo disponível."
                        : "Nenhum anexo encontrado para esta busca."}
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {anexosFiltrados.map((anexo) => (
                        <label
                          key={anexo.id}
                          className="flex cursor-pointer items-center gap-3 p-3 text-sm transition hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={anexosSelecionados.includes(anexo.id)}
                            onChange={() => alternarAnexo(anexo.id)}
                            className="h-4 w-4 rounded border-input accent-sky-600"
                          />
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{anexo.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {anexo.origem} · {anexo.filename}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione um ou mais documentos já cadastrados. Eles serão enviados como links no e-mail.
                </p>
              </div>

              <Button onClick={() => enviar()} disabled={enviando} className="w-full bg-sky-600 hover:bg-sky-500 text-white">
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {enviando ? "Enviando..." : "Enviar e-mail"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4 md:p-5 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-500" />
              <div>
                <h2 className="text-lg font-semibold">E-mails enviados</h2>
                <p className="text-xs text-muted-foreground">Clique em uma linha para ver a mensagem e os anexos.</p>
              </div>
            </div>
            <HistoricoEmailsGeral refreshKey={historicoKey} />
          </div>
        )}
      </div>
    </div>
  );
}
