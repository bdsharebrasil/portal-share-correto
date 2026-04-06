import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";
import { supabase } from "@/integrations/supabase/client";
import React from "react";

interface GeneratePdfOptions {
  receiptData: any;
  userId: string;
  onSuccess?: (pdfUrl: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook para gerar e fazer upload de PDF de recibos
 * Usa @react-pdf/renderer para a geração
 */
export const useReceiptPdfGenerator = () => {
  const generateAndUploadPdf = async (
    options: GeneratePdfOptions
  ): Promise<string | null> => {
    try {
      const { receiptData, userId, onSuccess, onError } = options;

      console.log("📄 Iniciando geração de PDF...");

      // Validar dados obrigatórios
      if (!receiptData?.id) {
        throw new Error("ID do recibo não encontrado");
      }

      if (!receiptData?.numero_recibo && !receiptData?.receipt_number) {
        throw new Error("Número do recibo não encontrado");
      }

      // Gerar PDF usando @react-pdf/renderer
      const pdfBlob = await pdf(
        <ReciboDocument data={receiptData} />
      ).toBlob();

      if (!pdfBlob) {
        throw new Error("Falha ao gerar PDF");
      }

      console.log(`✅ PDF gerado com sucesso (${(pdfBlob.size / 1024).toFixed(2)} KB)`);

      // Preparar nome do arquivo
      const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;

      // Upload para Storage
      console.log("📤 Fazendo upload do PDF...");
      const { error: uploadError } = await supabase.storage
        .from("recibos")
        .upload(pdfFileName, pdfBlob, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("recibos")
        .getPublicUrl(pdfFileName);

      if (!urlData?.publicUrl) {
        throw new Error("Falha ao obter URL pública do PDF");
      }

      console.log("✅ URL pública obtida:", urlData.publicUrl);

      // Atualizar registro no banco de dados
      console.log("💾 Atualizando banco de dados...");
      const { error: updateError } = await supabase
        .from("recibos")
        .update({ url_pdf: urlData.publicUrl })
        .eq("id", receiptData.id)
        .eq("usuario_id", userId);

      if (updateError) {
        throw new Error(`Erro ao atualizar banco: ${updateError.message}`);
      }

      console.log("✅ PDF gerado e salvo com sucesso!");

      // Chamar callback de sucesso
      if (onSuccess) {
        onSuccess(urlData.publicUrl);
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);

      // Chamar callback de erro
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }

      throw error;
    }
  };

  const downloadPdf = async (pdfUrl: string, fileName: string) => {
    try {
      console.log("📥 Iniciando download do PDF...");

      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.situacaoText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log("✅ Download concluído!");
    } catch (error) {
      console.error("❌ Erro ao fazer download:", error);
      throw error;
    }
  };

  return {
    generateAndUploadPdf,
    downloadPdf,
  };
};
