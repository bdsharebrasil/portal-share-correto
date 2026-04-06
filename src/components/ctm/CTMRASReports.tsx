import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRASReports } from "@/hooks/useCTMData";
import { toast } from "sonner";
import { RASDocumentEditor } from "./RASDocumentEditor";
import {
  FileText,
  Plus,
  Download,
  ChevronRight,
  Loader2,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

interface RASReportsProps {
  aircraftId: string;
  aircraftRegistration: string;
}

export function CTMRASReports({ aircraftId, aircraftRegistration }: RASReportsProps) {
  const { data: reports = [], isLoading, refetch } = useRASReports(aircraftId);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showNewRASEditor, setShowNewRASEditor] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showNewRASEditor) {
    return (
      <RASDocumentEditor
        aircraftId={aircraftId}
        aircraftRegistration={aircraftRegistration}
        onBack={() => {
          setShowNewRASEditor(false);
          refetch();
        }}
      />
    );
  }

  if (selectedReport) {
    return (
      <RASReportView
        report={selectedReport}
        aircraftRegistration={aircraftRegistration}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  const handleRASCreated = () => {
    setShowNewRASEditor(false);
    refetch();
  };

  return (
    <>
      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatórios de Acompanhamento de Serviço (RAS)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Documentação técnica de manutenções corretivas emergenciais
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowNewRASEditor(true)}>
            <Plus className="h-4 w-4" />
            Novo RAS
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-1">Nenhum relatório cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie um novo RAS para documentar manutenções corretivas
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowNewRASEditor(true)}>
                <Plus className="h-4 w-4" />
                Criar Primeiro RAS
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report: any) => (
                <Card
                  key={report.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedReport(report)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{report.number || 'RAS'}</h4>
                        <p className="text-sm text-muted-foreground">{report.maintenance_type}</p>
                      </div>
                      <Badge variant={report.situacao === 'completed' ? 'default' : 'secondary'}>
                        {report.situacao === 'completed' ? 'Concluído' : 'Registrado'}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{report.maintenance_center}</p>
                      <p className="text-muted-foreground">
                        {report.entry_date && format(new Date(report.entry_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex items-center justify-end mt-3 text-primary text-sm">
                      <Eye className="h-4 w-4 mr-1" />
                      Ver documento
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// RAS Report View Component with PDF Export
interface RASReportViewProps {
  report: any;
  aircraftRegistration: string;
  onBack: () => void;
}

function RASReportView({ report, aircraftRegistration, onBack }: RASReportViewProps) {
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    try {
      setExporting(true);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Header - Logo placeholder
      pdf.setFillColor(0, 82, 147);
      pdf.rect(margin, yPos, 40, 15, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SHARE', margin + 5, yPos + 7);
      pdf.setFontSize(8);
      pdf.text('Brasil', margin + 5, yPos + 12);

      yPos += 25;

      // Title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      const title = 'RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS';
      pdf.text(title, pageWidth / 2, yPos, { align: 'center' });

      yPos += 15;

      // Header info box
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 30);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO – R.A.S', pageWidth / 2, yPos + 7, { align: 'center' });

      yPos += 12;
      pdf.setFontSize(9);
      const leftCol = margin + 5;
      const rightCol = pageWidth / 2 + 5;

      pdf.text(`Aeronave: ${aircraftRegistration}`, leftCol, yPos);
      pdf.text(`Centro de Manutenção: ${report.maintenance_center || '-'}`, rightCol, yPos);
      yPos += 6;
      pdf.text(`Matrícula: ${aircraftRegistration}`, leftCol, yPos);
      pdf.text(`Tipo de Manutenção: ${report.maintenance_type || '-'}`, rightCol, yPos);
      yPos += 6;
      const dateStr = report.entry_date ? format(new Date(report.entry_date), 'dd/MM/yyyy', { locale: ptBR }) : '-';
      pdf.text(`Período Manutenção: ${dateStr}`, leftCol, yPos);
      pdf.text(`Resp. pelo acompanhamento: ${report.responsible || '-'}`, rightCol, yPos);

      yPos += 15;

      // Inspection section header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIÇÃO DAS INSPEÇÕES REALIZADAS', pageWidth / 2, yPos + 5.5, { align: 'center' });

      yPos += 15;

      // Inspection title
      if (report.objective) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${report.objective.toUpperCase()}`, margin, yPos);
        yPos += 10;
      }

      // Description
      if (report.descricao) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');

        // Draw description box
        const descLines = pdf.splitTextToSize(report.descricao, pageWidth - margin * 2 - 10);
        const descHeight = descLines.length * 5 + 10;

        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos, pageWidth - margin * 2, descHeight, 'F');
        pdf.setDrawColor(150, 150, 150);
        pdf.rect(margin, yPos, pageWidth - margin * 2, descHeight);

        pdf.text(descLines, margin + 5, yPos + 7);
        yPos += descHeight + 10;
      }

      // Footer
      const footerY = pdf.internal.pageSize.getHeight() - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin, footerY);
      pdf.text(`Página 1 de 1`, pageWidth - margin, footerY, { align: 'right' });

      // Save
      pdf.save(`RAS_${report.number || 'documento'}_${aircraftRegistration}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Voltar
        </Button>
        <Button onClick={handleExportPDF} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* Document Preview */}
      <Card className="bg-white border-2" ref={reportRef}>
        <CardContent className="p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-primary text-primary-foreground px-4 py-2 rounded">
                <span className="font-bold text-lg">SHARE</span>
                <span className="text-sm block">Brasil</span>
              </div>
            </div>

            <h1 className="text-center text-lg font-bold text-foreground mb-4">
              RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS
            </h1>

            {/* Info Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted text-center py-2 font-semibold text-sm border-b">
                RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO – R.A.S
              </div>
              <div className="grid grid-cols-2 divide-x text-sm">
                <div className="p-3 space-y-2">
                  <p><span className="font-semibold text-primary">Aeronave:</span> {aircraftRegistration}</p>
                  <p><span className="font-semibold text-primary">Matrícula:</span> {aircraftRegistration}</p>
                  <p><span className="font-semibold text-primary">Período Manutenção:</span> {report.entry_date ? format(new Date(report.entry_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                </div>
                <div className="p-3 space-y-2">
                  <p><span className="font-semibold text-primary">Centro de Manutenção:</span> {report.maintenance_center || '-'}</p>
                  <p><span className="font-semibold text-primary">Tipo de Manutenção:</span> {report.maintenance_type || '-'}</p>
                  <p><span className="font-semibold text-primary">Resp. pelo acompanhamento:</span> {report.responsible || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            <div className="bg-muted/50 text-center py-2 rounded font-semibold text-sm">
              DESCRIÇÃO DAS INSPEÇÕES REALIZADAS
            </div>

            {report.objective && (
              <div>
                <h3 className="font-bold text-foreground mb-2">• {report.objective.toUpperCase()}</h3>
              </div>
            )}

            {report.descricao && (
              <div className="bg-muted/30 p-4 rounded-lg border">
                <p className="text-sm whitespace-pre-wrap">{report.descricao}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground flex justify-between">
            <span>Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            <span>RAS: {report.number || '-'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
