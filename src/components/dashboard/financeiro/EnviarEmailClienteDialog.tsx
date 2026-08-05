import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Paperclip, Send, CheckCircle2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HistoricoEmailsEnviados } from "./HistoricoEmailsEnviados";
import { marcarMovimentacoesEnviadasPorEmail } from "@/lib/movimentacoesEmailFlag";
import { verificarEmailJaEnviado } from "@/lib/emailJaEnviado";

export interface AnexoEmail {
  filename: string;
  url: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Cliente principal — usado para pré-selecionar o e-mail. */
  clienteId?: string | null;
  assuntoSugerido?: string;
  mensagemSugerida?: string;
  anexos?: AnexoEmail[];
  tipo?: string;
  referenceType?: string;
  referenceIds?: string[];
  /** Números de documento (recibo, NF, boleto) para marcar as movimentações relacionadas. */
  numerosDocumento?: string[];
  onEnviado?: () => void;
}

type Contato = { id: string; nome: string; email: string; origem: "cliente" | "socio" };

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function EnviarEmailClienteDialog({
  open,
  onOpenChange,
  clienteId,
  assuntoSugerido = "",
  mensagemSugerida = "",
  anexos = [],
  tipo = "solicitacao_pagamento",
  referenceType = "contas_apagar",
  referenceIds = [],
  numerosDocumento = [],
  onEnviado,
}: Props) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [assunto, setAssunto] = useState(assuntoSugerido);
  const [mensagem, setMensagem] = useState(mensagemSugerida);
  const [selecionados, setSelecionados] = useState<string[]>(anexos.map((a) => a.url));
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [historicoKey, setHistoricoKey] = useState(0);
  const [forcarEnvio, setForcarEnvio] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssunto(assuntoSugerido);
    setMensagem(mensagemSugerida);
    setSelecionados(anexos.map((a) => a.url));
    setEnviado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assuntoSugerido, mensagemSugerida]);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    (async () => {
      setLoadingContatos(true);
      try {
        const [clientesRes, sociosRes] = await Promise.all([
          (supabase as any)
            .from("clientes")
            .select("id, razao_social, email")
            .not("email", "is", null),
          (supabase as any)
            .from("socios")
            .select("id, nome, email, clientes_id")
            .not("email", "is", null),
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
        if (!ativo) return;
        setContatos(lista);

        const doCliente = (clientesRes.data || []).find((c: any) => c.id === clienteId);
        if (doCliente?.email && isEmail(doCliente.email)) setDestinatario(doCliente.email);
      } finally {
        if (ativo) setLoadingContatos(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [open, clienteId]);

  const anexosSelecionados = useMemo(
    () => anexos.filter((a) => selecionados.includes(a.url)),
    [anexos, selecionados],
  );

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
      toast.error("Informe um e-mail válido para o cliente");
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

    if (!ignorarDuplicado && !forcarEnvio) {
      const duplicado = await verificarEmailJaEnviado({
        destinatario,
        referenceIds,
        referenceType,
        assunto,
      });
      if (duplicado) {
        const quando = new Date(duplicado.criado_em).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        toast.warning("Este e-mail já foi enviado", {
          description: `${duplicado.destinatario} já recebeu este documento em ${quando}.`,
          duration: 8000,
          action: {
            label: "Enviar novamente",
            onClick: () => {
              setForcarEnvio(true);
              void enviar(true);
            },
          },
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
          anexos: anexosSelecionados,
          tipo,
          reference_type: referenceType,
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

      setEnviado(true);
      toast.success("E-mail enviado ao cliente");
      await marcarMovimentacoesEnviadasPorEmail({ referenceIds, numerosDocumento });
      onEnviado?.();
    } catch (e) {
      toast.error(`Falha ao enviar e-mail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnviando(false);
      setHistoricoKey((k) => k + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <Mail className="h-4 w-4 text-sky-500" />
            </div>
            Enviar por e-mail ao cliente
          </DialogTitle>
          <DialogDescription>
            Selecione ou escreva o e-mail do cliente, ajuste a mensagem e envie os documentos com links seguros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>Contato cadastrado (clientes e sócios)</Label>
            <Select
              value=""
              onValueChange={(v) => setDestinatario(v)}
              disabled={loadingContatos}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingContatos ? "Carregando contatos..." : "Selecionar e-mail cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                {contatos.map((c) => (
                  <SelectItem key={c.id} value={c.email}>
                    {c.origem === "socio" ? "👤" : "🏢"} {c.nome} — {c.email}
                  </SelectItem>
                ))}
                {contatos.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Nenhum e-mail cadastrado
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Para *</Label>
            <Input
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="cliente@empresa.com"
            />
          </div>

          <div className="grid gap-2">
            <Label>Cópia (opcional — vários e-mails)</Label>
            <div className="flex gap-2">
              <Input
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === ";") {
                    e.preventDefault();
                    adicionarCc();
                  }
                }}
                onBlur={() => ccInput.trim() && adicionarCc()}
                placeholder="financeiro@empresa.com (Enter para adicionar)"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => adicionarCc()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {ccList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ccList.map((mail) => (
                  <Badge key={mail} variant="secondary" className="gap-1 pr-1">
                    {mail}
                    <button
                      type="button"
                      onClick={() => setCcList((prev) => prev.filter((m) => m !== mail))}
                      className="rounded-full hover:bg-background/60 p-0.5"
                      aria-label={`Remover ${mail}`}
                    >
                      <X className="h-3 w-3" />
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
            <Textarea
              rows={8}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva a mensagem que o cliente vai receber..."
            />
          </div>

          {anexos.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Documentos que irão como link
              </p>
              {anexos.map((a) => (
                <label key={a.url} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selecionados.includes(a.url)}
                    onCheckedChange={(v) =>
                      setSelecionados((prev) =>
                        v ? [...prev, a.url] : prev.filter((u) => u !== a.url),
                      )
                    }
                  />
                  <span className="truncate">{a.label}</span>
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Os arquivos são republicados no domínio da Share e o cliente recebe um link curto para visualizar.
              </p>
            </div>
          )}

          {enviado && (
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> E-mail enviado ao cliente
            </Badge>
          )}

          <HistoricoEmailsEnviados
            referenceIds={referenceIds}
            referenceType={referenceType}
            refreshKey={historicoKey}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            {enviado ? "Fechar" : "Não enviar"}
          </Button>
          <Button onClick={() => enviar()} disabled={enviando} className="bg-sky-600 hover:bg-sky-500 text-white">
            {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {enviado ? "Enviar novamente" : "Enviar e-mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnviarEmailClienteDialog;
