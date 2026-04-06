import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Download, Loader2, FileText, CheckCircle2,
  File, Trash2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCTMDocumentGeneration, ServiceOrderDocument } from '@/hooks/useCTMDocumentGeneration';

interface CTMOASDocumentGeneratorProps {
  oasId: string;
  oasData: any;
  isOpen: boolean;
  onClose: () => void;
}

export function CTMOASDocumentGenerator({
  oasId,
  oasData,
  isOpen,
  onClose,
}: CTMOASDocumentGeneratorProps) {
  const {
    generateOASPDF,
    generateRASFromOAS,
    generateCompletionReport,
    listGeneratedDocuments,
    deleteDocument,
  } = useCTMDocumentGeneration();

  const [documents, setDocuments] = useState<ServiceOrderDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, oasId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await listGeneratedDocuments(oasId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      setGeneratingType('pdf');
      const doc = await generateOASPDF(oasId, oasData);
      if (doc) {
        setDocuments([doc, ...documents]);
        toast.success('PDF gerado com sucesso!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingType(null);
    }
  };

  const handleGenerateRAS = async () => {
    try {
      setGeneratingType('ras');
      const doc = await generateRASFromOAS(oasId, oasData);
      if (doc) {
        setDocuments([doc, ...documents]);
        toast.success('RAS gerado com sucesso!');
      }
    } catch (error) {
      console.error('Error generating RAS:', error);
      toast.error('Erro ao gerar RAS');
    } finally {
      setGeneratingType(null);
    }
  };

  const handleGenerateCompletionReport = async () => {
    try {
      setGeneratingType('completion');
      const doc = await generateCompletionReport(oasId, oasData);
      if (doc) {
        setDocuments([doc, ...documents]);
        toast.success('Relatório de conclusão gerado com sucesso!');
      }
    } catch (error) {
      console.error('Error generating completion report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingType(null);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const success = await deleteDocument(documentId);
      if (success) {
        setDocuments(documents.filter(d => d.id !== documentId));
        toast.success('Documento deletado com sucesso');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erro ao deletar documento');
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pdf_complete: 'PDF Completo',
      ras: 'RAS - Relatório de Acompanhamento',
      invoice: 'Fatura',
      completion_report: 'Relatório de Conclusão',
    };
    return labels[type] || type;
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      pdf_complete: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      ras: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      invoice: 'bg-green-500/20 text-green-300 border-green-500/30',
      completion_report: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    };
    return colors[type] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            Gerador de Documentos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info */}
          <Card className="bg-cyan-500/10 border-cyan-500/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-cyan-200">
                  <p className="font-semibold mb-1">Gerar Documentos da OAS</p>
                  <p className="text-xs text-cyan-100/80">
                    Selecione os tipos de documentos que deseja gerar para esta ordem de serviço
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generation Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Gerar Novo Documento</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleGeneratePDF}
                disabled={generatingType !== null}
                className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-200 h-auto py-3 flex flex-col items-start"
              >
                {generatingType === 'pdf' && <Loader2 className="h-4 w-4 animate-spin mr-0 mb-2" />}
                <span className="font-semibold text-sm">PDF Completo</span>
                <span className="text-xs text-blue-300/70">Relatório completo com todos os dados</span>
              </Button>

              <Button
                onClick={handleGenerateRAS}
                disabled={generatingType !== null}
                className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 h-auto py-3 flex flex-col items-start"
              >
                {generatingType === 'ras' && <Loader2 className="h-4 w-4 animate-spin mr-0 mb-2" />}
                <span className="font-semibold text-sm">RAS</span>
                <span className="text-xs text-purple-300/70">Relatório de Acompanhamento</span>
              </Button>

              <Button
                onClick={handleGenerateCompletionReport}
                disabled={generatingType !== null}
                className="bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-200 h-auto py-3 flex flex-col items-start"
              >
                {generatingType === 'completion' && <Loader2 className="h-4 w-4 animate-spin mr-0 mb-2" />}
                <span className="font-semibold text-sm">Conclusão</span>
                <span className="text-xs text-orange-300/70">Relatório de conclusão</span>
              </Button>
            </div>
          </div>

          {/* Documents List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Documentos Gerados</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDocuments}
                disabled={loading}
                className="gap-2 h-8 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-800/20 rounded-lg border border-white/5">
                <File className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">Nenhum documento gerado ainda</p>
                <p className="text-xs text-slate-500">Gere documentos acima</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="border border-white/5 rounded-lg p-3 bg-slate-800/20 hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs ${getDocumentTypeColor(doc.document_type)}`}>
                              {getDocumentTypeLabel(doc.document_type)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {doc.file_name || 'Documento'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Download logic would go here
                            toast.info('Download em desenvolvimento');
                          }}
                          className="h-8 gap-2 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
