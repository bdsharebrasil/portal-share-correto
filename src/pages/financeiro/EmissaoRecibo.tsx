import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ReceiptForm } from "@/components/recibos/ReceiptForm";
import { ReceiptHistory } from "@/components/recibos/ReceiptHistory";
import { generateReceiptNumber, GeneratedReceipt, ReceiptType } from "@/lib/receiptUtils";
import { toast } from "@/hooks/use-toast";
import { FileText, Clock } from "lucide-react";

interface Cliente {
  id: string;
  company_name: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  uf: string | null;
  status: string | null;
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
  // ========================================
  // ESTADO: DADOS DO APP
  // ========================================
  const [userId, setUserId] = useState<string>("");
  const [clientesAtivos, setClientesAtivos] = useState<Cliente[]>([]);
  const [favoritePayers, setFavoritePayers] = useState<FavoritePayer[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<GeneratedReceipt[]>([]);

  // ========================================
  // ESTADO: UI
  // ========================================
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [viewPdfUrl, setViewPdfUrl] = useState<string | null>(null);

  // ========================================
  // EFEITOS: INICIALIZAÇÃO
  // ========================================
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
          ]);
        }
      } catch (err) {
        console.error("Erro ao inicializar:", err);
        toast({
          title: "Erro ao carregar",
          description: "Não foi possível carregar os dados",
          variant: "destructive",
        });
      }
    };

    initializeApp();
  }, []);

  // ========================================
  // MÉTODOS: CARREGAMENTO DE DADOS
  // ========================================

  const loadActiveClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, cnpj, address, city, uf, status")
        .eq("status", "ativo")
        .order("company_name", { ascending: true });

      if (error) throw error;
      setClientesAtivos(data || []);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
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
        data?.map((d) => ({
          id: d.id,
          name: d.name,
          document: d.document,
          address: d.address,
          city: d.city,
          uf: d.uf,
        })) || []
      );
    } catch (err) {
      console.error("Erro ao carregar pagadores favoritos:", err);
    }
  };

  const loadRecentReceipts = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      // Normalize/cast incoming rows so TypeScript knows receipt_type is a ReceiptType
      setRecentReceipts(
        (data || []).map((d: any) => ({
          ...d,
          receipt_type: d.receipt_type as ReceiptType,
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar recibos:", err);
    }
  };

  // ========================================
  // MÉTODOS: GERAÇÃO DE PDF
  // ========================================

  const generatePdfUrl = async (receiptId: string, receiptDataOverride?: any): Promise<string> => {
    try {
      // Se receiptDataOverride for fornecido, usar diretamente (para recibos recém-criados)
      const receipt = receiptDataOverride || recentReceipts.find((r) => r.id === receiptId);
      if (!receipt) {
        throw new Error("Recibo não encontrado no histórico");
      }

      // Retornar cache se existir
      if (receipt.pdf_url) {
        console.log("Usando URL de PDF em cache:", receipt.pdf_url);
        return receipt.pdf_url;
      }

      console.log("Gerando novo PDF para recibo:", receipt.receipt_number);

      // Preparar dados para edge function
      const receiptData = {
        user_id: receipt.user_id,
        payer_name: receipt.payer_name,
        payer_document: receipt.payer_document,
        payer_address: receipt.payer_address,
        payer_city: receipt.payer_city,
        payer_uf: receipt.payer_uf,
        amount: receipt.amount,
        service_description: receipt.service_description,
        receipt_type: receipt.receipt_type,
        issue_date: receipt.issue_date,
        receipt_number: receipt.receipt_number,
        max_payment_date: receipt.max_payment_date || null,
        payment_method: receipt.payment_method || null,
        client_id: receipt.client_id || null,
      };

      console.log("Chamando edge function com dados:", receiptData);

      // Chamar edge function com retry
      let result;
      let lastError;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke("recibo-pdf", {
            body: { receiptData },
          });

          if (error) {
            lastError = error;
            console.error(`Tentativa ${attempt + 1} de ${maxRetries + 1} falhou:`, error);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
            throw new Error(error.message || "Erro ao chamar edge function");
          }

          if (!data?.success) {
            const errorMsg = data?.error || "Resposta sem sucesso da edge function";
            lastError = new Error(errorMsg);
            console.error(`Tentativa ${attempt + 1} retornou erro:`, errorMsg);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
            throw lastError;
          }

          if (!data?.url) {
            lastError = new Error("URL do PDF não retornada pela edge function");
            console.error(`Tentativa ${attempt + 1}: URL não encontrada`);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
            throw lastError;
          }

          result = data;
          console.log("PDF gerado com sucesso:", data.url);
          break;
        } catch (err) {
          lastError = err;
          console.error(`Tentativa ${attempt + 1} resultou em erro:`, err);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
      }

      if (!result) {
        const msg = lastError instanceof Error ? lastError.message : "Erro desconhecido";
        throw new Error(`Falha ao gerar PDF após múltiplas tentativas: ${msg}`);
      }

      // Atualizar o registro do recibo com a URL do PDF
      console.log("Salvando URL do PDF no banco de dados para receiptId:", receiptId);
      console.log("URL a salvar:", result.url);

      // Tentar atualizar 3 vezes com retry antes de desistir
      let updateError: any = null;
      let updateData: any = null;
      const maxUpdateRetries = 3;

      for (let updateAttempt = 0; updateAttempt < maxUpdateRetries; updateAttempt++) {
        try {
          const result_update = await supabase
            .from("receipts")
            .update({ pdf_url: result.url })
            .eq("id", receiptId)
            .select("*");

          if (result_update.error) {
            updateError = result_update.error;
            console.error(`Tentativa ${updateAttempt + 1} de atualização falhou:`, result_update.error);

            if (updateAttempt < maxUpdateRetries - 1) {
              await new Promise(r => setTimeout(r, 500 * (updateAttempt + 1)));
              continue;
            }
          } else {
            updateData = result_update.data;
            updateError = null;
            console.log("URL do PDF atualizada com sucesso no banco");
            break;
          }
        } catch (err) {
          console.error(`Tentativa ${updateAttempt + 1} resultou em exceção:`, err);
          updateError = err;

          if (updateAttempt < maxUpdateRetries - 1) {
            await new Promise(r => setTimeout(r, 500 * (updateAttempt + 1)));
            continue;
          }
        }
      }

      if (updateError) {
        console.error("ERRO ao salvar URL no banco após múltiplas tentativas:", {
          error: updateError,
          receiptId,
          url: result.url,
          message: updateError?.message || updateError?.toString?.(),
        });
        throw new Error(`Falha ao salvar URL no banco: ${updateError?.message || "Erro desconhecido"}`);
      }

      if (!updateData || updateData.length === 0) {
        console.warn("Aviso: UPDATE retornou sem registros atualizados");
      } else {
        console.log("✅ URL do PDF salva com sucesso no banco de dados");
      }

      // Recarregar recibos para refletir a mudança
      try {
        await loadRecentReceipts(userId);
      } catch (reloadErr) {
        console.warn("Aviso: não foi possível recarregar recibos:", reloadErr);
      }

      return result.url;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("ERRO CRÍTICO em generatePdfUrl:", errorMsg);
      throw new Error(`Erro ao gerar PDF: ${errorMsg}`);
    }
  };

  // ========================================
  // MÉTODOS: EMISSÃO DE RECIBO
  // ========================================

  const handleGenerateReceipt = async (formData: any) => {
    setIsGenerating(true);
    setIsGeneratingPdf(false);
    try {
      console.log("Iniciando geração de recibo com dados:", formData);

      // Validação básica
      if (!formData.pagadorNome?.trim()) {
        throw new Error("Nome do pagador é obrigatório");
      }
      if (!formData.valor || Number(formData.valor) <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }
      if (!formData.servicoDescricao?.trim()) {
        throw new Error("Descrição do serviço é obrigatória");
      }

      const receiptNumber = generateReceiptNumber(
        formData.clienteId ? formData.pagadorNome : ""
      );

      console.log("Número de recibo gerado:", receiptNumber);

      // Inserir recibo
      const receiptPayload = {
        user_id: userId,
        payer_name: formData.pagadorNome?.trim() || "",
        payer_document: formData.pagadorDocumento?.trim() || "",
        payer_address: formData.pagadorEndereco?.trim() || null,
        payer_city: formData.pagadorCidade?.trim() || null,
        payer_uf: formData.pagadorUF?.trim() || null,
        amount: Number(formData.valor) || 0,
        service_description: formData.servicoDescricao?.trim() || "",
        receipt_type: formData.receiptType || "pagamento",
        issue_date: formData.dataEmissao || new Date().toISOString().split("T")[0],
        receipt_number: receiptNumber,
        max_payment_date: formData.prazoMaximoQuitacao || null,
        payment_method: formData.formaPagamento?.trim() || null,
        client_id: formData.clienteId?.trim() ? formData.clienteId : null,
      };

      console.log("Payload de recibo a ser inserido:", receiptPayload);

      let receiptData;
      let dbError;

      try {
        const result = await supabase
          .from("receipts")
          .insert(receiptPayload)
          .select('*')
          .single();

        receiptData = result.data;
        dbError = result.error;
      } catch (insertException) {
        console.error("Exceção ao tentar inserir recibo:", insertException);
        dbError = insertException;
      }

      if (dbError) {
        let errorDetail = "Erro desconhecido ao inserir recibo";

        if (dbError instanceof Error) {
          errorDetail = dbError.message;
        } else if (typeof dbError === 'object' && dbError !== null) {
          // Não tentar ler stream, apenas extrair propriedades diretas
          errorDetail = (dbError as any).message || JSON.stringify(dbError);
        } else if (typeof dbError === 'string') {
          errorDetail = dbError;
        }

        console.error("Erro ao inserir recibo no banco:", {
          error: dbError,
          detail: errorDetail,
          type: typeof dbError,
        });
        throw new Error(`Erro ao salvar recibo: ${errorDetail}`);
      }

      console.log("Recibo inserido com sucesso:", receiptData);

      // Validar que o recibo foi criado com sucesso antes de prosseguir
      if (!receiptData || !receiptData.id) {
        console.warn("Aviso: recibo criado mas não retornou ID");
      }

      // Automação: reembolso + cliente (apenas se o tipo de recibo for reembolso)
      if (formData.receiptType === "reembolso" && formData.clienteId?.trim()) {
        try {
          console.log("Iniciando automação de conciliação para reembolso...");

          const clientIdTrimmed = formData.clienteId.trim();

          // Validar que userId está disponível
          if (!userId) {
            console.warn("Aviso: userId não disponível para automação de conciliação");
          } else {
            // Usar aircraftId selecionada pelo usuário, se disponível
            let aircraftId = formData.aircraftId?.trim();

            // Se não tiver aircraft selecionada, buscar a primeira do cliente
            if (!aircraftId) {
              const { data: clientAircrafts, error: aircraftError } = await supabase
                .from("client_aircraft")
                .select("aircraft_id")
                .eq("client_id", clientIdTrimmed)
                .limit(1);

              if (aircraftError) {
                console.warn("Erro ao buscar aeronave do cliente:", aircraftError);
              } else if (!clientAircrafts?.length) {
                console.warn("Cliente não possui aeronave associada, pulando automação");
              } else {
                aircraftId = clientAircrafts[0].aircraft_id;
              }
            }

            if (aircraftId) {
              try {
                // Só tenta inserir se tiver aeronave
                // Validar dados antes de inserir
                if (!aircraftId) {
                  console.warn("Aviso: aircraft_id inválido");
                } else {
                  // Preparar dados com validações explícitas
                  const servicoDescricao = (formData.servicoDescricao || "Reembolso").trim();
                  const valor = Number(formData.valor);

                  if (!servicoDescricao || valor <= 0) {
                    console.warn("Aviso: dados inválidos para automação de reembolso");
                  } else if (!userId) {
                    console.warn("Aviso: userId ausente, não é possível criar conciliação");
                  } else if (!clientIdTrimmed || !aircraftId) {
                    console.warn("Aviso: clientId ou aircraftId ausente");
                  } else if (!receiptData?.id) {
                    console.warn("Aviso: receiptData.id ausente, não é possível criar referência");
                  } else {
                    // Validar formato da data
                    const dateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(formData.dataEmissao);
                    if (!dateFormatValid) {
                      console.warn("Aviso: formato de data inválido para conciliação:", formData.dataEmissao);
                    } else {
                      // Garantir que date está no formato DATE correto (YYYY-MM-DD)
                      // Mesma abordagem que RelatorioViagem usa
                      let dateStr = formData.dataEmissao;
                      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        // Se não estiver em formato correto, tentar converter
                        const dateObj = new Date(formData.dataEmissao);
                        dateStr = dateObj.toISOString().split('T')[0];
                      }

                      const reconciliationData = {
                        type: "cliente" as const,
                        date: dateStr,
                        description: `REEMBOLSO - ${servicoDescricao}`,
                        amount: -Math.abs(valor),
                        status: "pendente",
                        client_id: clientIdTrimmed,
                        aircraft_id: aircraftId,
                        category: "reembolso",
                        created_by: userId,
                      };

                      console.log("✅ Preparado para inserir conciliação de reembolso:", {
                        type: reconciliationData.type,
                        date: reconciliationData.date,
                        client_id: reconciliationData.client_id,
                        aircraft_id: reconciliationData.aircraft_id,
                        category: reconciliationData.category,
                        created_by: !!reconciliationData.created_by,
                        amount: reconciliationData.amount,
                        status: reconciliationData.status,
                      });

                      try {
                        // Usar mesma abordagem que RelatorioViagem (sem .select())
                        const { error: reconciliationError } = await supabase
                          .from("bank_reconciliations")
                          .insert([reconciliationData]);

                        if (reconciliationError) {
                          console.warn("⚠️ Aviso ao criar conciliação automática:", {
                            message: reconciliationError.message,
                            details: reconciliationError.details,
                            code: reconciliationError.code,
                          });
                        } else {
                          console.log("✅ Conciliação automática criada com sucesso para reembolso");
                        }
                      } catch (insertErr) {
                        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
                        console.warn("⚠️ Erro ao tentar criar conciliação automática:", msg);
                      }
                    }
                  }
                }
              } catch (insertErr) {
                const errMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
                console.warn("Erro ao processar inserção de conciliação:", errMsg);
              }
            }
          }
        } catch (reconErr) {
          const errorMsg = reconErr instanceof Error ? reconErr.message : String(reconErr);
          console.warn("Aviso: automação de conciliação falhou (não bloqueador):", errorMsg);
          // Não interromper a criação do recibo se a conciliação automática falhar
        }
      }
      // FIM: Automação de conciliação

      // Adicionar como favorito se marcado
      if (formData.addAsFavorite) {
        try {
          await supabase.from("favorite_payers").insert({
            user_id: userId,
            name: formData.pagadorNome,
            document: formData.pagadorDocumento,
            address: formData.pagadorEndereco || null,
            city: formData.pagadorCidade || null,
            uf: formData.pagadorUF || null,
          });
          await loadFavoritePayers(userId);
          console.log("Pagador adicionado aos favoritos");
        } catch (favErr) {
          console.warn("Aviso: favorito não foi criado (não bloqueador):", favErr);
        }
      }

      // Gerar PDF imediatamente (passar receiptData diretamente para evitar race condition)
      try {
        setIsGeneratingPdf(true);
        console.log("Iniciando geração de PDF imediatamente após criação do recibo...");
        await generatePdfUrl(receiptData.id, receiptData);
        console.log("✅ PDF gerado com sucesso imediatamente");

        // Recarregar histórico para refletir a URL do PDF
        await loadRecentReceipts(userId);

        // Feedback
        toast({
          title: "Sucesso!",
          description: `Recibo ${receiptNumber} gerado com sucesso. PDF criado e pronto para visualizar!`,
        });
      } catch (pdfErr) {
        const pdfErrorMsg = pdfErr instanceof Error ? pdfErr.message : "Erro desconhecido";
        console.error("⚠️ Aviso: PDF não foi gerado imediatamente, mas recibo foi criado:", pdfErrorMsg);

        // Recarregar histórico mesmo com erro no PDF
        await loadRecentReceipts(userId);

        // Feedback: recibo criado, mas PDF não foi gerado
        toast({
          title: "Recibo criado, mas PDF teve problema",
          description: `Recibo ${receiptNumber} foi criado com sucesso. Clique em "Visualizar" para tentar gerar o PDF novamente. Erro: ${pdfErrorMsg}`,
          variant: "default",
        });
      } finally {
        setIsGeneratingPdf(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("ERRO ao gerar recibo:", errorMsg);
      toast({
        title: "Erro ao gerar recibo",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setIsGeneratingPdf(false);
    }
  };

  // ========================================
  // MÉTODOS: HISTÓRICO
  // ========================================

  const handleViewReceipt = async (receiptId: string) => {
    setIsLoadingPdf(true);
    try {
      console.log("Iniciando visualização de PDF para receiptId:", receiptId);
      const pdfUrl = await generatePdfUrl(receiptId);
      console.log("✅ URL gerada com sucesso:", pdfUrl);
      setViewPdfUrl(pdfUrl);
      setIsPdfViewerOpen(true);
      await loadRecentReceipts(userId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("❌ Erro ao visualizar PDF:", {
        receiptId,
        error: errorMsg,
        fullError: err,
      });
      toast({
        title: "Erro ao abrir PDF",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    try {
      const { error } = await supabase.from("receipts").delete().eq("id", receiptId);

      if (error) throw error;
      await loadRecentReceipts(userId);
      toast({
        title: "Sucesso!",
        description: "Recibo excluído",
      });
    } catch (err) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o recibo",
        variant: "destructive",
      });
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Tem certeza que deseja limpar todos os recibos? Esta ação é irreversível.")) {
      return;
    }

    try {
      const { error } = await supabase.from("receipts").delete().eq("user_id", userId);

      if (error) throw error;
      await loadRecentReceipts(userId);
      toast({
        title: "Sucesso!",
        description: "Histórico limpo",
      });
    } catch (err) {
      toast({
        title: "Erro ao limpar histórico",
        description: "Não foi possível limpar",
        variant: "destructive",
      });
    }
  };

  const handleDownloadReceipt = async (receiptId: string) => {
    try {
      // Encontrar o recibo nos dados carregados
      const receipt = recentReceipts.find(r => r.id === receiptId);
      if (!receipt) {
        throw new Error("Recibo não encontrado");
      }

      // Gerar URL do PDF se necessário
      const pdfUrl = await generatePdfUrl(receiptId, receipt);

      if (!pdfUrl) {
        throw new Error("Não foi possível gerar a URL do PDF");
      }

      // Baixar o PDF
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt.receipt_number.replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Sucesso!",
        description: "Recibo baixado com sucesso",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("Erro ao baixar recibo:", errorMsg);
      toast({
        title: "Erro ao baixar",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <Layout>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-extrabold text-white">Emissão de Recibos</h1>
            <p className="text-slate-400 mt-2">Gerar e gerenciar recibos PDF</p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="emitir" className="w-full">
            <TabsList className="flex gap-3 bg-transparent p-0 border-0 max-w-lg">
              <TabsTrigger
                value="emitir"
                className="rounded-xl overflow-hidden transition-all p-0 flex-1 data-[state=inactive]:hover:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-blue-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
              >
                <div className="w-full bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl overflow-hidden p-3 flex flex-col items-center gap-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm text-foreground">Emitir</p>
                  </div>
                </div>
              </TabsTrigger>

              <TabsTrigger
                value="historico"
                className="rounded-xl overflow-hidden transition-all p-0 flex-1 data-[state=inactive]:hover:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-emerald-500 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background"
              >
                <div className="w-full bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-xl overflow-hidden p-3 flex flex-col items-center gap-2">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Clock className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm text-foreground">Histórico</p>
                  </div>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Emitir */}
            <TabsContent value="emitir" className="space-y-6">
              <ReceiptForm
                clientesAtivos={clientesAtivos}
                favoritePayers={favoritePayers}
                isGenerating={isGenerating}
                onSubmit={handleGenerateReceipt}
              />
            </TabsContent>

            {/* Tab: Histórico */}
            <TabsContent value="historico">
              <ReceiptHistory
                receipts={recentReceipts}
                onView={handleViewReceipt}
                onDelete={handleDeleteReceipt}
                onDownload={handleDownloadReceipt}
                onClearAll={handleClearHistory}
                isLoading={isLoadingPdf}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* PDF Viewer */}
      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
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
                const link = document.createElement('a');
                link.href = viewPdfUrl;
                link.download = 'recibo.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
