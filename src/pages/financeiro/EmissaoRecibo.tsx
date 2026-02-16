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

  // ===================== INIT =====================
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          await Promise.all([loadFavoritePayers(user.id), loadRecentReceipts(user.id), loadActiveClients()]);
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

  const loadFavoritePayers = async (uid: string) => {
    try {
      const { data, error } = await supabase.from("favorite_payers").select("*").eq("user_id", uid);
      if (error) throw error;
      setFavoritePayers(data?.map((d) => ({ id: d.id, name: d.name, document: d.document, address: d.address, city: d.city, uf: d.uf })) || []);
    } catch (err) {
      console.error("Erro ao carregar pagadores favoritos:", err);
    }
  };

  const loadRecentReceipts = async (uid: string) => {
    try {
      const { data, error } = await supabase.from("receipts").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      setRecentReceipts((data || []).map((d: any) => ({ ...d, receipt_type: d.receipt_type as ReceiptType })));
    } catch (err) {
      console.error("Erro ao carregar recibos:", err);
    }
  };

  // ===================== GERAÇÃO DE RECIBO =====================
  const handleGenerateReceipt = async (formData: any) => {
    if (isGenerating) return; // trava contra duplo clique
    setIsGenerating(true);
    setIsGeneratingPdf(false);

    try {
      // Garantir que temos o userId atualizado
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          throw new Error("Usuário não autenticado. Faça login novamente.");
        }
        currentUserId = user.id;
        setUserId(currentUserId);
      }

      // Extrai dados do submissionData que chegou do formulário
      const originalForm = formData.originalFormData || {};
      const isReembolso = originalForm.receiptType === "reembolso";

      // Pega o nome do pagador do originalFormData
      const nomePagador = originalForm.pagadorNome?.trim();

      if (!nomePagador) {
        console.error("Dados recebidos:", {
          formData,
          originalForm,
          pagadorNome: originalForm.pagadorNome
        });
        throw new Error("Nome do pagador não foi preenchido corretamente. Por favor, preencha os dados do pagador.");
      }
      if (!formData.amount || Number(formData.amount) <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }
      if (!formData.description?.trim()) {
        throw new Error("Descrição do serviço é obrigatória");
      }

      const receiptNumber = generateReceiptNumber(originalForm.clienteId ? nomePagador : "");
      console.log("Número de recibo:", receiptNumber);

      // ===================== UPLOAD DE ARQUIVOS =====================
      let boletoUrl: string | null = null;
      let notaFiscalUrl: string | null = null;
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

      // Extrai arquivos de formData
      if (formData.files?.boleto instanceof File) boletoUrl = await uploadFile(formData.files.boleto, "boleto", "n.f-boletos-clients");
      if (formData.files?.notaFiscal instanceof File) notaFiscalUrl = await uploadFile(formData.files.notaFiscal, "nf", "n.f-boletos-clients");

      // ===================== INSERIR RECIBO =====================
      // Para reembolso, adiciona número do documento na descrição
      let finalDescription = formData.description?.trim() || "";
      if (isReembolso && originalForm.reembolsoNumeroDocumento?.trim()) {
        finalDescription = `${finalDescription} - Documento: ${originalForm.reembolsoNumeroDocumento.trim()}`;
      }

      const receiptPayload = {
        user_id: currentUserId,
        payer_name: nomePagador,
        payer_document: originalForm.pagadorDocumento?.trim() || "",
        payer_address: originalForm.pagadorEndereco?.trim() || null,
        payer_city: originalForm.pagadorCidade?.trim() || null,
        payer_uf: originalForm.pagadorUF?.trim() || null,
        amount: Number(formData.amount),
        service_description: finalDescription,
        receipt_type: originalForm.receiptType || "pagamento",
        issue_date: originalForm.dataEmissao || new Date().toISOString().split("T")[0],
        receipt_number: receiptNumber,
        max_payment_date: originalForm.prazoMaximoQuitacao || null,
        payment_method: originalForm.formaPagamento?.trim() || null,
        client_id: originalForm.clienteId?.trim() ? originalForm.clienteId : null,
        boleto_url: boletoUrl,
        nf_url: notaFiscalUrl,
        doc_number: originalForm.reembolsoNumeroDocumento?.trim() || null,
      };

      // Evita duplicidade: verifica se já existe o receipt_number
      const { data: existing } = await supabase.from("receipts").select("id").eq("receipt_number", receiptNumber).eq("user_id", currentUserId).single();
      if (existing) throw new Error("Recibo já gerado anteriormente.");

      const { data: receiptData, error: dbError } = await supabase.from("receipts").insert(receiptPayload).select("*").single();
      if (dbError) throw dbError;

      console.log("Recibo inserido:", receiptData);

      // ===================== PROCESSAR REEMBOLSO (bank_reconciliations + rateio) =====================
      if (isReembolso && (originalForm.clienteId || formData.client_id)) {
        try {
          console.log("📨 Processando reembolso com submissão de recibo...");

          // Determina o valor total e percentual corretamente
          const isRateado = originalForm.reembolsoRateado === true;
          const valorRecibo = Number(formData.amount); // valor que o cliente vai pagar
          const valorTotalDespesa = isRateado ? Number(originalForm.reembolsoValorTotal) : valorRecibo;
          const percentual = isRateado ? originalForm.reembolsoPorcentagem : "100";

          // Preparar payload para o novo serviço
          const submissionPayload = {
            type: "cliente" as const,
            date: originalForm.prazoMaximoQuitacao || originalForm.dataEmissao,
            description: `Reembolso - ${formData.description?.trim()}${
              originalForm.reembolsoNumeroDocumento ? ` (Doc: ${originalForm.reembolsoNumeroDocumento})` : ""
            }`,
            amount: valorRecibo,
            status: "pendente",
            client_id: originalForm.clienteId || formData.client_id,
            aircraft_id: originalForm.aircraftId || formData.aircraft_id || null,
            categoria_movimentacao_id: originalForm.reembolsoCategoriaId || formData.categoria_movimentacao_id || null,
            tipo_documento: isRateado ? "rateio" as const : "recibo" as const,
            doc: originalForm.reembolsoNumeroDocumento || null,
            prazo_pagamento: originalForm.prazoMaximoQuitacao || null,
            percentual: percentual,
            forma_pagamento: isRateado ? "rateio_direto" : "empresa_paga",
            afeta_caixa_empresa: true,
            fornecedor_nome: null,
            fornecedor_dados: null,
            boleto_url: boletoUrl,
            nf_url: notaFiscalUrl,
            reference_id: receiptData.id,
            reference_type: "receipt",
            ...(isRateado && {
              rateio_data: {
                valor_total: valorTotalDespesa,
                percentual: parseFloat(percentual),
                valor_cliente: valorRecibo,
              },
            }),
          };

          // Chamar o novo serviço de submissão de recibos
          const result = await handleReceiptSubmit(submissionPayload, currentUserId);

          if (result.success) {
            console.log("✅ Reembolso processado com sucesso via novo serviço");
            console.log("   - bank_reconciliationId:", result.bankReconciliationId);
            if (result.rateioIds?.length) {
              console.log("   - rateioIds:", result.rateioIds);
            }
          } else {
            console.error("❌ Erro ao processar reembolso:", result.error);
            toast({
              title: "⚠️ Reembolso parcial",
              description: `Recibo criado, mas erro ao processar reembolso: ${result.error}`,
              variant: "default",
            });
          }
        } catch (reembolsoErr) {
          console.error("❌ Erro ao processar reembolso:", reembolsoErr);
          toast({
            title: "⚠️ Reembolso não processado",
            description: `Recibo criado, mas falhou ao processar reembolso. Verifique os logs.`,
            variant: "default",
          });
        }
      }

      // ===================== GERAR PDF =====================
      try {
        setIsGeneratingPdf(true);
        console.log("Gerando PDF com @react-pdf/renderer...");

        // Preparar dados para o PDF
        const pdfData = {
          ...receiptData,
          boleto_url: boletoUrl,
          nf_url: notaFiscalUrl,
        };

        // Gerar o PDF usando @react-pdf/renderer
        const pdfBlob = await pdf(
          <ReciboDocument data={pdfData} />
        ).toBlob();

        // Upload do PDF para o Storage
        const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(pdfFileName, pdfBlob, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Obter URL pública do PDF
        const { data: urlData } = supabase.storage
          .from("receipts")
          .getPublicUrl(pdfFileName);

        if (!urlData?.publicUrl) {
          throw new Error("Falha ao obter URL pública do PDF");
        }

        // Atualizar no banco de dados
        const { error: updateError } = await supabase
          .from("receipts")
          .update({ pdf_url: urlData.publicUrl })
          .eq("id", receiptData.id);

        if (updateError) throw updateError;

        // Recarregar histórico
        await loadRecentReceipts(currentUserId);

        // Preparar mensagem de sucesso
        const attachmentInfo = uploadedFiles.length > 0
          ? `Anexos: ${uploadedFiles.map(f => f.type === 'boleto' ? 'Boleto' : 'Nota Fiscal').join(' e ')}.`
          : '';

        toast({
          title: "✅ Sucesso!",
          description: `Recibo ${receiptNumber} gerado com sucesso! ${attachmentInfo}`
        });

        console.log("✅ PDF gerado e enviado com sucesso:", urlData.publicUrl);
      } catch (pdfErr) {
        console.error("❌ Erro ao gerar PDF:", pdfErr);
        const errorMsg = pdfErr instanceof Error ? pdfErr.message : "Erro ao gerar PDF";
        toast({
          title: "⚠️ Aviso",
          description: `Recibo ${receiptNumber} criado, mas houve erro ao gerar PDF: ${errorMsg}`,
          variant: "default"
        });
      }

    } catch (err) {
      console.error("Erro ao gerar recibo:", err);
      const errorMsg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as any).message) : "Erro desconhecido";
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
