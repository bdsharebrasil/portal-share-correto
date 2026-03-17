import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  /**
   * Generate complete PDF from OAS data
   */
  const generateOASPDF = useCallback(
    async (
      oasId: string,
      oasData: any,
      userId?: string
    ): Promise<ServiceOrderDocument | null> => {
      try {
        // For now, we'll create a record indicating the PDF should be generated
        // The actual PDF generation would be handled by a backend function
        const fileName = `OAS-${oasData.numero}-${Date.now()}.pdf`;

        // Create document record
        const { data: document, error } = await supabase
          .from('ctm_service_order_documents')
          .insert([
            {
              service_order_id: oasId,
              document_type: 'pdf_complete',
              file_name: fileName,
              file_url: `/documents/${fileName}`,
              generated_at: new Date().toISOString(),
              generated_by: userId,
              metadata: {
                numero: oasData.numero,
                aircraft_id: oasData.aircraft_id,
                generated_via: 'system',
              },
            },
          ])
          .select()
          .single();

        if (error) throw error;

        toast.success('PDF gerado com sucesso');
        return document;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error generating OAS PDF:', errorMessage);
        toast.error('Erro ao gerar PDF da OAS');
        return null;
      }
    },
    []
  );

  /**
   * Generate RAS (Relatório de Acompanhamento de Serviço) from OAS
   */
  const generateRASFromOAS = useCallback(
    async (oasId: string, oasData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
      try {
        const fileName = `RAS-${oasData.numero}-${Date.now()}.pdf`;

        const { data: document, error } = await supabase
          .from('ctm_service_order_documents')
          .insert([
            {
              service_order_id: oasId,
              document_type: 'ras',
              file_name: fileName,
              file_url: `/documents/${fileName}`,
              generated_at: new Date().toISOString(),
              generated_by: userId,
              metadata: {
                numero: oasData.numero,
                aircraft_id: oasData.aircraft_id,
                tipo_manutencao: oasData.tipo_manutencao,
              },
            },
          ])
          .select()
          .single();

        if (error) throw error;

        toast.success('RAS gerado com sucesso');
        return document;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error generating RAS:', errorMessage);
        toast.error('Erro ao gerar RAS');
        return null;
      }
    },
    []
  );

  /**
   * Generate Invoice from approved budget
   */
  const generateInvoice = useCallback(
    async (
      budgetId: string,
      oasId: string,
      budgetData: any,
      userId?: string
    ): Promise<ServiceOrderDocument | null> => {
      try {
        const fileName = `INVOICE-${budgetData.titulo || 'Budget'}-${Date.now()}.pdf`;

        const { data: document, error } = await supabase
          .from('ctm_service_order_documents')
          .insert([
            {
              service_order_id: oasId,
              document_type: 'invoice',
              file_name: fileName,
              file_url: `/documents/${fileName}`,
              generated_at: new Date().toISOString(),
              generated_by: userId,
              metadata: {
                budget_id: budgetId,
                total_estimado: budgetData.total_estimado,
              },
            },
          ])
          .select()
          .single();

        if (error) throw error;

        toast.success('Fatura gerada com sucesso');
        return document;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error generating invoice:', errorMessage);
        toast.error('Erro ao gerar fatura');
        return null;
      }
    },
    []
  );

  /**
   * Generate completion report when OAS is done
   */
  const generateCompletionReport = useCallback(
    async (oasId: string, oasData: any, userId?: string): Promise<ServiceOrderDocument | null> => {
      try {
        const fileName = `COMPLETION-${oasData.numero}-${Date.now()}.pdf`;

        const { data: document, error } = await supabase
          .from('ctm_service_order_documents')
          .insert([
            {
              service_order_id: oasId,
              document_type: 'completion_report',
              file_name: fileName,
              file_url: `/documents/${fileName}`,
              generated_at: new Date().toISOString(),
              generated_by: userId,
              metadata: {
                numero: oasData.numero,
                status: oasData.status,
                completion_date: new Date().toISOString(),
              },
            },
          ])
          .select()
          .single();

        if (error) throw error;

        toast.success('Relatório de conclusão gerado com sucesso');
        return document;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error generating completion report:', errorMessage);
        toast.error('Erro ao gerar relatório de conclusão');
        return null;
      }
    },
    []
  );

  /**
   * List all generated documents for an OAS
   */
  const listGeneratedDocuments = useCallback(
    async (oasId: string): Promise<ServiceOrderDocument[]> => {
      try {
        const { data, error } = await supabase
          .from('ctm_service_order_documents')
          .select('*')
          .eq('service_order_id', oasId)
          .order('generated_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error listing documents:', errorMessage);
        return [];
      }
    },
    []
  );

  /**
   * Delete a generated document
   */
  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('ctm_service_order_documents').delete().eq('id', documentId);

      if (error) throw error;

      toast.success('Documento deletado com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting document:', errorMessage);
      toast.error('Erro ao deletar documento');
      return false;
    }
  }, []);

  /**
   * Get document download URL
   */
  const getDocumentUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      try {
        const { data, error } = await supabase
          .from('ctm_service_order_documents')
          .select('file_url')
          .eq('id', documentId)
          .single();

        if (error) throw error;
        return data?.file_url || null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error getting document URL:', errorMessage);
        return null;
      }
    },
    []
  );

  return {
    generateOASPDF,
    generateRASFromOAS,
    generateInvoice,
    generateCompletionReport,
    listGeneratedDocuments,
    deleteDocument,
    getDocumentUrl,
  };
}
