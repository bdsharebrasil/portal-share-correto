import { useEffect, useState } from "react";
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
      // Validação básica
      if (!formData.pagadorNome?.trim()) throw new Error("Nome do pagador é obrigatório");
      if (!formData.valor || Number(formData.valor) <= 0) throw new Error("Valor deve ser maior que zero");
      if (!formData.servicoDescricao?.trim()) throw new Error("Descrição do serviço é obrigatória");

      const receiptNumber = generateReceiptNumber(formData.clienteId ? formData.pagadorNome : "");
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

      if (formData.reembolsoBoletoFile instanceof File) boletoUrl = await uploadFile(formData.reembolsoBoletoFile, "boleto", "n.f-boletos-clients");
      if (formData.reembolsoNotaFiscalFile instanceof File) notaFiscalUrl = await uploadFile(formData.reembolsoNotaFiscalFile, "nf", "n.f-boletos-clients");

      // ===================== INSERIR RECIBO =====================
      // Para reembolso, adiciona número do documento na descrição
      let finalDescription = formData.servicoDescricao.trim();
      if (formData.receiptType === "reembolso" && formData.reembolsoNumeroDocumento?.trim()) {
        finalDescription = `${finalDescription} - Documento: ${formData.reembolsoNumeroDocumento.trim()}`;
      }

      const receiptPayload = {
        user_id: userId,
        payer_name: formData.pagadorNome.trim(),
        payer_document: formData.pagadorDocumento?.trim() || "",
        payer_address: formData.pagadorEndereco?.trim() || null,
        payer_city: formData.pagadorCidade?.trim() || null,
        payer_uf: formData.pagadorUF?.trim() || null,
        amount: Number(formData.valor),
        service_description: finalDescription,
        receipt_type: formData.receiptType || "pagamento",
        issue_date: formData.dataEmissao || new Date().toISOString().split("T")[0],
        receipt_number: receiptNumber,
        max_payment_date: formData.prazoMaximoQuitacao || null,
        payment_method: formData.formaPagamento?.trim() || null,
        client_id: formData.clienteId?.trim() ? formData.clienteId : null,
        boleto_url: boletoUrl,
        nf_url: notaFiscalUrl,
        doc_number: formData.reembolsoNumeroDocumento?.trim() || null,
      };

      // Evita duplicidade: verifica se já existe o receipt_number
      const { data: existing } = await supabase.from("receipts").select("id").eq("receipt_number", receiptNumber).eq("user_id", userId).single();
      if (existing) throw new Error("Recibo já gerado anteriormente.");

      const { data: receiptData, error: dbError } = await supabase.from("receipts").insert(receiptPayload).select("*").single();
      if (dbError) throw dbError;

      console.log("Recibo inserido:", receiptData);

      // ===================== PROCESSAR REEMBOLSO (bank_reconciliations + rateio) =====================
      if (formData.receiptType === "reembolso" && formData.clienteId) {
        try {
          console.log("📨 Processando reembolso com submissão de recibo...");

          // Determina o valor total e percentual corretamente
          const isRateado = formData.reembolsoRateado === true;
          const valorRecibo = Number(formData.valor); // valor que o cliente vai pagar
          const valorTotalDespesa = isRateado ? Number(formData.reembolsoValorTotal) : valorRecibo;
          const percentual = isRateado ? formData.reembolsoPorcentagem : "100";

          // Preparar payload para o novo serviço
          const submissionPayload = {
            type: "cliente" as const,
            date: formData.prazoMaximoQuitacao || formData.dataEmissao,
            description: `Reembolso - ${formData.servicoDescricao.trim()}${
              formData.reembolsoNumeroDocumento ? ` (Doc: ${formData.reembolsoNumeroDocumento})` : ""
            }`,
            amount: valorRecibo,
            status: "pendente",
            client_id: formData.clienteId,
            aircraft_id: formData.aircraftId || null,
            categoria_movimentacao_id: formData.reembolsoCategoriaId || null,
            tipo_documento: isRateado ? "rateio" as const : "recibo" as const,
            doc: formData.reembolsoNumeroDocumento || null,
            payment_term: formData.prazoMaximoQuitacao || null,
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
          const result = await handleReceiptSubmit(submissionPayload, userId);

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
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke("recibo-pdf", {
          body: { receiptData: { ...receiptData, boleto_url: boletoUrl, nf_url: notaFiscalUrl } },
        });
        if (pdfError) throw pdfError;

        if (pdfResult?.url) {
          const { error: updateError } = await supabase.from("receipts").update({ pdf_url: pdfResult.url }).eq("id", receiptData.id);
          if (updateError) throw updateError;
        }

        await loadRecentReceipts(userId);
        const attachmentInfo = uploadedFiles.length > 0
          ? `Anexos: ${uploadedFiles.map(f => f.type === 'boleto' ? 'Boleto' : 'Nota Fiscal').join(' e ')}.`
          : '';
        toast({ title: "✅ Sucesso!", description: `Recibo ${receiptNumber} gerado com sucesso! ${attachmentInfo}` });
      } catch (pdfErr) {
        console.error("Erro PDF:", pdfErr);
        toast({ title: "Recibo criado, PDF pendente", description: `Recibo ${receiptNumber} criado, mas o PDF falhou.`, variant: "default" });
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
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold text-white">Emissão de Recibos</h1>
            <p className="text-slate-400 mt-2">Gerar e gerenciar recibos PDF</p>
          </div>

          <Tabs defaultValue="emitir" className="w-full">
            <TabsList className="flex gap-3 bg-transparent p-0 border-0 max-w-lg">
              <TabsTrigger value="emitir">Emitir</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="descricoes">
                <Star className="h-4 w-4 mr-1" />
                Descrições Favoritas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="emitir">
              <ReceiptForm
                clientesAtivos={clientesAtivos}
                favoritePayers={favoritePayers}
                isGenerating={isGenerating}
                onSubmit={handleGenerateReceipt}
              />
            </TabsContent>

            <TabsContent value="historico">
              <div className="space-y-2">
                {recentReceipts.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-2 border rounded">
                    <span>{r.receipt_number} - {r.payer_name}</span>
                    <div className="space-x-2">
                      <button onClick={() => handleViewReceipt(r.id)}>Visualizar</button>
                      <button onClick={() => handleDownloadReceipt(r.id)}>Baixar</button>
                      <button onClick={() => handleDeleteReceipt(r.id)}>Excluir</button>
                    </div>
                  </div>
                ))}
                <button onClick={handleClearHistory}>Limpar Histórico</button>
              </div>
            </TabsContent>

            <TabsContent value="descricoes">
              <DescriptionManager />
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
