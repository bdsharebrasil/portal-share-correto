import { useCallback } from 'react';
import { fromUntyped } from '@/lib/supabase-helpers';
import { toast } from 'sonner';

export interface ServiceOrderDocument {
  id: string;
  service_order_id: string;
  document_type: 'pdf_complete' | 'ras' | 'invoice' | 'completion_report';
  file_url: string;
  file_name?: string;
  file_size_bytes?: number;
  generated_at: string;
  generated_by?: string;
  metadata?: any;
  created_at: string;
}

export function useCTMDocumentGeneration() {
  const generateOASPDF = useCallback(async (oasId: string, oasData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
    try {
      const fileName = `OAS-${oasData.numero}-${Date.now()}.pdf`;
      const { data: document, error } = await fromUntyped('ctm_oas_documents')
        .insert([{ service_order_id: oasId, document_type: 'pdf_complete', file_name: fileName, file_path: `/documents/${fileName}`, created_by: userId, description: `PDF OAS ${oasData.numero}` }])
        .select().single();
      if (error) throw error;
      toast.success('PDF gerado com sucesso');
      return document;
    } catch (error) {
      console.error('Error generating OAS PDF:', error);
      toast.error('Erro ao gerar PDF da OAS');
      return null;
    }
  }, []);

  const generateRASFromOAS = useCallback(async (oasId: string, oasData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
    try {
      const fileName = `RAS-${oasData.numero}-${Date.now()}.pdf`;
      const { data: document, error } = await fromUntyped('ctm_oas_documents')
        .insert([{ service_order_id: oasId, document_type: 'ras', file_name: fileName, file_path: `/documents/${fileName}`, created_by: userId, description: `RAS ${oasData.numero}` }])
        .select().single();
      if (error) throw error;
      toast.success('RAS gerado com sucesso');
      return document;
    } catch (error) {
      console.error('Error generating RAS:', error);
      toast.error('Erro ao gerar RAS');
      return null;
    }
  }, []);

  const generateInvoice = useCallback(async (budgetId: string, oasId: string, budgetData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
    try {
      const fileName = `INVOICE-${Date.now()}.pdf`;
      const { data: document, error } = await fromUntyped('ctm_oas_documents')
        .insert([{ service_order_id: oasId, document_type: 'invoice', file_name: fileName, file_path: `/documents/${fileName}`, created_by: userId, description: `Fatura orçamento` }])
        .select().single();
      if (error) throw error;
      toast.success('Fatura gerada com sucesso');
      return document;
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Erro ao gerar fatura');
      return null;
    }
  }, []);

  const generateCompletionReport = useCallback(async (oasId: string, oasData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
    try {
      const fileName = `COMPLETION-${oasData.numero}-${Date.now()}.pdf`;
      const { data: document, error } = await fromUntyped('ctm_oas_documents')
        .insert([{ service_order_id: oasId, document_type: 'completion_report', file_name: fileName, file_path: `/documents/${fileName}`, created_by: userId, description: `Relatório de conclusão ${oasData.numero}` }])
        .select().single();
      if (error) throw error;
      toast.success('Relatório de conclusão gerado com sucesso');
      return document;
    } catch (error) {
      console.error('Error generating completion report:', error);
      toast.error('Erro ao gerar relatório de conclusão');
      return null;
    }
  }, []);

  const listGeneratedDocuments = useCallback(async (oasId: string): Promise<ServiceOrderDocument[]> => {
    try {
      const { data, error } = await fromUntyped('ctm_oas_documents')
        .select('*')
        .eq('service_order_id', oasId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing documents:', error);
      return [];
    }
  }, []);

  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    try {
      const { error } = await fromUntyped('ctm_oas_documents').delete().eq('id', documentId);
      if (error) throw error;
      toast.success('Documento deletado com sucesso');
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erro ao deletar documento');
      return false;
    }
  }, []);

  const getDocumentUrl = useCallback(async (documentId: string): Promise<string | null> => {
    try {
      const { data, error } = await fromUntyped('ctm_oas_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();
      if (error) throw error;
      return data?.caminho_arquivo || null;
    } catch (error) {
      console.error('Error getting document URL:', error);
      return null;
    }
  }, []);

  return { generateOASPDF, generateRASFromOAS, generateInvoice, generateCompletionReport, listGeneratedDocuments, deleteDocument, getDocumentUrl };
}
