import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ReciboDocument } from '@/lib/reciboGenerator';

interface GeneratePdfOptions {
  receiptData: any;
  userId: string;
  onSuccess?: (pdfUrl: string) => void;
  onError?: (error: Error) => void;
}

export const normalizeReceiptForPdf = async (receiptData: any) => {
  let emissor = receiptData?.emissor || null;
  if (!emissor) {
    const { data: empresa } = await (supabase as any)
      .from('configuracao_empresa')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (empresa) {
      emissor = {
        razao_social: empresa.razao_social,
        cnpj: empresa.cnpj,
        telefone: empresa.telefone,
        endereco: empresa.endereco,
        cidade: empresa.cidade,
        cep: empresa.cep,
      };
    }
  }

  return {
    ...receiptData,
    receipt_number: receiptData.receipt_number || receiptData.numero_recibo || '',
    payer_name: receiptData.payer_name || receiptData.nome_pagador || '',
    payer_document: receiptData.payer_document || receiptData.documento_pagador || '',
    payer_address: receiptData.payer_address || receiptData.endereco_pagador || null,
    payer_city: receiptData.payer_city || receiptData.cidade_pagador || null,
    payer_uf: receiptData.payer_uf || receiptData.uf_pagador || null,
    service_description: receiptData.service_description || receiptData.descricao_servico || '',
    receipt_type: receiptData.receipt_type || receiptData.tipo_recibo || 'pagamento',
    issue_date: receiptData.issue_date || receiptData.data_emissao || null,
    max_payment_date: receiptData.max_payment_date || receiptData.data_max_pagamento || null,
    payment_method: receiptData.payment_method || receiptData.forma_pagamento || null,
    documento_number: receiptData.documento_number || receiptData.numero_documento || null,
    nome_categoria: receiptData.nome_categoria || null,
    valor: Number(receiptData.valor ?? receiptData.amount ?? 0),
    emissor,
  };
};

export function useReceiptPdfGenerator() {
  const generateAndUploadPdf = async ({ receiptData, userId, onSuccess, onError }: GeneratePdfOptions): Promise<string | null> => {
    try {
      if (!receiptData?.id) throw new Error('ID do recibo não encontrado');
      if (!receiptData?.numero_recibo && !receiptData?.receipt_number) throw new Error('Número do recibo não encontrado');

      const pdfData = await normalizeReceiptForPdf(receiptData);
      const pdfBlob = await pdf(<ReciboDocument data={pdfData} />).toBlob();
      if (!pdfBlob) throw new Error('Falha ao gerar PDF');

      const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('recibos')
        .upload(pdfFileName, pdfBlob, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
      if (uploadError) throw new Error(`Erro ao fazer upload: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('recibos').getPublicUrl(pdfFileName);
      if (!urlData?.publicUrl) throw new Error('Falha ao obter URL pública do PDF');

      const { error: updateError } = await supabase
        .from('recibos')
        .update({ pdf_url: urlData.publicUrl })
        .eq('id', receiptData.id)
        .eq('usuario_id', userId);
      if (updateError) throw new Error(`Erro ao atualizar banco: ${updateError.message}`);

      onSuccess?.(urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      onError?.(normalizedError);
      throw normalizedError;
    }
  };

  const downloadPdf = async (pdfUrl: string, fileName: string) => {
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Erro ao baixar: ${response.statusText}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return { generateAndUploadPdf, downloadPdf };
}