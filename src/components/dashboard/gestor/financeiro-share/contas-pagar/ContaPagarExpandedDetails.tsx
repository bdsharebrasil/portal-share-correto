import React, { useCallback, useEffect, useState } from "react";
import { FileText, Plane, Building2, Mail, CheckCircle2 } from "lucide-react";
import { BoletoCopiaCola } from "./BoletoCopiaCola";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  EnviarEmailClienteDialog,
  type AnexoEmail,
} from "@/components/financeiro/EnviarEmailClienteDialog";

interface Props {
  conta: any;
}

interface EmailLog {
  id: string;
  destinatario: string;
  criado_em: string;
  status: string;
}

export function ContaPagarExpandedDetails({ conta }: Props) {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);

  const parseLocalDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const carregarEmails = useCallback(async () => {
    if (!conta?.id) return;
    const { data } = await (supabase as any)
      .from("emails_enviados")
      .select("id, destinatario, criado_em, status")
      .eq("reference_id", String(conta.id))
      .order("criado_em", { ascending: false });
    setEmails((data || []) as EmailLog[]);
  }, [conta?.id]);

  useEffect(() => {
    carregarEmails();
  }, [carregarEmails]);

  const anexosEmail: AnexoEmail[] = [
    { url: conta.nf_url, label: "Nota Fiscal", filename: "nota-fiscal.pdf" },
    { url: conta.boleto_url, label: "Boleto", filename: "boleto.pdf" },
    { url: conta.recibo_url, label: "Recibo", filename: "recibo.pdf" },
    { url: conta.arquivo_pdf_url, label: "Arquivo", filename: "arquivo.pdf" },
    { url: conta.comprovante_pagamento_url, label: "Comprovante de pagamento", filename: "comprovante.pdf" },
    { url: conta.decea_url, label: "Documento DECEA", filename: "decea.pdf" },
    { url: conta.infraero_url, label: "Documento Infraero", filename: "infraero.pdf" },
  ].filter((a): a is AnexoEmail => !!a.url);

  const enviadoEm = emails.find((e) => e.status === "enviado") || emails[0] || null;

  return (
    <div className="px-6 py-5 bg-muted/30 border-t border-border/50 space-y-4 animate-in fade-in slide-in-from-top-1">
      {enviadoEm && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Enviado por e-mail ao cliente em {format(new Date(enviadoEm.criado_em), "dd/MM/yyyy 'às' HH:mm")} para{" "}
            <span className="font-semibold">{enviadoEm.destinatario}</span>
            {emails.length > 1 && ` (${emails.length} envios)`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Bloco: Identificação */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Documento Interno</p>
          <p className="text-sm font-medium">{conta.numero_doc || "Não informado"}</p>
          {conta.banco && <p className="text-xs text-muted-foreground">Banco: {conta.banco}</p>}
        </div>

        {/* Bloco: Aeronave e Cliente */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Vínculo</p>
          <div className="flex items-center gap-1.5 text-sm">
            <Plane className="h-3.5 w-3.5 text-primary" />
            <span>{conta.aeronave_registro || "Geral / Sem prefixo"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{conta.clients?.razao_social || "Administrativo"}</span>
          </div>
        </div>

        {/* Bloco: Dados DECEA */}
        {conta.numero_documento_decea && (
          <div className="space-y-1 border-l pl-4 border-amber-500/20">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Dados DECEA</p>
            <p className="text-xs">Doc: {conta.numero_documento_decea}</p>
            <p className="text-xs text-muted-foreground">Comp: {conta.competencia_decea || "-"}</p>
          </div>
        )}

        {/* Bloco: Dados Infraero */}
        {conta.numero_documento_infraero && (
          <div className="space-y-1 border-l pl-4 border-blue-500/20">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Dados Infraero</p>
            <p className="text-xs">Doc: {conta.numero_documento_infraero}</p>
            <p className="text-xs text-muted-foreground">Comp: {conta.competencia_infraero || "-"}</p>
          </div>
        )}
      </div>

      {/* Observações */}
      {conta.observacoes && (
        <div className="p-3 bg-background/50 rounded-lg border border-border/30">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Observações Internas</p>
          <p className="text-xs leading-relaxed">{conta.observacoes}</p>
        </div>
      )}

      {/* Código de barras */}
      {conta.codigo_barras && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Linha Digitável / Boleto</p>
          <BoletoCopiaCola codigoBarras={conta.codigo_barras} />
          {conta.vencimento_boleto && (
            <p className="text-[10px] text-orange-500 font-medium italic">
              Vencimento original do boleto: {format(parseLocalDate(conta.vencimento_boleto)!, "dd/MM/yyyy")}
            </p>
          )}
        </div>
      )}

      {/* Botões de Anexos / Links */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {conta.boleto_url && (
          <a href={conta.boleto_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-[11px] font-semibold hover:bg-primary/20 transition-all border border-primary/20">
            <FileText className="h-3.5 w-3.5" /> BOLETO
          </a>
        )}
        {conta.nf_url && (
          <a href={conta.nf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-md text-[11px] font-semibold hover:bg-blue-500/20 transition-all border border-blue-500/20">
            <FileText className="h-3.5 w-3.5" /> NOTA FISCAL
          </a>
        )}
        {conta.arquivo_pdf_url && (
          <a href={conta.arquivo_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 text-violet-700 rounded-md text-[11px] font-semibold hover:bg-violet-500/20 transition-all border border-violet-500/20">
            <FileText className="h-3.5 w-3.5" /> ARQUIVO
          </a>
        )}
        {conta.decea_url && (
          <a href={conta.decea_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-700 rounded-md text-[11px] font-semibold hover:bg-amber-500/20 transition-all border border-amber-500/20">
            <FileText className="h-3.5 w-3.5" /> DOC DECEA
          </a>
        )}
        {conta.infraero_url && (
          <a href={conta.infraero_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 text-sky-700 rounded-md text-[11px] font-semibold hover:bg-sky-500/20 transition-all border border-sky-500/20">
            <FileText className="h-3.5 w-3.5" /> DOC INFRAERO
          </a>
        )}
        {conta.comprovante_pagamento_url && (
          <a href={conta.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-700 rounded-md text-[11px] font-semibold hover:bg-green-500/20 transition-all border border-green-500/20">
            <FileText className="h-3.5 w-3.5" /> COMPROVANTE
          </a>
        )}
        {conta.recibo_url && (
          <a href={conta.recibo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 rounded-md text-[11px] font-semibold hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
            <FileText className="h-3.5 w-3.5" /> RECIBO
          </a>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] font-semibold gap-1.5 ml-auto"
          onClick={() => setEmailOpen(true)}
        >
          <Mail className="h-3.5 w-3.5" />
          {enviadoEm ? "Reenviar por e-mail" : "Enviar por e-mail"}
        </Button>
      </div>

      <EnviarEmailClienteDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        clienteId={conta.cliente_id || conta.client_id || null}
        assuntoSugerido={`${conta.descricao || "Despesa"}${conta.aeronave_registro ? ` — ${conta.aeronave_registro}` : ""}`}
        mensagemSugerida={
          `Olá${conta.clients?.razao_social ? ` ${conta.clients.razao_social}` : ""},\n\n` +
          `Segue a documentação referente a: ${conta.descricao || "despesa"}.\n` +
          `Valor: ${Number(conta.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n` +
          `Vencimento: ${conta.data_vencimento ? format(parseLocalDate(conta.data_vencimento)!, "dd/MM/yyyy") : "-"}\n\n` +
          `Os documentos estão disponíveis nos links abaixo.\n\nAtenciosamente,\nEquipe Share Brasil`
        }
        anexos={anexosEmail}
        tipo="contas_apagar"
        referenceType="contas_apagar"
        referenceIds={conta.id ? [String(conta.id)] : []}
        onEnviado={carregarEmails}
      />
    </div>
  );
}