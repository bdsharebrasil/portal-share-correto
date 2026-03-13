import React, { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ReceiptForm } from "@/components/recibos/ReceiptForm";
import { DescriptionManager } from "@/components/recibos/DescriptionManager";
import { generateReceiptNumber, GeneratedReceipt, ReceiptType } from "@/lib/receiptUtils";
import { handleReceiptSubmit } from "@/services/receiptSubmitHandler";
import { toast } from "@/hooks/use-toast";
import { FileText, Clock, Star } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";

interface Cliente {
  id: string;
  company_name: string | null;
  cnpj?: string | null;
  address?: string | null;
  city?: string | null;
  uf?: string | null;
  status?: string | null;
}

interface FavoritePayer {
  id: string;
  name: string;
  document: string;
  address?: string;
  city?: string;
  uf?: string;
}

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
  const [companySettings, setCompanySettings] = useState<any>(null);

  // ===================== INIT =====================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          await Promise.all([loadFavoritePayers(user.id), loadRecentReceipts(user.id), loadActiveClients(), loadCompanySettings()]);
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
      const { data, error } = await supabase.from("clients").select("*").eq("status", "ativo").order("company_name");
      if (error) throw error;
      setClientesAtivos(data || []);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      if (data) setCompanySettings(data);
    } catch (err) {
      console.error("Erro ao carregar dados da empresa:", err);
    }
  };

  const loadFavoritePayers = async (uid: string) => {
    try {
      const { data, error } = await supabase.from("favorite_payers").select("*").eq("user_id", uid);
      if (error) throw error;
      setFavoritePayers(data?.map((d) => ({ id: d.id, name: d.name, document: d.document, address: d.address, city: d.city, uf: d.uf })) || []);
    } catch (err) {
      console.error("Erro ao carregar pagadores favoritos:", err);
    }
  };

  const loadRecentReceipts = async (_uid?: string) => {
    try {
      const { data, error } = await supabase.from("receipts").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setRecentReceipts((data || []).map((d: any) => ({ ...d, receipt_type: d.receipt_type as ReceiptType })));
    } catch (err) {
      console.error("Erro ao carregar recibos:", err);
    }
  };

  // ===================== GERAÇÃO DE RECIBO =====================
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
      const nomePagador = originalForm.pagadorNome?.trim();

      if (!nomePagador) throw new Error("Nome do pagador não foi preenchido corretamente.");
      const valorNumerico = parseFloat(String(formData.valor || "0").replace(",", "."));
      if (!valorNumerico || valorNumerico <= 0) throw new Error("Valor deve ser maior que zero");
      if (!(formData.servicoDescricao || "").trim()) throw new Error("Descrição do serviço é obrigatória");

      const receiptNumber = generateReceiptNumber(originalForm.clienteId ? nomePagador : "");

      // ===================== UPLOAD DE ARQUIVOS =====================
      let boletoUrl: string | null = null;
      let notaFiscalUrl: string | null = null;
      let deceeaUrl: string | null = null;
      let infraeroUrl: string | null = null;
      const uploadedFiles: { type: string; name: string }[] = [];

      const uploadFile = async (file: File, prefix: string, storage: string) => {
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 100);
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileName = `${prefix}_${timestamp}_${randomSuffix}_${sanitizedFileName}`;
        const { error } = await supabase.storage.from(storage).upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from(storage).getPublicUrl(fileName);
        if (!publicUrlData?.publicUrl) throw new Error("Falha ao obter URL pública do arquivo");
        uploadedFiles.push({ type: prefix, name: fileName });
        return publicUrlData.publicUrl;
      };

      if (formData.files?.boleto instanceof File) boletoUrl = await uploadFile(formData.files.boleto, "boleto", "n.f-boletos-clients");
      if (formData.files?.notaFiscal instanceof File) notaFiscalUrl = await uploadFile(formData.files.notaFiscal, "nf", "n.f-boletos-clients");
      if (originalForm.decealFile instanceof File) deceeaUrl = await uploadFile(originalForm.decealFile, "decea", "n.f-boletos-clients");
      if (originalForm.infraeroFile instanceof File) infraeroUrl = await uploadFile(originalForm.infraeroFile, "infraero", "n.f-boletos-clients");

      // ===================== INSERIR RECIBO =====================
      let finalDescription = (formData.servicoDescricao || "").trim();

      const receiptPayload = {
        user_id: currentUserId,
        payer_name: nomePagador,
        payer_document: originalForm.pagadorDocumento?.trim() || "",
        payer_address: originalForm.pagadorEndereco?.trim() || null,
        payer_city: originalForm.pagadorCidade?.trim() || null,
        payer_uf: originalForm.pagadorUF?.trim() || null,
        amount: valorNumerico,
        service_description: finalDescription,
        receipt_type: originalForm.receiptType || "pagamento",
        issue_date: originalForm.dataEmissao || new Date().toISOString().split("T")[0],
        receipt_number: receiptNumber,
        max_payment_date: originalForm.prazoMaximoQuitacao || originalForm.dataVencimentoBoleto || null,
        payment_method: originalForm.formaPagamento?.trim() || null,
        client_id: originalForm.clienteId?.trim() ? originalForm.clienteId : null,
        boleto_url: boletoUrl,
        nf_url: notaFiscalUrl,
        doc_number: originalForm.reembolsoNumeroDocumento || originalForm.numeroDocumentoDecea || originalForm.numeroDocumentoInfraero || null,
        aircraft_id: originalForm.aircraftId || null,
        category_name: formData.categoriaNome || null,
        is_shared: originalForm.reembolsoRateado || false,
        percentage: originalForm.reembolsoPorcentagem ? parseFloat(originalForm.reembolsoPorcentagem) : null,
        total_amount: originalForm.reembolsoValorTotal ? parseFloat(originalForm.reembolsoValorTotal) : null,
      };

      const { data: existing } = await supabase.from("receipts").select("id").eq("receipt_number", receiptNumber).eq("user_id", currentUserId).single();
      if (existing) throw new Error("Recibo já gerado anteriormente.");

      // Insert receipt - use workaround for broken DB trigger on reembolso type
      // The trigger handle_reembolso_receipt has a UUID type mismatch on banco_conciliacao_id
      // So we insert as 'pagamento' first, then update to 'reembolso' after
      const needsTriggerWorkaround = isReembolso;
      const insertPayload = needsTriggerWorkaround
        ? { ...receiptPayload, receipt_type: "pagamento" }
        : receiptPayload;

      const { data: receiptData, error: dbError } = await supabase.from("receipts").insert(insertPayload).select("*").single();
      if (dbError) throw dbError;

      // Now update to correct type (bypasses AFTER INSERT trigger)
      if (needsTriggerWorkaround) {
        await supabase.from("receipts").update({ receipt_type: "reembolso" } as any).eq("id", receiptData.id);
        (receiptData as any).receipt_type = "reembolso";
      }

      console.log("Recibo inserido:", receiptData);

      // ===================== PROCESSAR REEMBOLSO =====================
      if (isReembolso && originalForm.clienteId) {
        try {
          console.log("📨 Processando reembolso...");
          const isDecea = formData.isDecea === true;
          const isInfraero = formData.isInfraero === true;
          const isDECEAorINFRAERO = isDecea || isInfraero;
          const isRateado = originalForm.reembolsoRateado === true;
          const valorRecibo = valorNumerico;
          const percentual = isRateado ? originalForm.reembolsoPorcentagem : "100";
          const valorTotalDespesa = isRateado ? parseFloat(originalForm.reembolsoValorTotal) : valorRecibo;

          // Get aircraft registration
          let aeronaveRegistro = "";
          if (originalForm.aircraftId) {
            const { data: acData } = await supabase.from("aircraft").select("registration").eq("id", originalForm.aircraftId).single();
            if (acData) aeronaveRegistro = acData.registration;
          }

          // Description for bank_reconciliations
          const brDescription = isDECEAorINFRAERO
            ? (isDecea ? "DECEA pago" : "INFRAERO  pago")
            : `Reembolso - ${finalDescription}`;

          // Data de vencimento
          const dataVencimento = originalForm.dataVencimentoBoleto || originalForm.prazoMaximoQuitacao || originalForm.dataEmissao;

          // ===== 1. Create contas_apagar =====
          const contaPayload: any = {
            data_vencimento: dataVencimento,
            valor: isDECEAorINFRAERO ? parseFloat(originalForm.valorTotalBoleto || String(valorRecibo)) : valorRecibo,
            categoria: "Clientes - Despesas Reembolsáveis",
            descricao: brDescription,
            status: "gerada na emissão de recibo",
            criado_por: currentUserId,
            client_id: originalForm.clienteId,
            aeronave_registro: aeronaveRegistro,
          };

          // DECEA-specific fields
          if (isDecea) {
            contaPayload.numero_documento_decea = originalForm.numeroDocumentoDecea || null;
            contaPayload.competencia_decea = originalForm.competenciaDecea || null;
            contaPayload.decea_url = deceeaUrl || null;
          }

          // INFRAERO-specific fields
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

            // ===== 2. Create bank_reconciliations =====
            const brPayload: any = {
              type: "cliente",
              date: originalForm.dataEmissao || new Date().toISOString().split("T")[0],
              description: brDescription,
              amount: valorRecibo,
              status: "pendente",
              client_id: originalForm.clienteId,
              aircraft_id: originalForm.aircraftId || null,
              categoria_movimentacao_id: originalForm.reembolsoCategoriaId || null,
              tipo_documento: isRateado ? "rateio" : "recibo",
              prazo_pagamento: dataVencimento,
              percentual: isRateado ? percentual : null,
              afeta_caixa_empresa: true,
              criado_por: currentUserId,
              reference_id: contaData.id,
              reference_type: "contas_apagar",
              boleto_url: boletoUrl,
              nf_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
            };

            const { data: brData, error: brError } = await supabase
              .from("bank_reconciliations")
              .insert(brPayload)
              .select("id")
              .single();

            if (brError) {
              console.error("❌ Erro ao criar bank_reconciliation:", brError);
            } else {
              console.log("✅ Bank reconciliation criada:", brData.id);
            }

            // ===== 3. Create contas_areceber =====
            const clienteData = clientesAtivos.find(c => c.id === originalForm.clienteId);
            const contaReceberPayload: any = {
              numero: receiptData.receipt_number || `REC-${receiptData.id.substring(0, 8)}`,
              cliente_nome: clienteData?.company_name || nomePagador,
              cliente_cnpj: clienteData?.cnpj || originalForm.pagadorDocumento || "",
              categoria: "Clientes - Despesas Reembolsáveis",
              valor: valorRecibo,
              data_criacao: originalForm.dataEmissao || new Date().toISOString().split("T")[0],
              data_vencimento: dataVencimento,
              status: "pendente",
              descricao: brDescription,
              aeronave: aeronaveRegistro || null,
              banco_conciliacao_id: brData?.id || null,
              criado_por: currentUserId,
              reference_id: receiptData.id,
              reference_type: "receipt",
              boleto_url: boletoUrl,
              nota_fiscal_url: notaFiscalUrl || deceeaUrl || infraeroUrl,
            };

            const { error: crError } = await supabase
              .from("contas_areceber")
              .insert(contaReceberPayload);

            if (crError) {
              console.error("❌ Erro ao criar conta a receber:", crError);
            } else {
              console.log("✅ Conta a receber criada");
            }
          }

          // ===== 3. Rateio if applicable =====
          if (isRateado) {
            const rateioPayload = {
              despesa_id: contaData?.id || receiptData.id,
              client_id: originalForm.clienteId,
              client_name: nomePagador,
              aeronave_id: originalForm.aircraftId || null,
              aeronave_registro: aeronaveRegistro,
              percentual: parseFloat(percentual),
              valor_rateado: valorRecibo,
              valor: valorTotalDespesa,
              status: "pendente",
              data_vencimento: dataVencimento,
              categoria_id: originalForm.reembolsoCategoriaId || null,
              boleto: boletoUrl,
              nota_fiscal: notaFiscalUrl || deceeaUrl || infraeroUrl,
              observacoes: `Rateio de ${percentual}% do valor total de R$ ${valorTotalDespesa.toFixed(2)}`,
            };

            const { error: rateioErr } = await supabase.from("rateio_despesas").insert(rateioPayload);
            if (rateioErr) console.error("❌ Erro ao criar rateio:", rateioErr);
            else console.log("✅ Rateio criado");
          }
        } catch (reembolsoErr) {
          console.error("❌ Erro ao processar reembolso:", reembolsoErr);
          toast({ title: "⚠️ Reembolso não processado", description: "Recibo criado, mas falhou ao processar reembolso.", variant: "default" });
        }
      }


      // ===================== GERAR PDF =====================
      try {
        setIsGeneratingPdf(true);
        const pdfData = {
          ...receiptData,
          boleto_url: boletoUrl,
          nf_url: notaFiscalUrl,
          numero_documento_decea: originalForm.numeroDocumentoDecea || null,
          competencia_decea: originalForm.competenciaDecea || null,
          numero_documento_infraero: originalForm.numeroDocumentoInfraero || null,
          competencia_infraero: originalForm.competenciaInfraero || null,
          data_vencimento_boleto: originalForm.dataVencimentoBoleto || null,
          emissor: companySettings ? {
            razao_social: companySettings.razao_social,
            cnpj: companySettings.cnpj,
            telefone: companySettings.telefone,
            endereco: companySettings.endereco,
            cidade: companySettings.cidade,
            cep: companySettings.cep,
          } : null,
        };

        const pdfBlob = await pdf(<ReciboDocument data={pdfData} />).toBlob();
        const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(pdfFileName, pdfBlob, { contentType: "application/pdf", upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(pdfFileName);
        if (!urlData?.publicUrl) throw new Error("Falha ao obter URL pública do PDF");

        await supabase.from("receipts").update({ pdf_url: urlData.publicUrl }).eq("id", receiptData.id);
        await loadRecentReceipts(currentUserId);

        toast({ title: "✅ Sucesso!", description: `Recibo ${receiptNumber} gerado com sucesso!` });
      } catch (pdfErr) {
        console.error("❌ Erro ao gerar PDF:", pdfErr);
        toast({ title: "⚠️ Aviso", description: `Recibo criado, mas houve erro ao gerar PDF.`, variant: "default" });
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
      const receipt = recentReceipts.find(r => r.id === receiptId);
      if (!receipt || !receipt.pdf_url) throw new Error("PDF não disponível");
      setViewPdfUrl(receipt.pdf_url);
      setIsPdfViewerOpen(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao abrir PDF", description: errorMsg, variant: "destructive" });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // ===================== EXCLUIR RECIBO =====================
  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      const { error } = await supabase.from("receipts").delete().eq("id", receiptId);
      if (error) throw error;
      await loadRecentReceipts(userId);
      toast({ title: "Sucesso!", description: "Recibo excluído" });
    } catch {
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o recibo", variant: "destructive" });
    }
  };

  // ===================== LIMPAR HISTÓRICO =====================
  const handleClearHistory = async () => {
    if (!confirm("Tem certeza que deseja limpar todos os recibos? Esta ação é irreversível.")) return;
    try {
      const { error } = await supabase.from("receipts").delete().eq("user_id", userId);
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
      const receipt = recentReceipts.find(r => r.id === receiptId);
      if (!receipt || !receipt.pdf_url) throw new Error("PDF não disponível");
      const response = await fetch(receipt.pdf_url);
      if (!response.ok) throw new Error(`Erro ao baixar: ${response.statusText}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt.receipt_number.replace(/\//g, '-')}.pdf`;
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

  // ===================== RENDER =====================
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-card/30 p-4 md:p-8 rounded-[13px] overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Emissão de Recibos
            </h1>
            <p className="text-muted-foreground text-lg">Gerar e gerenciar recibos PDF de forma simples e segura</p>
          </div>

          <Tabs defaultValue="emitir" className="w-full">
            {/* Tab Navigation */}
            <div className="overflow-x-auto">
              <TabsList className="flex gap-2 bg-card/50 backdrop-blur-sm p-1.5 rounded-xl border border-border/50 w-fit md:w-auto">
                <TabsTrigger value="emitir" className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
                  <FileText className="h-4 w-4 mr-2" />
                  Emitir
                </TabsTrigger>
                <TabsTrigger value="historico" className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
                  <Clock className="h-4 w-4 mr-2" />
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="descricoes" className="px-4 py-2.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-lg transition-all">
                  <Star className="h-4 w-4 mr-2" />
                  Descrições Favoritas
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content - Emitir */}
            <TabsContent value="emitir" className="mt-6">
              <div className="rounded-[19px] bg-card/30 backdrop-blur-sm border border-border/50 p-6 md:p-8 shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <ReceiptForm
                  clientesAtivos={clientesAtivos}
                  favoritePayers={favoritePayers}
                  isGenerating={isGenerating}
                  onSubmit={handleGenerateReceipt}
                />
              </div>
            </TabsContent>

            {/* Tab Content - Histórico */}
            <TabsContent value="historico" className="mt-6">
              <div className="space-y-4">
                {/* Clear History Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleClearHistory}
                    className="px-4 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-lg transition-colors text-sm font-medium"
                  >
                    Limpar Histórico
                  </button>
                </div>

                {/* Receipts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentReceipts.length > 0 ? (
                    recentReceipts.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-5 hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
                      >
                        {/* Receipt Header */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-muted-foreground">Recibo</p>
                              <p className="text-primary font-bold truncate group-hover:text-primary/80">{r.receipt_number}</p>
                            </div>
                            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full whitespace-nowrap">
                              {r.receipt_type === 'reembolso' ? 'Reembolso' : 'Pagamento'}
                            </span>
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Pagador</p>
                            <p className="font-medium text-foreground truncate">{r.payer_name}</p>
                          </div>

                          {r.payer_document && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Documento</p>
                              <p className="text-sm font-mono text-foreground">{r.payer_document}</p>
                            </div>
                          )}

                          <div className="pt-2 border-t border-border/30">
                            <p className="text-sm text-muted-foreground mb-1">Valor</p>
                            <p className="text-lg font-bold text-primary">R$ {r.amount?.toFixed(2).replace('.', ',') || '0,00'}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewReceipt(r.id)}
                            disabled={isLoadingPdf}
                            className="flex-1 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            Visualizar
                          </button>
                          <button
                            onClick={() => handleDownloadReceipt(r.id)}
                            className="flex-1 px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg transition-colors text-sm font-medium"
                          >
                            Baixar
                          </button>
                          <button
                            onClick={() => handleDeleteReceipt(r.id)}
                            className="flex-1 px-3 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-lg transition-colors text-sm font-medium"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-12 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Nenhum recibo gerado ainda</p>
                    </div>
                  )}
                </div>
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

      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Recibo</DialogTitle>
          </DialogHeader>
          {viewPdfUrl && (
            <DocumentViewer url={viewPdfUrl} fileName="recibo.pdf" fileType="application/pdf" onDownload={() => {
              const link = document.createElement('a');
              link.href = viewPdfUrl;
              link.download = 'recibo.pdf';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}