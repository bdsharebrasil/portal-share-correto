import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, BarChart3, PieChart, TrendingUp, Calendar, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RelatoriosExportacaoProps {
  clienteId: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

interface PreviewState {
  tipo: string | null;
  pdfBlob: Blob | null;
  pdfUrl: string | null;
}

export function RelatoriosExportacao({ clienteId, aeronaveId, periodo }: RelatoriosExportacaoProps) {
  const [incluirGraficos, setIncluirGraficos] = useState(true);
  const [gerando, setGerando] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ tipo: null, pdfBlob: null, pdfUrl: null });

  // Buscar dados do cliente
  const { data: cliente } = useQuery({
    queryKey: ['cliente-info', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  // Buscar despesas para relatório
  const { data: despesas = [] } = useQuery({
    queryKey: ['despesas-relatorio', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria),
          aircraft:aircraft_id (registration)
        `)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim)
        .order('date', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Função reutilizável para gerar PDF
  const gerarPDFDocumento = (tipo: string): jsPDF => {
    const doc = new jsPDF();
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.text('Balanço Cliente', 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente?.company_name || cliente?.proprietario || '-'}`, 14, 30);
    doc.text(`Período: ${format(new Date(periodo.inicio), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim), 'dd/MM/yyyy')}`, 14, 36);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 42);

    let yPos = 55;

    if (tipo === 'mensal' || tipo === 'completo') {
      // Resumo financeiro
      doc.setFontSize(14);
      doc.text('Resumo Financeiro', 14, yPos);
      yPos += 10;

      const pendentes = despesas.filter((d: any) => d.status === 'pendente');
      const pagos = despesas.filter((d: any) => ['pago', 'conciliado'].includes(d.status));
      const aguardando = despesas.filter((d: any) => d.status === 'aguardando_reembolso');

      const resumoData = [
        ['Status', 'Quantidade', 'Valor Total'],
        ['Pendente de Envio', pendentes.length.toString(), `R$ ${pendentes.reduce((s: number, d: any) => s + (d.amount || 0), 0).toFixed(2)}`],
        ['Pago', pagos.length.toString(), `R$ ${pagos.reduce((s: number, d: any) => s + (d.amount || 0), 0).toFixed(2)}`],
        ['Aguardando Reembolso', aguardando.length.toString(), `R$ ${aguardando.reduce((s: number, d: any) => s + (d.amount || 0), 0).toFixed(2)}`],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [resumoData[0]],
        body: resumoData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (tipo === 'despesas' || tipo === 'completo') {
      // Lista de despesas
      doc.setFontSize(14);
      doc.text('Despesas Detalhadas', 14, yPos);
      yPos += 10;

      const despesasData = despesas.slice(0, 50).map((d: any) => [
        format(new Date(d.date), 'dd/MM/yy'),
        d.categorias_movimentacao?.nome || '-',
        (d.description || '-').substring(0, 30),
        `R$ ${(d.amount || 0).toFixed(2)}`,
        d.status
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']],
        body: despesasData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });
    }

    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  };

  // Gerar prévia do PDF
  const visualizarPDF = async (tipo: string) => {
    try {
      setGerando(tipo);
      const doc = gerarPDFDocumento(tipo);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      setPreview({
        tipo,
        pdfBlob,
        pdfUrl
      });
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast.error('Erro ao gerar prévia do PDF');
    } finally {
      setGerando(null);
    }
  };

  // Fazer download do PDF
  const fazerDownloadPDF = (tipo: string, pdfBlob: Blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = `balanco_cliente_${tipo}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    link.click();
    toast.success('Relatório baixado com sucesso!');
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  // Fechar preview
  const fecharPreview = () => {
    if (preview.pdfUrl) {
      URL.revokeObjectURL(preview.pdfUrl);
    }
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  const relatorios = [
    {
      id: 'mensal',
      titulo: 'Relatório Mensal Completo',
      descricao: 'Resumo financeiro do período selecionado',
      icone: Calendar,
    },
    {
      id: 'despesas',
      titulo: 'Relatório de Despesas',
      descricao: 'Lista detalhada de todas as despesas',
      icone: FileText,
    },
    {
      id: 'pendencias',
      titulo: 'Relatório de Pendências',
      descricao: 'Valores pendentes de envio e reembolso',
      icone: TrendingUp,
    },
    {
      id: 'completo',
      titulo: 'Relatório Completo',
      descricao: 'Todas as informações consolidadas',
      icone: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Opções de Exportação */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Opções de Exportação</CardTitle>
          <CardDescription>Configure as opções do relatório</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="graficos" 
              checked={incluirGraficos}
              onCheckedChange={(checked) => setIncluirGraficos(checked as boolean)}
            />
            <Label htmlFor="graficos">Incluir gráficos no PDF</Label>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Relatórios */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {relatorios.map((rel) => {
          const Icone = rel.icone;
          return (
            <Card key={rel.id} className="border-border/50 bg-card/60 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{rel.titulo}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{rel.descricao}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => visualizarPDF(rel.id)}
                    disabled={gerando !== null}
                    size="sm"
                    variant="outline"
                  >
                    {gerando === rel.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Prévia do PDF */}
      <Dialog open={!!preview.pdfUrl} onOpenChange={fecharPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia do Relatório</DialogTitle>
            <DialogDescription>
              Verifique a prévia do PDF antes de fazer download
            </DialogDescription>
          </DialogHeader>

          {preview.pdfUrl && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-border">
              <iframe
                src={preview.pdfUrl}
                title="PDF Preview"
                className="w-full h-[500px] border-none"
                style={{
                  minHeight: '500px'
                }}
              />
            </div>
          )}

          <DialogFooter className="gap-2 flex justify-end">
            <Button
              variant="outline"
              onClick={fecharPreview}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (preview.pdfBlob && preview.tipo) {
                  fazerDownloadPDF(preview.tipo, preview.pdfBlob);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download do PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Sobre os Relatórios</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Visualizar" para ver uma prévia do relatório em PDF. 
                Após confirmar, clique em "Download" para fazer download do arquivo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
