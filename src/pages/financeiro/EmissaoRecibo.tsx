import React, { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { DocumentViewer } from "@/components/DocumentViewer";
import ReceiptWizardUI from "@/components/dashboard/financeiro/recibos/ReceiptWizardUI";
import { ReceiptPreview } from "@/components/dashboard/financeiro/recibos/ReceiptPreview";
import { ReceiptHistory } from "@/components/dashboard/financeiro/recibos/ReceiptHistory";
import { DescriptionManager } from "@/components/dashboard/financeiro/recibos/DescriptionManager";
import { generateSequentialReceiptNumber, GeneratedReceipt, ReceiptType } from "@/lib/receiptUtils";
import { handleReceiptSubmit } from "@/services/receiptSubmitHandler";
import { toast } from "@/hooks/use-toast";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";
import { FileText, Clock, Star, Sparkles } from "lucide-react";
import ImportarDemonstrativoIA from "@/components/dashboard/financeiro/recibos/ImportarDemonstrativoIA";
import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";
import { syncClientExpenseMirror } from "@/lib/clientExpenseMirrorSync";

interface Cliente {
  nome?: string | null;
  id: string;
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  status?: string | null;
}

interface CotistaAeronave {
  id_clientes: string;
  percentual_sociedade: number | null;
  clientes: Cliente | null;
}

interface FavoritePayer {
  id: string;
  name: string;
  document: string;
  address?: string;
  city?: string;
  uf?: string;
}

const getSelectedAircraftId = (form: any): string => {
  return form?.aeronaveId || form?.aircraftId || "";
};

const parseCurrencyInput = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildReceiptPdfData = ({
  receiptData,
  receiptType,
  boletoUrl,
  notaFiscalUrl,
  originalForm,
  companySettings,
}: {
  receiptData: any;
  receiptType: ReceiptType;
  boletoUrl: string | null;
  notaFiscalUrl: string | null;
  originalForm: any;
  companySettings: any;
}) => ({
  ...receiptData,
  receipt_number: receiptData.numero_recibo,
  payer_name: receiptData.nome_pagador,
  payer_document: receiptData.documento_pagador,
  payer_address: receiptData.endereco_pagador,
  payer_city: receiptData.cidade_pagador,
  payer_uf: receiptData.uf_pagador,
  service_description: receiptData.descricao_servico,
  receipt_type: receiptType,
  issue_date: receiptData.data_emissao,
  max_payment_date: receiptData.data_max_pagamento,
  payment_method: receiptData.forma_pagamento,
  boleto_url: boletoUrl,
  
  nf_url: notaFiscalUrl,
 
  data_vencimento_boleto: originalForm.dataVencimentoBoleto || null,
  numero_documento_decea: originalForm.numeroDocumentoDecea || null,
  competencia_decea: originalForm.competenciaDecea || null,
  numero_documento_infraero: originalForm.numeroDocumentoInfraero || null,
  competencia_infraero: originalForm.competenciaInfraero || null,
  emissor: companySettings
    ? {
        razao_social: companySettings.razao_social,
        cnpj: companySettings.cnpj,
        telefone: companySettings.telefone,
        endereco: companySettings.endereco,
        cidade: companySettings.cidade,
        cep: companySettings.cep,
      }
    : null,
});

export default function EmissaoRecibo() {
  const [userId, setUserId] = useState<string>("");
  const [clientesAtivos, setClientesAtivos] = useState<Cliente[]>([]);
  const [favoritePayers, setFavoritePayers] = useState<FavoritePayer[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<GeneratedReceipt[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [viewPdfUrl, setViewPdfUrl] = useState<string | null>(null);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [pendingReceiptData, setPendingReceiptData] = useState<any>(null);
  const [solicitacaoPagamentoOpen, setSolicitacaoPagamentoOpen] = useState(false);
  const [solicitacaoInitialData, setSolicitacaoInitialData] = useState<any>(null);
  const [editReceipt, setEditReceipt] = useState<any>(null);
  const [editNumero, setEditNumero] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ===================== INIT =====================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          await Promise.all([
            loadFavoritePayers(user.id),
            loadRecentReceipts(user.id),
            loadActiveClients(),
            loadCompanySettings(),
          ]);
        }
      } catch (err) {
        console.error("Erro ao inicializar:", err);
        toast({ title: "Erro ao carregar", description: "Não foi possível carregar os dados", variant: "destructive" });
      }
    };
    initializeApp();
  }, []);

  const loadActiveClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, endereco, cidade, uf, status")
        .eq("status", "ativo")
        .order("razao_social");
      if (error) throw error;
      setClientesAtivos(data || []);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
    }
  };

  const loadCompanySettings = async () => {
    try {
      // FIX: tabela correta é "configuracao_empresa"
      const { data } = await supabase
        .from("configuracao_empresa" as any)
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setCompanySettings(data);
    } catch (err) {
      console.error("Erro ao carregar dados da empresa:", err);
    }
  };

  const loadFavoritePayers = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("favorite_payers")
        .select("*")
        .eq("user_id", uid);
      if (error) throw error;
      setFavoritePayers(
        (data || []).map((d) => ({
          id: d.id,
          name: d.name,
          document: d.document,
          address: d.address,
          city: d.city,
          uf: d.uf,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar pagadores favoritos:", err);
    }
  };

  const loadRecentReceipts = async (_uid?: string) => {
    try {
      const { data, error } = await supabase
        .from("recibos")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(200);

      if (error) throw error;
      // Normalize DB rows to GeneratedReceipt-compatible shape
      setRecentReceipts(
        (data || []).map((d: any) => ({
          ...d,
          receipt_type: d.tipo_recibo as ReceiptType,
          // backward-compatible aliases expected by ReceiptHistory
          issue_date: d.data_emissao || d.data || d.criado_em || d.created_at || null,
          payer_name: d.nome_pagador || d.payer_name || null,
          receipt_number: d.numero_recibo || d.receipt_number || null,
          amount: d.valor ?? d.amount ?? null,
          pdf_url: d.pdf_url || d.recibo_url || d.pdf || null,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar recibos:", err);
    }
  };

  // ===================== GERAÇÃO DE RECIBO =====================
  const normalizeId = (value: any): string | null => {
     if (typeof value !== "string") return value ?? null;
     const trimmed = value.trim();
     if (!trimmed) return null;
     return trimmed.startsWith("__") ? null : trimmed;
  };

  const handleGenerateReceipt = async (formData: any) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsGeneratingPdf(false);
 
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("Usuário não autenticado. Faça login novamente.");
        currentUserId = user.id;
        setUserId(currentUserId);
      }

      const originalForm = formData.originalFormData || {};
      const isReembolso = originalForm.receiptType === "reembolso";
      const sendToProgramacao = isReembolso && Boolean(formData.enviarParaProgramacao);
      // sinaliza para uso posterior
      originalForm.__sendToProgramacao = sendToProgramacao;
      const isRateado = originalForm.reembolsoRateado === true;
      const selectedAircraftId = getSelectedAircraftId(originalForm);
      const expectedReceiptType: ReceiptType = isReembolso ? "reembolso" : "pagamento";
      const nomePagador = originalForm.pagadorNome?.trim();

      if (!nomePagador) throw new Error("Nome do pagador não foi preenchido corretamente.");

      const valorNumerico = parseFloat(String(formData.valor || "0").replace(",", "."));
      if (!valorNumerico || valorNumerico <= 0) throw new Error("Valor deve ser maior que zero");
      if (!(formData.servicoDescricao || "").trim()) throw new Error("Descrição do serviço é obrigatória");

      const normalizedClienteId = normalizeId(originalForm.clienteId);
      const receiptNumber = await generateSequentialReceiptNumber(
        nomePagador,
        supabase,
        normalizedClienteId
      );

      const valorTotalDespesa = isRateado
        ? parseCurrencyInput(originalForm.reembolsoValorTotal)
        : null;
      let cotistasDaAeronave: CotistaAeronave[] = [];

      if (isReembolso && isRateado) {
        if (!selectedAircraftId || !valorTotalDespesa || valorTotalDespesa <= 0) {
          throw new Error("Informe a aeronave e o valor total da despesa para gerar os recibos rateados.");
        }

        const { data, error } = await supabase
          .from("cotistas_aeronave")
          .select("id_clientes, percentual_sociedade, clientes:id_clientes(id, razao_social, cnpj, endereco, cidade, uf)")
          .eq("id_aeronave", selectedAircraftId);

        if (error) throw error;
        if (!data?.length) throw new Error("Não há clientes cotistas vinculados à aeronave selecionada.");
        cotistasDaAeronave = data;
      }

      // ===================== UPLOAD DE ARQUIVOS =====================
      let boletoUrl: string | null = null;
      let notaFiscalUrl: string | null = null;
      let deceeaUrl: string | null = null;
      let infraeroUrl: string | null = null;
      const uploadedFiles: { type: string; name: string }[] = [];

      const uploadFile = async (file: File, prefix: string, storage: string) => {
        const timestamp = Date.now();
        const sanitizedFileName = file.name // corrigido: era "file.nome"
          .replace(/[^a-zA-Z0-9.\-_]/g, "_")
          .substring(0, 100);
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileName = `${prefix}_${timestamp}_${randomSuffix}_${sanitizedFileName}`;
        const { error } = await supabase.storage
          .from(storage)
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from(storage).getPublicUrl(fileName);
        if (!publicUrlData?.publicUrl) throw new Error("Falha ao obter URL pública do arquivo");
        uploadedFiles.push({ type: prefix, name: fileName });
        return publicUrlData.publicUrl;
      };

      const boletoFile =
        formData.files?.boleto instanceof File
          ? formData.files.boleto
          : originalForm.reembolsoBoletoFile instanceof File
          ? originalForm.reembolsoBoletoFile
          : null;
      const notaFiscalFile =
        formData.files?.notaFiscal instanceof File
          ? formData.files.notaFiscal
          : originalForm.reembolsoNotaFiscalFile instanceof File
          ? originalForm.reembolsoNotaFiscalFile
          : null;

      if (boletoFile) boletoUrl = await uploadFile(boletoFile, "boleto", "n.f-boletos-clients");
      if (notaFiscalFile) notaFiscalUrl = await uploadFile(notaFiscalFile, "nf", "n.f-boletos-clients");
      if (originalForm.decealFile instanceof File)
        deceeaUrl = await uploadFile(originalForm.decealFile, "decea", "n.f-boletos-clients");
      if (originalForm.infraeroFile instanceof File)
        infraeroUrl = await uploadFile(originalForm.infraeroFile, "infraero", "n.f-boletos-clients");

      // ===================== INSERIR RECIBO =====================
      // Mapeamento completo EN → PT conforme schema da tabela recibos
      const receiptPayload = {
        usuario_id: currentUserId,                                                          // user_id
        nome_pagador: nomePagador,                                                          // payer_name
        documento_pagador: originalForm.pagadorDocumento?.trim() || "",                    // payer_document
        endereco_pagador: originalForm.pagadorEndereco?.trim() || null,                    // payer_address
        cidade_pagador: originalForm.pagadorCidade?.trim() || null,                        // payer_city
        uf_pagador: originalForm.pagadorUF?.trim() || null,                                // payer_uf
        valor: valorNumerico,                                                               // amount
        descricao_servico: (formData.servicoDescricao || "").trim(),                       // service_description
        tipo_recibo: expectedReceiptType,                                                   // receipt_type
        data_emissao: originalForm.dataEmissao || new Date().toISOString().split("T")[0], // issue_date
        numero_recibo: receiptNumber,                                                       // receipt_number
        data_max_pagamento: originalForm.prazoMaximoQuitacao || null,                       // max_payment_date
        forma_pagamento: originalForm.formaPagamento?.trim() || null,                      // payment_method
        cliente_id: normalizedClienteId,       // cliente_id
        boleto_url: boletoUrl,                                                              // boleto_url (legacy) / recibos.boleto_url
        nf_url: notaFiscalUrl,                                                              // recibos.nf_url
        demonstrativo_url: deceeaUrl || infraeroUrl || null,                                // recibos.demonstrativo_url
        data_vencimento: originalForm.dataVencimentoBoleto || null,                         // recibos.data_vencimento
        competencia_decea: formData.isDecea ? (originalForm.competenciaDecea || null) : null,
        competencia_infraero: formData.isInfraero ? (originalForm.competenciaInfraero || null) : null,
        nome_categoria: formData.categoriaNome || originalForm.categoriaNome || null,      // category_name
        subcategoria_1: originalForm.subcategoriaSel || originalForm.reembolsoSubcategoria || null,
        numero_documento: originalForm.reembolsoNumeroDocumento                            // doc_number
          || originalForm.numeroDocumentoDecea
          || originalForm.numeroDocumentoInfraero
          || null,
        aeronave_id: selectedAircraftId || null,
        compartilhado: originalForm.reembolsoRateado || false,                             // is_shared
        percentual: originalForm.reembolsoPorcentagem                                      // percentage
          ? parseFloat(originalForm.reembolsoPorcentagem)
          : null,
        valor_total: parseCurrencyInput(originalForm.reembolsoValorTotal),                  // total_amount
        socios_cliente: formData.socioNome || null,
      };

      const receiptsToInsert = isReembolso && isRateado
        ? await Promise.all(
            cotistasDaAeronave.map(async (cotista) => {
              const cliente = cotista.clientes;
              const percentual = Number(cotista.percentual_sociedade || 0);
              const isClienteSelecionado = cotista.id_clientes === originalForm.clienteId;
              const numeroRecibo = isClienteSelecionado
                ? receiptNumber
                : await generateSequentialReceiptNumber(
                    cliente?.razao_social || "CLIENTE",
                    supabase,
                    cotista.id_clientes
                  );

              return {
                ...receiptPayload,
                numero_recibo: numeroRecibo,
                cliente_id: cotista.id_clientes,
                nome_pagador: isClienteSelecionado ? nomePagador : cliente?.razao_social || "Cliente",
                documento_pagador: isClienteSelecionado
                  ? receiptPayload.documento_pagador
                  : cliente?.cnpj || null,
                endereco_pagador: isClienteSelecionado
                  ? receiptPayload.endereco_pagador
                  : cliente?.endereco || null,
                cidade_pagador: isClienteSelecionado
                  ? receiptPayload.cidade_pagador
                  : cliente?.cidade || null,
                uf_pagador: isClienteSelecionado ? receiptPayload.uf_pagador : cliente?.uf || null,
                valor: Number(((valorTotalDespesa! * percentual) / 100).toFixed(2)),
                percentual,
                valor_total: valorTotalDespesa,
                socios_cliente: isClienteSelecionado ? receiptPayload.socios_cliente : null,
              };
            })
          )
        : [receiptPayload];

      // Verificar duplicata pelo numero_recibo + usuario_id
      const { data: existing } = await supabase
        .from("recibos")
        .select("id")
        .eq("numero_recibo", receiptNumber)
        .eq("usuario_id", currentUserId)
        .single();
      if (existing) throw new Error("Recibo já gerado anteriormente.");

      const { data: insertedReceipts, error: dbError } = await supabase
        .from("recibos")
        .insert(receiptsToInsert)
        .select("*");
      if (dbError) throw dbError;

      let receiptData = insertedReceipts?.find((receipt) => receipt.numero_recibo === receiptNumber);
      if (!receiptData) throw new Error("Não foi possível identificar o recibo principal gerado.");

      if (
        receiptData.tipo_recibo !== expectedReceiptType ||
        (selectedAircraftId && receiptData.aeronave_id !== selectedAircraftId)
      ) {
        const { data: correctedReceipt, error: correctionError } = await supabase
          .from("recibos")
          .update({
            tipo_recibo: expectedReceiptType,
            aeronave_id: selectedAircraftId || null,
          })
          .eq("id", receiptData.id);

        if (correctionError) {
          await supabase.from("recibos").delete().eq("id", receiptData.id).eq("usuario_id", currentUserId);
          throw new Error("Não foi possível salvar o tipo do recibo e a aeronave selecionada.");
        }

        const { data: reloadedReceipt, error: reloadError } = await supabase
          .from("recibos")
          .select("*")
          .eq("id", receiptData.id)
          .single();

        if (reloadError || !reloadedReceipt) {
          await supabase.from("recibos").delete().eq("id", receiptData.id).eq("usuario_id", currentUserId);
          throw new Error("O recibo foi criado, mas não foi possível validar os dados salvos.");
        }

        receiptData = reloadedReceipt;
      }

      if (
        receiptData.tipo_recibo !== expectedReceiptType ||
        (selectedAircraftId && receiptData.aeronave_id !== selectedAircraftId)
      ) {
        await supabase.from("recibos").delete().eq("id", receiptData.id).eq("usuario_id", currentUserId);
        throw new Error("O recibo não foi salvo corretamente como reembolso ou com a aeronave selecionada.");
      }

      console.log("Recibo inserido:", receiptData);

      // ===================== PROCESSAR REEMBOLSO =====================
      if (isReembolso && normalizedClienteId) {
        try {
          console.log("📨 Processando reembolso...");
          const isDecea = formData.isDecea === true;
          const isInfraero = formData.isInfraero === true;
          const isDECEAorINFRAERO = isDecea || isInfraero;
          const valorRecibo = valorNumerico;
          const percentual = isRateado ? originalForm.reembolsoPorcentagem : "100";
          const valorTotalStr = isRateado
            ? String(originalForm.reembolsoValorTotal).replace(/\./g, "").replace(/,/g, ".")
            : String(valorRecibo);
          const valorTotalDespesa = parseFloat(valorTotalStr);

          // Buscar matrícula da aeronave
          let aeronaveRegistro = "";
          if (selectedAircraftId) {
            const { data: acData } = await supabase
              .from("aeronave")
              .select("matricula") // corrigido: era "registration"
              .eq("id", selectedAircraftId)
              .single();
            if (acData) aeronaveRegistro = acData.matricula;
          }

          const brDescription = isDECEAorINFRAERO
            ? isDecea ? "DECEA pago" : "INFRAERO pago"
            : `Reembolso - ${receiptPayload.descricao_servico}`;

          const dataVencimento =
            originalForm.dataVencimentoBoleto ||
            originalForm.prazoMaximoQuitacao ||
            originalForm.dataEmissao;

          // ===== 1. Criar contas_apagar =====
          const contaPayload: any = {
            data_vencimento: dataVencimento,
            valor: isDECEAorINFRAERO
              ? parseFloat(originalForm.valorTotalBoleto || String(valorRecibo))
              : valorRecibo,
            categoria: "Clientes - Despesas Reembolsáveis",
            descricao: brDescription,
            status: "gerada na emissão de recibo",
            criado_por: currentUserId,
            cliente_id: normalizeId(originalForm.clienteId),
            aeronave_registro: aeronaveRegistro,
          };

          if (isDecea) {
            contaPayload.numero_documento_decea = originalForm.numeroDocumentoDecea || null;
            contaPayload.competencia_decea = originalForm.competenciaDecea || null;
            contaPayload.decea_url = deceeaUrl || null;
          }

          if (isInfraero) {
            contaPayload.numero_documento_infraero = originalForm.numeroDocumentoInfraero || null;
            contaPayload.competencia_infraero = originalForm.competenciaInfraero || null;
            contaPayload.infraero_url = infraeroUrl || null;
          }

          const { data: contaData, error: contaError } = await supabase
            .from("contas_apagar")
            .insert(contaPayload)
            .select("id")
            .single();

          if (contaError) {
            console.error("❌ Erro ao criar conta a pagar:", contaError);
          } else {
            console.log("✅ Conta a pagar criada:", contaData.id);

            // ===== 2. Criar movimentação de DESPESA (espelho do contas_apagar) =====
            const dataEmissaoStr = originalForm.dataEmissao || new Date().toISOString().split("T")[0];
            const movDespesaPayload: any = {
              descricao: brDescription,
              tipo: "despesa",
              categoria_id: originalForm.reembolsoCategoriaId || null,
              valor: isDECEAorINFRAERO
                ? parseFloat(originalForm.valorTotalBoleto || String(valorRecibo))
                : valorRecibo,
              data_competencia: dataEmissaoStr,
              data_vencimento: dataVencimento,
              aeronave_id: selectedAircraftId || null,
              clientes_id: normalizeId(originalForm.clienteId),
              status: "pendente",
              fornecedor_nome: nomePagador,
              numero_recibo: receiptData.numero_recibo,
              numero_doc: isDecea
                ? originalForm.numeroDocumentoDecea || null
                : isInfraero
                ? originalForm.numeroDocumentoInfraero || null
                : null,
              boleto_url: boletoUrl,
              nf_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
              criado_por: currentUserId,
              contas_apagar_id: contaData.id,
              reference_type: "contas_apagar",
              reference_id: contaData.id,
            };

            const { error: movDespesaError } = await supabase
              .from("movimentacoes")
              .insert(movDespesaPayload);

            if (movDespesaError) {
              console.error("❌ Erro ao criar movimentação (despesa):", movDespesaError);
            } else {
              console.log("✅ Movimentação (despesa) criada");
            }

            // ===== 3. Criar contas_areceber =====
            const clienteData = clientesAtivos.find((c) => c.id === normalizedClienteId);
            const contaReceberPayload: any = {
              numero: receiptData.numero_recibo || `REC-${receiptData.id.substring(0, 8)}`,
              cliente_id: normalizedClienteId,
              cliente_nome: clienteData?.razao_social || nomePagador,
              cliente_cnpj: clienteData?.cnpj || originalForm.pagadorDocumento || "",
              categoria: "Clientes - Despesas Reembolsáveis",
              valor: valorRecibo,
              data_criacao: dataEmissaoStr,
              data_vencimento: dataVencimento,
              status: "pendente",
              descricao: brDescription,
              aeronave: aeronaveRegistro || null,
              criado_por: currentUserId,
              reference_id: receiptData.id,
              reference_type: "recibo",
              boleto_url: boletoUrl,
              nota_fiscal_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
            };

            const { data: crData, error: crError } = await supabase
              .from("contas_areceber")
              .insert(contaReceberPayload)
              .select("id")
              .single();

            if (crError) {
              console.error("❌ Erro ao criar conta a receber:", crError);
            } else {
              console.log("✅ Conta a receber criada:", crData.id);

              // ===== 4. Criar movimentação de RECEITA (espelho do contas_areceber / recibo) =====
              const movReceitaPayload: any = {
                descricao: brDescription,
                tipo: "receita",
                categoria_id: originalForm.reembolsoCategoriaId || null,
                valor: valorRecibo,
                data_competencia: dataEmissaoStr,
                data_vencimento: dataVencimento,
                aeronave_id: selectedAircraftId || null,
                clientes_id: normalizedClienteId,
                status: "pendente",
                numero_recibo: receiptData.numero_recibo,
                boleto_url: boletoUrl,
                nf_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
                criado_por: currentUserId,
                contas_areceber_id: crData.id,
                reference_type: "recibo",
                reference_id: receiptData.id,
              };

              const { error: movReceitaError } = await supabase
                .from("movimentacoes")
                .insert(movReceitaPayload);

              if (movReceitaError) {
                console.error("❌ Erro ao criar movimentação (receita):", movReceitaError);
              } else {
                console.log("✅ Movimentação (receita) criada");
              }

              // ===== 5. Espelho de despesa para o cliente/aeronave (ADM SHARE BRASIL) =====
              if (normalizedClienteId && selectedAircraftId) {
                try {
                  await syncClientExpenseMirror({
                    origin: "recibo",
                    originId: receiptData.id,
                    cliente_id: normalizedClienteId,
                    aeronave_id: selectedAircraftId,
                    valor: valorRecibo,
                    data_competencia: dataEmissaoStr,
                    data_vencimento: dataVencimento,
                    numero_doc: receiptData.numero_recibo,
                    descricao_origem: brDescription,
                    status_origem: "pendente",
                    nf_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
                    boleto_url: boletoUrl,
                    criado_por: currentUserId,
                  });
                  console.log("✅ Espelho ADM SHARE (despesa cliente) criado");
                } catch (mirrorErr) {
                  console.error("❌ Erro ao criar espelho ADM SHARE:", mirrorErr);
                }
              }
            }
          }

          // ===== 4. Rateio se aplicável =====
          if (isRateado && selectedAircraftId) {
            const { data: aircraftClients, error: acError } = await supabase
              .from("cotistas_aeronave")
              .select("id_clientes, percentual_sociedade, clientes:id_clientes(id, razao_social)") // corrigido: id_cliente → id_clientes
              .eq("id_aeronave", selectedAircraftId);

            if (acError) {
              console.error("❌ Erro ao buscar cotistas da aeronave:", acError);
            } else if (aircraftClients && aircraftClients.length > 0) {
              for (const ac of aircraftClients) {
                const clientData = ac.clientes as any;
                const sharePercentage = parseFloat(String(ac.percentual_sociedade || 0)); // corrigido: era percentual_participacao

                const valorPorPropriedade = (valorTotalDespesa * sharePercentage) / 100;
                const valorPorUso = (valorTotalDespesa * parseFloat(percentual)) / 100;

                const rateioPayload = {
                  despesa_id: contaData?.id || receiptData.id,
                  cliente_id: ac.id_clientes,          // corrigido: era ac.cliente_id
                  client_name: clientData?.razao_social || "Desconhecido",
                  aeronave_id: selectedAircraftId || null,
                  aeronave_registro: aeronaveRegistro,
                  percentual: sharePercentage,
                  percentual_voo: parseFloat(percentual),
                  valor_rateado: valorPorPropriedade,
                  valor_por_voo: valorPorUso,
                  valor: valorTotalDespesa,
                  status: "pendente",
                  data_vencimento: dataVencimento,
                  categoria_id: originalForm.reembolsoCategoriaId || null,
                  boleto: boletoUrl,
                  nota_fiscal: notaFiscalUrl || deceeaUrl || infraeroUrl,
                  observacoes: `Rateio - ${sharePercentage}% propriedade / ${percentual}% uso. ${
                    ac.id_clientes === originalForm.clienteId
                      ? "Cliente pagou o valor total de"
                      : "Cliente deve"
                  } R$ ${valorTotalDespesa.toFixed(2)}`,
                };

                const { error: rateioErr } = await supabase
                  .from("rateio_despesas")
                  // Cast to any to avoid TypeScript strict insert payload checking for dynamic payloads
                  .insert(rateioPayload as any);
                if (rateioErr)
                  console.error(`❌ Erro ao criar rateio para ${clientData?.razao_social}:`, rateioErr);
                else
                  console.log(`✅ Rateio criado para ${clientData?.razao_social} (${sharePercentage}% / ${percentual}%)`);
              }
            }
          }
        } catch (reembolsoErr) {
          console.error("❌ Erro ao processar reembolso:", reembolsoErr);
          toast({
            title: "⚠️ Reembolso não processado",
            description: "Recibo criado, mas falhou ao processar reembolso.",
            variant: "default",
          });
        }
      }

      // ===================== GERAR PDF =====================
      try {
        setIsGeneratingPdf(true);
        const pdfData = buildReceiptPdfData({
          receiptData,
          receiptType: expectedReceiptType,
          boletoUrl,
          notaFiscalUrl,
          originalForm,
          companySettings,
        });

        // Mostrar preview em vez de gerar PDF direto
        setPreviewData(pdfData);
        setPendingReceiptData({
          receiptData,
          receiptNumber,
          receiptType: expectedReceiptType,
          boletoUrl,
          notaFiscalUrl,
        originalForm,
        sendToProgramacao: Boolean(originalForm.__sendToProgramacao),
          companySettings,
          currentUserId,
        });
        setIsPreviewOpen(true);
      } catch (pdfErr) {
        console.error("❌ Erro ao preparar preview:", pdfErr);
        toast({
          title: "⚠️ Aviso",
          description: "Erro ao preparar preview do recibo.",
          variant: "default",
        });
      }
    } catch (err) {
      console.error("Erro ao gerar recibo:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao gerar recibo", description: errorMsg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setIsGeneratingPdf(false);
    }
  };

  // ===================== VISUALIZAR PDF =====================
  const handleViewReceipt = async (receiptId: string) => {
    setIsLoadingPdf(true);
    try {
      const receipt = recentReceipts.find((r) => r.id === receiptId);
      if (!receipt || !receipt.pdf_url) throw new Error("PDF não disponível"); // corrigido: usa pdf_url
      setViewPdfUrl(receipt.pdf_url);
      setViewingReceiptId(receiptId);
      setIsPdfViewerOpen(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao abrir PDF", description: errorMsg, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // ===================== GERAR PDF APÓS CONFIRMAR PREVIEW =====================
  const handleConfirmAndGeneratePdf = async (editedNumber?: string) => {
    if (!pendingReceiptData) return;
    
    try {
      setIsGeneratingPdf(true);
      const {
        receiptData: originalReceiptData,
        receiptNumber: originalNumber,
        receiptType: expectedReceiptType,
        boletoUrl,
        notaFiscalUrl,
        originalForm,
        companySettings: settings,
        currentUserId,
      } = pendingReceiptData;

      let receiptData = originalReceiptData;
      let receiptNumber = originalNumber;

      // Se o número foi editado, atualizar no banco antes de gerar o PDF
      const finalNumber = (editedNumber || "").trim();
      if (finalNumber && finalNumber !== originalNumber) {
        // Verificar duplicata
        const { data: dup } = await supabase
          .from("recibos")
          .select("id")
          .eq("numero_recibo", finalNumber)
          .eq("usuario_id", currentUserId)
          .neq("id", receiptData.id)
          .maybeSingle();
        if (dup) {
          toast({
            title: "Número duplicado",
            description: `Já existe um recibo com o número ${finalNumber}.`,
            variant: "destructive",
          });
          setIsGeneratingPdf(false);
          return;
        }

        const { error: numErr } = await supabase
          .from("recibos")
          .update({ numero_recibo: finalNumber })
          .eq("id", receiptData.id);
        if (numErr) throw numErr;

        // Espelhar em movimentacoes e contas_areceber quando existir
        await supabase
          .from("movimentacoes")
          .update({ numero_recibo: finalNumber })
          .eq("reference_id", receiptData.id)
          .eq("reference_type", "recibo");
        await supabase
          .from("contas_areceber")
          .update({ numero: finalNumber })
          .eq("reference_id", receiptData.id)
          .eq("reference_type", "recibo");

        receiptData = { ...receiptData, numero_recibo: finalNumber };
        receiptNumber = finalNumber;
      }

      const pdfData = buildReceiptPdfData({
        receiptData,
        receiptType: expectedReceiptType,
        boletoUrl,
        notaFiscalUrl,
        originalForm,
        companySettings: settings,
      });

      const pdfBlob = await pdf(<ReciboDocument data={pdfData} />).toBlob();
      const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(pdfFileName, pdfBlob, { contentType: "application/pdf", upsert: true });
      if (uploadError) {
        console.error("❌ Erro upload PDF:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(pdfFileName);
      if (!urlData?.publicUrl) throw new Error("Falha ao obter URL pública do PDF");

      // Atualizar sem filtro de usuario_id para evitar RLS bloqueando
      const { error: updatePdfError } = await supabase
        .from("recibos")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", receiptData.id);

      if (updatePdfError) {
        console.error("❌ Erro ao salvar URL do PDF:", updatePdfError);
        throw new Error(`Falha ao salvar a URL do PDF: ${updatePdfError.message}`);
      }

      console.log("✅ PDF gerado e URL salva:", urlData.publicUrl);

      await loadRecentReceipts(currentUserId);
      setIsPreviewOpen(false);

      // Se o usuário optou por enviar para programação de pagamento, abrir o modal com dados pré-preenchidos
      if (pendingReceiptData.sendToProgramacao) {
        try {
          const r = receiptData;
          const orig = pendingReceiptData.originalForm || {};
          const cliente = clientesAtivos.find((c) => c.id === (orig.clienteId || r.cliente_id));
          let socioId = orig.socioId || orig.selectedPartnerId || null;
          const socioNome = orig.socioNome || null;
          if (socioId === "__client__" || socioId === "__all__") {
            socioId = null;
          }
          // Buscar registro da aeronave
          let aeronaveRegistro = "";
          if (r.aeronave_id) {
            try {
              const { data: acData } = await supabase.from("aeronave").select("matricula").eq("id", r.aeronave_id).single();
              if (acData) aeronaveRegistro = acData.matricula;
            } catch (e) {
              // ignore
            }
          }

          const valorTotalDespesaVal =
            (typeof orig.reembolsoValorTotal === "string"
              ? parseFloat(String(orig.reembolsoValorTotal).replace(/\./g, "").replace(",", "."))
              : Number(orig.reembolsoValorTotal)) || Number(r.valor_total) || Number(r.valor) || null;
          const valorRateadoVal = Number(r.valor) || null;
          const percentualUsoVal =
            (typeof orig.reembolsoPorcentagem === "string"
              ? parseFloat(String(orig.reembolsoPorcentagem).replace(",", "."))
              : Number(orig.reembolsoPorcentagem)) ||
            (valorTotalDespesaVal && valorRateadoVal
              ? +((valorRateadoVal / valorTotalDespesaVal) * 100).toFixed(2)
              : null);

          const initial = {
            data_emissao: r.data_emissao || orig.dataEmissao || null,
            data_vencimento: r.data_vencimento || orig.prazoMaximoQuitacao || orig.dataVencimentoBoleto || null,
            periodicidade: orig.periodicidade || r.periodicidade || null,
            tipo_rateio: orig.tipoRateio || orig.tipo_rateio || r.tipo_rateio || null,
            numero_doc: r.numero_documento || orig.reembolsoNumeroDocumento || null,
            descricao_despesa: r.descricao_servico || orig.servicoDescricao || null,
            cliente_id: r.cliente_id || orig.clienteId || null,
            clientes_nome: cliente?.razao_social || cliente?.nome || null,
            socio_id: socioId,
            socios_nome: socioNome,
            aeronave_id: r.aeronave_id || orig.aircraftId || orig.aeronaveId || null,
            aeronave_registro: aeronaveRegistro || null,
            numero_recibo: r.numero_recibo || receiptNumber,
            // campos adicionais
            nome_categoria: r.nome_categoria || orig.reembolsoCategoriaNome || null,
            subcategoria_1: r.subcategoria_1 || null,
            subcategoria_selecionada: orig.reembolsoSubcategoria || null,
            anexos: [
              { tipo: "boleto", url: r.boleto_url || pendingReceiptData.boletoUrl || null },
              { tipo: "nf", url: r.nf_url || pendingReceiptData.notaFiscalUrl || null },
              { tipo: "demonstrativo", url: r.demonstrativo_url || null },
              { tipo: "recibo", url: r.pdf_url || null },
            ].filter((a) => a.url),
            boleto_url: r.boleto_url || pendingReceiptData.boletoUrl || null,
            nf_url: r.nf_url || pendingReceiptData.notaFiscalUrl || null,
            demonstrativo_url: r.demonstrativo_url || null,
            competencia_infraero: r.competencia_infraero || orig.competenciaInfraero || orig.competencia_infraero || null,
            competencia_decea: r.competencia_decea || orig.competenciaDecea || orig.competencia_decea || null,
            // valores para rateio do cliente (todos editáveis no modal)
            valor_total: valorTotalDespesaVal,
            valor_total_despesa: valorTotalDespesaVal,
            valor_rateado: valorRateadoVal,
            percentual_uso: percentualUsoVal,
            rateio_cliente: (r.cliente_id || orig.clienteId)
              ? [{
                  cliente_id: r.cliente_id || orig.clienteId,
                  cliente_nome: cliente?.razao_social || cliente?.nome || null,
                  valor_total_despesa: valorTotalDespesaVal,
                  valor_rateado: valorRateadoVal,
                  percentual_uso: percentualUsoVal,
                  socio_id: socioId,
                }]
              : [],
          };

          setSolicitacaoInitialData(initial);
          setSolicitacaoPagamentoOpen(true);
        } catch (e) {
          console.warn("Falha ao preparar solicitação de pagamento:", e);
        }
      }

      setPendingReceiptData(null);
      toast({ title: "✅ Sucesso!", description: `Recibo ${receiptNumber} gerado com sucesso!` });
    } catch (pdfErr) {
      console.error("❌ Erro ao gerar PDF:", pdfErr);
      toast({
        title: "⚠️ Aviso",
        description: "Erro ao gerar PDF do recibo.",
        variant: "default",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ===================== EXCLUIR RECIBO =====================
  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("Usuário não autenticado.");
        currentUserId = user.id;
        setUserId(currentUserId);
      }

      const { data: deletedRows, error } = await supabase
        .from("recibos")
        .delete()
        .eq("id", receiptId)
        .eq("usuario_id", currentUserId)
        .select("id");

      if (error) throw error;
      if (!deletedRows?.length) {
        throw new Error("Você só pode excluir recibos criados por você.");
      }

      await loadRecentReceipts(currentUserId);
      toast({ title: "Sucesso!", description: "Recibo excluído" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Não foi possível excluir o recibo";
      toast({ title: "Erro ao excluir", description: errorMsg, variant: "destructive" });
    }
  };

  // ===================== LIMPAR HISTÓRICO =====================
  const handleClearHistory = async () => {
    if (!confirm("Tem certeza que deseja limpar todos os recibos? Esta ação é irreversível.")) return;
    try {
      const { error } = await supabase
        .from("recibos") // corrigido: era "receipts"
        .delete()
        .eq("usuario_id", userId); // corrigido: era "user_id"
      if (error) throw error;
      await loadRecentReceipts(userId);
      toast({ title: "Sucesso!", description: "Histórico limpo" });
    } catch {
      toast({ title: "Erro ao limpar histórico", description: "Não foi possível limpar", variant: "destructive" });
    }
  };

  // ===================== DOWNLOAD PDF =====================
  const handleDownloadReceipt = async (receiptId: string) => {
    try {
      const receipt = recentReceipts.find((r) => r.id === receiptId);
      if (!receipt || !receipt.pdf_url) throw new Error("PDF não disponível"); // corrigido: usa pdf_url
      const response = await fetch(receipt.pdf_url);
      if (!response.ok) throw new Error(`Erro ao baixar: ${response.statusText}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(receipt.numero_recibo || "recibo").replace(/\//g, "-")}.pdf`; // corrigido: usa numero_recibo
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: "Sucesso!", description: "Recibo baixado com sucesso" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao baixar", description: errorMsg, variant: "destructive" });
    }
  };

  // ===================== EDITAR RECIBO (histórico) =====================
  const handleOpenEditReceipt = (receiptId: string) => {
    const r = recentReceipts.find((x) => x.id === receiptId);
    if (!r) return;
    setEditReceipt(r);
    setEditNumero(r.numero_recibo || "");
    setEditDescricao((r as any).descricao_servico || "");
  };

  const handleSaveEditReceipt = async () => {
    if (!editReceipt) return;
    const newNumero = editNumero.trim();
    const newDescricao = editDescricao.trim();
    if (!newNumero) {
      toast({ title: "Número obrigatório", description: "Informe um número de recibo", variant: "destructive" });
      return;
    }
    if (!newDescricao) {
      toast({ title: "Descrição obrigatória", description: "Informe a descrição do serviço", variant: "destructive" });
      return;
    }

    setIsSavingEdit(true);
    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("Usuário não autenticado.");
        currentUserId = user.id;
      }

      // Verificar duplicata do número
      if (newNumero !== editReceipt.numero_recibo) {
        const { data: dup } = await supabase
          .from("recibos")
          .select("id")
          .eq("numero_recibo", newNumero)
          .eq("usuario_id", currentUserId)
          .neq("id", editReceipt.id)
          .maybeSingle();
        if (dup) {
          toast({ title: "Número duplicado", description: `Já existe um recibo com o número ${newNumero}.`, variant: "destructive" });
          setIsSavingEdit(false);
          return;
        }
      }

      const { error: upErr } = await supabase
        .from("recibos")
        .update({ numero_recibo: newNumero, descricao_servico: newDescricao })
        .eq("id", editReceipt.id);
      if (upErr) throw upErr;

      // Sincronizar em movimentacoes e contas_areceber
      await supabase
        .from("movimentacoes")
        .update({ numero_recibo: newNumero, descricao: newDescricao })
        .eq("reference_id", editReceipt.id)
        .eq("reference_type", "recibo");
      await supabase
        .from("contas_areceber")
        .update({ numero: newNumero, descricao: newDescricao })
        .eq("reference_id", editReceipt.id)
        .eq("reference_type", "recibo");

      // Regenerar PDF com os novos dados
      try {
        const { data: fullReceipt } = await supabase
          .from("recibos")
          .select("*")
          .eq("id", editReceipt.id)
          .single();

        const pdfData = buildReceiptPdfData({
          receiptData: {
            ...fullReceipt,
            numero_recibo: newNumero,
            descricao_servico: newDescricao,
          },
          receiptType: (fullReceipt?.tipo_recibo || "pagamento") as ReceiptType,
          boletoUrl: fullReceipt?.boleto_url || null,
          notaFiscalUrl: fullReceipt?.nf_url || null,
          originalForm: {},
          companySettings,
        });
        const pdfBlob = await pdf(<ReciboDocument data={pdfData} />).toBlob();
        const pdfFileName = `recibos/${editReceipt.id}_${Date.now()}.pdf`;
        const { error: upldErr } = await supabase.storage
          .from("receipts")
          .upload(pdfFileName, pdfBlob, { contentType: "application/pdf", upsert: true });
        if (upldErr) throw upldErr;

        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(pdfFileName);
        if (!urlData?.publicUrl) throw new Error("Não foi possível obter a URL do PDF atualizado.");

        const { error: pdfUpdateError } = await supabase
          .from("recibos")
          .update({ pdf_url: urlData.publicUrl })
          .eq("id", editReceipt.id)
          .eq("usuario_id", currentUserId);
        if (pdfUpdateError) throw pdfUpdateError;

        if (viewingReceiptId === editReceipt.id) {
          setViewPdfUrl(urlData.publicUrl);
        }
      } catch (regenErr) {
        console.error("Falha ao regenerar PDF do recibo:", regenErr);
        throw regenErr;
      }

      await loadRecentReceipts(currentUserId);
      setEditReceipt(null);
      toast({ title: "Sucesso!", description: "Recibo atualizado" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar";
      toast({ title: "Erro ao editar", description: msg, variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };


  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-card/30 p-4 md:p-8 rounded-[13px] overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Emissão de Recibos
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerar e gerenciar recibos PDF de forma simples e segura
            </p>
          </div>

          <Tabs defaultValue="emitir" className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="flex gap-2 bg-card/50 backdrop-blur-sm p-1.5 rounded-xl border border-border/50 w-fit md:w-auto">
                <TabsTrigger
                  value="emitir"
                  className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Emitir
                </TabsTrigger>
                <TabsTrigger
                  value="historico"
                  className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
                <TabsTrigger
                  value="ia"
                  className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all"
                >
                 
                  LEITURA AUTOMATICA DEMONSTRATIVOS
                </TabsTrigger>
                <TabsTrigger
                  value="descricoes"
                  className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Descrições Favoritas
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content - Emitir */}
            <TabsContent value="emitir" className="mt-6">
              <div className="rounded-[19px] bg-card/30 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <ReceiptWizardUI
                  clientesAtivos={clientesAtivos}
                  favoritePayers={favoritePayers}
                  isGenerating={isGenerating}
                  onSubmit={handleGenerateReceipt}
                />
              </div>
            </TabsContent>

            {/* Tab Content - Histórico */}
            <TabsContent value="historico" className="mt-6">
              <div className="rounded-[19px] bg-card/30 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg">
                <ReceiptHistory
                  receipts={recentReceipts}
                  onView={handleViewReceipt}
                  onDelete={handleDeleteReceipt}
                  onEdit={handleOpenEditReceipt}
                  onClearAll={handleClearHistory}
                  isLoading={isLoadingPdf}
                />
              </div>
            </TabsContent>

            {/* Tab Content - Importar por IA */}
            <TabsContent value="ia" className="mt-6">
              <div className="rounded-[19px] bg-card/30 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg">
                <ImportarDemonstrativoIA onGenerated={() => loadRecentReceipts(userId)} />
              </div>
            </TabsContent>

            {/* Tab Content - Descrições Favoritas */}
            <TabsContent value="descricoes" className="mt-6">
              <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg">
                <DescriptionManager />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isPdfViewerOpen} onOpenChange={(open) => { setIsPdfViewerOpen(open); if (!open) setViewingReceiptId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Recibo</DialogTitle>
          </DialogHeader>
          {viewPdfUrl && (
            <DocumentViewer
              url={viewPdfUrl}
              fileName="recibo.pdf"
              fileType="application/pdf"
              onDownload={() => {
                const link = document.createElement("a");
                link.href = viewPdfUrl;
                link.download = "recibo.pdf";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      {previewData && (
        <ReceiptPreview
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          data={previewData}
          onConfirm={handleConfirmAndGeneratePdf}
          isGenerating={isGeneratingPdf}
        />
      )}

      {/* Editar Recibo (histórico) */}
      <Dialog open={!!editReceipt} onOpenChange={(o) => !o && setEditReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Recibo</DialogTitle>
            <DialogDescription>
              Ajuste o número e a descrição do serviço. O PDF será regerado com os novos dados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-num">Número do Recibo</Label>
              <Input
                id="edit-num"
                value={editNumero}
                onChange={(e) => setEditNumero(e.target.value)}
                placeholder="Ex: REC-XYZ-001/26"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Descrição do Serviço</Label>
              <Textarea
                id="edit-desc"
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReceipt(null)} disabled={isSavingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditReceipt} disabled={isSavingEdit}>
              {isSavingEdit ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SolicitacaoPagamentoModal open={solicitacaoPagamentoOpen} onOpenChange={setSolicitacaoPagamentoOpen} initialData={solicitacaoInitialData} />
    </Layout>
  );
}
