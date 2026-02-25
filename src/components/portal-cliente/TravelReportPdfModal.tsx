import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, X } from "lucide-react";
import { downloadPDF } from "@/lib/travelReportPDF";
import { calculateReportTotals } from "@/lib/travelReportUtils";

interface TravelReportPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportNumber: string;
  pdfUrl?: string;
}
export interface ClientPartner {
  client_id: string;
  cpf: string;
  created_at: string;
  id: string;
          name: string
          share_percentage: number | null
          updated_at: string
          }

export function TravelReportPdfModal({
  open,
  onOpenChange,
  reportId,
  reportNumber,
  pdfUrl,
}: TravelReportPdfModalProps) {
  const [loading, setLoading] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && reportId) {
      if (pdfUrl) {
        setPdfDataUrl(pdfUrl);
      } else {
        generatePdfDataUrl();
      }
    }
  }, [open, reportId, pdfUrl]);

  const generatePdfDataUrl = async () => {
    try {
      setLoading(true);
      setPdfDataUrl(null);

      const { data: fullReport } = await supabase
        .from("travel_expense_reports")
        .select(`
          *,
          client_id_rel:client_id(company_name),
          partner_id_rel:client_partner(name)
        `)
        .eq("id", reportId)
        .single();

      if (!fullReport) {
        toast.error("Relatório não encontrado");
        return;
      }

      const expenses = (() => {
        try {
          if (typeof fullReport.expenses === "string") {
            return JSON.parse(fullReport.expenses);
          }
          return fullReport.expenses || [];
        } catch {
          return [];
        }
      })();

      const correctedTotals = calculateReportTotals(expenses);

      // Determinar o nome do cliente: se tem client_partner, usar nome do partner; senão usar nome do cliente
      const clienteName = fullReport.client_partner && (fullReport as any).partner_id_rel?.name 
        ? (fullReport as any).partner_id_rel.name 
        : (fullReport as any).client_id_rel?.name || '-';

      const pdfReport = {
        numero: fullReport.report_number,
        cliente_nome: clienteName,
        aeronave: fullReport.aircraft_registration,
        tripulante: fullReport.crew_member_name,
        tripulante2: fullReport.crew_member_name_2,
        trecho: fullReport.route,
        destino: fullReport.route,
        data_inicio: fullReport.start_date,
        data_fim: fullReport.end_date,
        observacoes: fullReport.observations,
        despesas: (expenses || []).map((e: any) => ({
          categoria: e.category,
          descricao: e.description,
          valor: e.amount,
          pago_por: e.paid_by,
          data: e.expense_date || '',
          comprovante_url: e.receipt_url,
        })),
        total_combustivel: correctedTotals.total_fuel,
        total_hospedagem: correctedTotals.total_lodging,
        total_alimentacao: correctedTotals.total_food,
        total_transporte: correctedTotals.total_transport,
        total_outros: correctedTotals.total_other,
        total_tripulante: correctedTotals.total_crew,
        total_tripulante1: correctedTotals.total_crew1,
        total_tripulante2: correctedTotals.total_crew2,
        total_cliente: correctedTotals.total_client,
        total_sharebrasil: correctedTotals.total_sharebrasil,
        valor_total: correctedTotals.total_amount,
      };

      // Import jsPDF to generate PDF as blob
      const jspdfModule = await import("jspdf");
      const JsPdfClass = jspdfModule.default;
      const doc = new JsPdfClass("p", "mm", "a4");

      // Set up colors and styles
      const primaryColor: [number, number, number] = [26, 188, 156]; // teal
      const textColor: [number, number, number] = [50, 50, 50];
      const lightGray: [number, number, number] = [240, 240, 240];

      // Title
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("RELATÓRIO DE VIAGEM", 105, 20, { align: "center" });

      // Report number
      doc.setFontSize(10);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(`Nº ${pdfReport.numero}`, 105, 28, { align: "center" });

      // Header info
      let yPos = 38;
      doc.setFontSize(9);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const headerInfo = [
        { label: "Cliente:", value: pdfReport.cliente_nome || "-" },
        { label: "Aeronave:", value: pdfReport.aeronave || "-" },
        { label: "Período:", value: `${pdfReport.data_inicio} a ${pdfReport.data_fim}` },
      ];

      headerInfo.forEach((item) => {
        doc.text(item.label, 15, yPos);
        doc.text(item.value, 60, yPos);
        yPos += 6;
      });

      // Separator
      yPos += 4;
      doc.setDrawColor(26, 188, 156);
      doc.line(15, yPos, 195, yPos);
      yPos += 8;

      // Expenses
      if (pdfReport.despesas && pdfReport.despesas.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("DESPESAS", 15, yPos);
        yPos += 8;

        doc.setFontSize(8);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);

        // Table header
        const col1 = 15;
        const col2 = 70;
        const col3 = 140;
        const col4 = 175;

        doc.rect(col1 - 2, yPos - 5, 185, 6, "F");
        doc.text("Categoria", col1, yPos);
        doc.text("Descrição", col2, yPos);
        doc.text("Pago Por", col3, yPos);
        doc.text("Valor", col4, yPos, { align: "right" });

        yPos += 7;

        pdfReport.despesas.forEach((expense: any) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 15;
          }

          doc.text(expense.categoria || "-", col1, yPos);
          doc.text(expense.descricao?.substring(0, 30) || "-", col2, yPos);
          doc.text(expense.pago_por || "-", col3, yPos);
          doc.text(`R$ ${parseFloat(expense.valor || 0).toFixed(2)}`, col4, yPos, { align: "right" });
          yPos += 6;
        });
      }

      // Summary
      yPos += 8;
      doc.setDrawColor(26, 188, 156);
      doc.line(15, yPos, 195, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      const summaryInfo = [
        { label: "Total Combustível:", value: `R$ ${pdfReport.total_combustivel?.toFixed(2) || "0.00"}` },
        { label: "Total Hospedagem:", value: `R$ ${pdfReport.total_hospedagem?.toFixed(2) || "0.00"}` },
        { label: "Total Alimentação:", value: `R$ ${pdfReport.total_alimentacao?.toFixed(2) || "0.00"}` },
        { label: "Total Transporte:", value: `R$ ${pdfReport.total_transporte?.toFixed(2) || "0.00"}` },
        { label: "Total Outros:", value: `R$ ${pdfReport.total_outros?.toFixed(2) || "0.00"}` },
      ];

      summaryInfo.forEach((item) => {
        doc.text(item.label, 15, yPos);
        doc.text(item.value, 195, yPos, { align: "right" });
        yPos += 6;
      });

      yPos += 4;
      doc.setDrawColor(26, 188, 156);
      doc.line(15, yPos, 195, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("TOTAL GERAL", 15, yPos);
      doc.text(`R$ ${pdfReport.valor_total?.toFixed(2) || "0.00"}`, 195, yPos, { align: "right" });

      // Convert to blob and create data URL
      const pdfBlob = doc.output("blob");
      const dataUrl = URL.createObjectURL(pdfBlob);
      setPdfDataUrl(dataUrl);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (pdfUrl) {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${reportNumber.replace(/\//g, '-')}-relatorio-viagem.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("PDF baixado com sucesso!");
      } else {
        const { data: fullReport } = await supabase
          .from("travel_expense_reports")
          .select(`
            *,
            client_id_rel:client_id(company_name),
            partner_id_rel:client_partner(name)
          `)
          .eq("id", reportId)
          .single();

        if (!fullReport) {
          toast.error("Relatório não encontrado");
          return;
        }

        const expenses = (() => {
          try {
            if (typeof fullReport.expenses === "string") {
              return JSON.parse(fullReport.expenses);
            }
            return fullReport.expenses || [];
          } catch {
            return [];
          }
        })();

        const correctedTotals = calculateReportTotals(expenses);

        // Determinar o nome do cliente: se tem client_partner, usar nome do partner; senão usar nome do cliente
        const clienteName = fullReport.client_partner && (fullReport as any).partner_id_rel?.name 
          ? (fullReport as any).partner_id_rel.name 
          : (fullReport as any).client_id_rel?.name || '-';

        const pdfReport = {
          numero: fullReport.report_number,
          cliente_nome: clienteName,
          aeronave: fullReport.aircraft_registration,
          tripulante: fullReport.crew_member_name,
          tripulante2: fullReport.crew_member_name_2,
          trecho: fullReport.route,
          destino: fullReport.route,
          data_inicio: fullReport.start_date,
          data_fim: fullReport.end_date,
          observacoes: fullReport.observations,
          despesas: (expenses || []).map((e: any) => ({
            categoria: e.category,
            descricao: e.description,
            valor: e.amount,
            pago_por: e.paid_by,
            data: e.expense_date || '',
            comprovante_url: e.receipt_url,
          })),
          total_combustivel: correctedTotals.total_fuel,
          total_hospedagem: correctedTotals.total_lodging,
          total_alimentacao: correctedTotals.total_food,
          total_transporte: correctedTotals.total_transport,
          total_outros: correctedTotals.total_other,
          total_tripulante: correctedTotals.total_crew,
          total_tripulante1: correctedTotals.total_crew1,
          total_tripulante2: correctedTotals.total_crew2,
          total_cliente: correctedTotals.total_client,
          total_sharebrasil: correctedTotals.total_sharebrasil,
          valor_total: correctedTotals.total_amount,
        };

        await downloadPDF(pdfReport as any);
        toast.success("PDF baixado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("Erro ao fazer download do PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-0">
        <div className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 border-b">
          <div className="flex-1">
            <DialogTitle>Relatório de Viagem - {reportNumber}</DialogTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Baixar</span>
          </Button>
        </div>
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Gerando PDF...</p>
              </div>
            </div>
          ) : pdfDataUrl ? (
            <iframe
              src={pdfDataUrl}
              className="w-full h-full border-0 rounded-lg"
              title={`Relatório de Viagem ${reportNumber}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Erro ao gerar PDF</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}