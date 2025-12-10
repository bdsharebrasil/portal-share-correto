import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Fuel, Wrench, Plane, Download, Upload, FileCheck, Plus, Eye } from "lucide-react";
import { previewPDFForPrint, TravelReport as TravelReportPDF, TravelExpense } from "@/lib/travelReportPDF";
import { FileUploadDialog } from "./FileUploadDialog";
import { ContractUploadDialog } from "./ContractUploadDialog";
import { FlightDocumentUploadDialog } from "./FlightDocumentUploadDialog";
import { toast } from "sonner";

interface ClientDataTabsProps {
  clientId: string;
  aircraftId: string;
  isAdmin?: boolean;
}

interface TravelReport {
  id: string;
  report_number: string;
  created_at: string;
  observations?: string;
  total_amount?: number;
  payment_term?: string;
  status?: string;
  client_name?: string;
  aircraft_registration?: string;
  crew_member_name?: string;
  crew_member_name_2?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  expenses?: any;
  total_fuel?: number;
  total_lodging?: number;
  total_food?: number;
  total_transport?: number;
  total_other?: number;
  total_crew?: number;
  total_crew1?: number;
  total_crew2?: number;
  total_client?: number;
  total_sharebrasil?: number;
}

interface Receipt {
  id: string;
  receipt_number: string;
  issue_date: string;
  amount: number;
  receipt_type?: string;
  service_description: string;
  payment_term?: string;
  status?: string;
}

interface BankReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  client_id: string | null;
  aircraft_id: string | null;
  payment_term: string | null;
  type: string;
}

export function ClientDataTabs({ clientId, aircraftId, isAdmin = false }: ClientDataTabsProps) {
  const { roles } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [contractUploadDialogOpen, setContractUploadDialogOpen] = useState(false);
  const [flightDocumentUploadDialogOpen, setFlightDocumentUploadDialogOpen] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [flightDocuments, setFlightDocuments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [ctmTracking, setCtmTracking] = useState<any[]>([]);
  const [travelReports, setTravelReports] = useState<TravelReport[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregador de dados principal
  useEffect(() => {
    loadData();
  }, [clientId, aircraftId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load files (for bank reconciliation - Notas Fiscais e Boletos)
      const { data: filesData } = await supabase
        .from('client_portal_files')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      // Load flight documents - removed client_id filter as this table doesn't have that column
      const { data: flightDocsData } = await supabase
        .from('flight_documents')
        .select('*')
        .order('created_at', { ascending: false });

      // Load contracts
      const { data: contractsData } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      // Load logbook entries
      const { data: logbookData } = await supabase
        .from('logbook_entries')
        .select('*, aircraft:aircraft_id(registration)')
        .eq('aircraft_id', aircraftId)
        .eq('client_id', clientId)
        .order('entry_date', { ascending: false })
        .limit(10);

      // Load fuel records
      const { data: fuelData } = await supabase
        .from('abastecimentos')
        .select('*, aeronave:aeronave_id(registration)')
        .eq('aeronave_id', aircraftId)
        .eq('client_id', clientId)
        .order('data', { ascending: false })
        .limit(10);

      // Load CTM tracking
      const { data: ctmData } = await supabase
        .from('ctm_tracking')
        .select('*, aircraft:aircraft_id(registration)')
        .eq('aircraft_id', aircraftId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      // Load travel reports for specific aircraft
      const { data: reportsData } = await supabase
        .from('travel_expense_reports')
        .select('*')
        .eq('client_id', clientId)
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Load bank reconciliations for syncing payment term and status
      const { data: bankReconciliations } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false });

      // Load receipts for specific aircraft
      const { data: receiptsData } = await supabase
        .from('receipts')
        .select('*')
        .eq('client_id', clientId)
        .order('issue_date', { ascending: false })
        .limit(10);

      setFiles(filesData || []);
      setFlightDocuments(flightDocsData || []);
      setContracts(contractsData || []);
      setLogbookEntries(logbookData || []);
      setFuelRecords(fuelData || []);
      setCtmTracking(ctmData || []);
      setBankReconciliations(bankReconciliations || []);

      // Sync bank reconciliation data with travel reports
      const enrichedReports = (reportsData || []).map((report) => {
        // Find the related reconciliation by report_number in the description
        // The reconciliation description follows the pattern: "RELATORIO DE VIAGEM - {report_number} - STATUS PENDENTE"
        const relatedReconciliation = bankReconciliations?.find(
          (rec) => {
            const hasMatchingClient = rec.client_id === clientId;
            const hasMatchingAircraft = rec.aircraft_id === aircraftId;
            const hasMatchingDescription = rec.description?.includes(`RELATORIO DE VIAGEM - ${report.report_number}`);
            const isClientType = rec.type === 'cliente';

            return hasMatchingClient && hasMatchingAircraft && hasMatchingDescription && isClientType;
          }
        );

        return {
          ...report,
          payment_term: report.payment_term || relatedReconciliation?.payment_term,
          status: report.status || (relatedReconciliation?.status === 'conferido' ? 'pago' : relatedReconciliation?.status === 'enviado' ? 'enviado' : 'pendente')
        };
      });

      setTravelReports(enrichedReports);
      setReceipts(receiptsData || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      // Não mostrar toast de erro para não assustar o usuário
      // O polling vai tentar novamente em 10 segundos
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string, bucket: string = 'client-documents') => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const deleteFlightDocument = async (docId: string, filePath: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('flight-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('flight_documents')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      setFlightDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Documento removido com sucesso');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erro ao remover documento');
    }
  };

  const deleteContract = async (contractId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('client_contracts')
        .delete()
        .eq('id', contractId);

      if (dbError) throw dbError;

      setContracts(prev => prev.filter(c => c.id !== contractId));
      toast.success('Contrato removido com sucesso');
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Erro ao remover contrato');
    }
  };

  const canUpdateToFinal = roles.some(role =>
    ['admin', 'gestor_master', 'financeiro_master'].includes(role)
  );

  const handleUpdateStatus = async () => {
    if (!selectedReconciliation || !newStatus) {
      toast.error('Selecione um status válido');
      return;
    }

    // Verificar permissão para atualizar para status "pago" ou "recebido"
    const isFinalStatus = newStatus.toLowerCase() === 'recebido' || newStatus.toLowerCase() === 'conferido';
    if (isFinalStatus && !canUpdateToFinal) {
      toast.error('Você não tem permissão para marcar como pago. Entre em contato com o administrador.');
      setOpenStatusDialog(false);
      return;
    }

    try {
      setUpdatingStatus(true);

      // Atualizar status na conciliação
      const { error } = await supabase
        .from('bank_reconciliations')
        .update({ status: newStatus } as any)
        .eq('id', selectedReconciliation.id);

      if (error) throw error;

      // Sincronizar com relatório de viagem se aplicável
      if (selectedReconciliation.description?.includes('RELATORIO DE VIAGEM')) {
        const reportNumberMatch = selectedReconciliation.description.match(/RELATORIO DE VIAGEM - (.+?) - /);
        if (reportNumberMatch && reportNumberMatch[1]) {
          const reportNumber = reportNumberMatch[1];

          const { data: relatedReport } = await supabase
            .from('travel_expense_reports')
            .select('id')
            .eq('report_number', reportNumber as any)
            .eq('client_id', clientId)
            .maybeSingle();

          if (relatedReport) {
            let reportStatus = 'pendente';
            if (newStatus.toLowerCase() === 'recebido' || newStatus.toLowerCase() === 'conferido') {
              reportStatus = 'pago';
            } else if (newStatus.toLowerCase() === 'enviado') {
              reportStatus = 'enviado';
            }

            await supabase
              .from('travel_expense_reports')
              .update({ status: reportStatus } as any)
              .eq('id', (relatedReport as any).id as any);
          }
        }
      }

      // Atualizar state local
      setBankReconciliations(prev =>
        prev.map(item =>
          item.id === selectedReconciliation.id
            ? { ...item, status: newStatus }
            : item
        )
      );

      toast.success(`Status atualizado para ${newStatus} com sucesso!`);
      setOpenStatusDialog(false);
      setSelectedReconciliation(null);
      setNewStatus("");
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error(error.message || 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  };


  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="flex w-full gap-2 bg-gradient-card border-b border-border overflow-x-auto px-4 py-3 h-auto rounded-none flex-wrap md:flex-nowrap">
          <TabsTrigger value="files">Documentos da Aeronave</TabsTrigger>
          <TabsTrigger value="contracts">Contrato Share</TabsTrigger>
          <TabsTrigger value="logbook">Diário de Bordo</TabsTrigger>
          <TabsTrigger value="fuel">Abastecimento</TabsTrigger>
          <TabsTrigger value="ctm">CTM</TabsTrigger>
          <TabsTrigger value="travel-reports">Relatórios</TabsTrigger>
          <TabsTrigger value="bank-reconciliation">Conciliação</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Documentos da Aeronave</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">
                    Certificados, registros e documentação da aeronave
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setFlightDocumentUploadDialogOpen(true)}
                  size="sm"
                  variant="default"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Documento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {flightDocuments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum documento disponível</p>
              ) : (
                flightDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{doc.file_name}</p>
                        <p className="text-sm text-muted-foreground">{doc.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tipo: {doc.document_type === 'outro' ? 'Outro' : doc.document_type?.replace(/_/g, ' ') || 'Sem tipo'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(doc.file_path, 'flight-documents')}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteFlightDocument(doc.id, doc.file_path)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <FileCheck className="h-5 w-5 text-primary" />
                    Contrato Share
                  </CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">
                    Contratos de compartilhamento de aeronave
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={() => setContractUploadDialogOpen(true)} size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Contrato
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum contrato disponível</p>
              ) : (
                contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{contract.file_name}</p>
                        <p className="text-sm text-muted-foreground">{contract.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em: {new Date(contract.uploaded_at).toLocaleDateString('pt-BR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(contract.file_path)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteContract(contract.id, contract.file_path)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logbook" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Plane className="h-5 w-5 text-primary" />
                Diário de Bordo
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Últimos voos registrados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {logbookEntries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum voo registrado</p>
              ) : (
                logbookEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Data</p>
                        <p className="font-medium text-foreground">
                          {new Date(entry.entry_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Origem → Destino</p>
                        <p className="font-medium text-foreground">
                          {entry.departure_aerodrome} → {entry.arrival_aerodrome}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Horas</p>
                        <p className="font-medium text-foreground">{entry.total_time}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pousos</p>
                        <p className="font-medium text-foreground">{entry.pousos}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Fuel className="h-5 w-5 text-primary" />
                Controle de Abastecimento
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Histórico de abastecimentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fuelRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum abastecimento registrado</p>
              ) : (
                fuelRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Data</p>
                        <p className="font-medium text-foreground">
                          {new Date(record.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Local</p>
                        <p className="font-medium text-foreground">{record.local}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Litros</p>
                        <p className="font-medium text-foreground">{record.litros}L</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor Total</p>
                        <p className="font-medium text-green-400">
                          R$ {parseFloat(record.valor_total).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ctm" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Wrench className="h-5 w-5 text-primary" />
                Gestão de CTM
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Controle de manutenção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ctmTracking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum item de CTM registrado</p>
              ) : (
                ctmTracking.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">Tipo: {item.control_type}</p>
                      </div>
                      <Badge variant="outline" className="bg-primary/20 text-primary">
                        {item.remaining_hours}h restantes
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="travel-reports" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                Relatórios de Viagem
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Relatórios emitidos com status e prazo de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {travelReports.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum relatório disponível</p>
              ) : (
                travelReports.map((report) => {
                  // Preparar dados para o PDF
                  const handleViewPDF = async () => {
                    try {
                      // Parse expenses
                      let expenses: TravelExpense[] = [];
                      if (report.expenses) {
                        try {
                          const parsed = typeof report.expenses === 'string'
                            ? JSON.parse(report.expenses)
                            : report.expenses;
                          expenses = parsed.map((e: any) => ({
                            categoria: e.category || e.categoria || 'Outros',
                            descricao: e.description || e.descricao || '',
                            valor: Number(e.amount || e.valor) || 0,
                            pago_por: e.paid_by || e.pago_por || 'Cliente',
                            comprovante_url: e.receipt_url || e.comprovante_url
                          }));
                        } catch (err) {
                          console.error('Erro ao parsear despesas:', err);
                        }
                      }

                      const pdfReport: TravelReportPDF = {
                        numero: report.report_number,
                        cliente_nome: report.client_name || 'Cliente',
                        aeronave: report.aircraft_registration || 'N/A',
                        tripulante: report.crew_member_name || 'N/A',
                        tripulante2: report.crew_member_name_2,
                        destino: report.destination || 'N/A',
                        data_inicio: report.start_date || report.created_at,
                        data_fim: report.end_date || report.created_at,
                        observacoes: report.observations,
                        despesas: expenses,
                        total_combustivel: report.total_fuel || 0,
                        total_hospedagem: report.total_lodging || 0,
                        total_alimentacao: report.total_food || 0,
                        total_transporte: report.total_transport || 0,
                        total_outros: report.total_other || 0,
                        total_tripulante: report.total_crew || 0,
                        total_tripulante1: report.total_crew1,
                        total_tripulante2: report.total_crew2,
                        total_cliente: report.total_client || 0,
                        total_sharebrasil: report.total_sharebrasil || 0,
                        valor_total: report.total_amount || 0
                      };

                      await previewPDFForPrint(pdfReport);
                    } catch (error) {
                      console.error('Erro ao visualizar PDF:', error);
                      toast.error('Erro ao abrir visualização do relatório');
                    }
                  };

                  return (
                    <div
                      key={report.id}
                      className="p-4 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-foreground">{report.report_number}</p>
                              <Badge
                                variant="outline"
                                className={
                                  report.status?.toLowerCase() === 'pago' || report.status?.toLowerCase() === 'conferido'
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-yellow-500/20 text-yellow-300'
                                }
                              >
                                {report.status?.toLowerCase() === 'pago' || report.status?.toLowerCase() === 'conferido' ? 'Conferido' : 'Pendente'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Emitido em: {new Date(report.created_at).toLocaleDateString('pt-BR')}
                            </p>
                            {report.observations && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {report.observations}
                              </p>
                            )}
                            {report.total_amount && (
                              <p className="text-sm font-semibold text-green-400 mt-1">
                                Valor: R$ {parseFloat(report.total_amount as any).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleViewPDF}
                            className="gap-2"
                            title="Visualizar PDF"
                          >
                            <Eye className="h-4 w-4" />
                            Ver PDF
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Prazo de Pagamento</p>
                            <p className="text-sm text-foreground">
                              {report.payment_term ? new Date(report.payment_term).toLocaleDateString('pt-BR') : 'Não definido'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            <Badge
                              className={
                                report.status?.toLowerCase() === 'pago' || report.status?.toLowerCase() === 'recebido'
                                  ? 'bg-green-500/20 text-green-300'
                                  : report.status?.toLowerCase() === 'enviado'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-yellow-500/20 text-yellow-300'
                              }
                            >
                              {report.status?.toLowerCase() === 'pago' || report.status?.toLowerCase() === 'recebido'
                                ? 'Conferido'
                                : report.status?.toLowerCase() === 'enviado'
                                  ? 'Enviado'
                                  : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-reconciliation" className="space-y-6">
          <div className="space-y-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  Conciliação Bancária - Despesas
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Todas as despesas de viagem e outras movimentações para conciliação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankReconciliations && bankReconciliations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma conciliação registrada</p>
                ) : (
                  (bankReconciliations || [])
                    .filter(item => item.client_id === clientId && item.aircraft_id === aircraftId && item.type === 'cliente')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-5 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-foreground text-lg">{item.description}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                📅 {new Date(item.date).toLocaleDateString('pt-BR')}
                              </p>
                              {item.category && (
                                <p className="text-sm text-muted-foreground">
                                  🏷️ {item.category.replace(/_/g, ' ')}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {item.amount && (
                                <p className="text-xl font-bold text-green-400">
                                  R$ {parseFloat(item.amount).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border">
                            <div className="bg-background/50 p-3 rounded">
                              <p className="text-xs text-muted-foreground font-semibold mb-1">STATUS ATUAL</p>
                              <Badge
                                className={
                                  item.status?.toLowerCase() === 'recebido' || item.status?.toLowerCase() === 'conferido'
                                    ? 'bg-green-500/20 text-green-300 w-full justify-center py-2'
                                    : item.status?.toLowerCase() === 'enviado'
                                      ? 'bg-blue-500/20 text-blue-300 w-full justify-center py-2'
                                      : 'bg-yellow-500/20 text-yellow-300 w-full justify-center py-2'
                                }
                              >
                                {item.status?.toLowerCase() === 'recebido' || item.status?.toLowerCase() === 'conferido'
                                  ? '✓ Pago'
                                  : item.status?.toLowerCase() === 'enviado'
                                    ? '↗️ Enviado'
                                    : '⏳ Pendente'}
                              </Badge>
                            </div>

                            <div className="bg-background/50 p-3 rounded">
                              <p className="text-xs text-muted-foreground font-semibold mb-1">VENCIMENTO</p>
                              <p className="text-sm text-foreground font-medium">
                                {item.payment_term
                                  ? new Date(item.payment_term).toLocaleDateString('pt-BR')
                                  : '—'}
                              </p>
                            </div>

                          </div>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  Notas Fiscais e Boletos
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Documentos financeiros anexados às conciliações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {files.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum documento disponível</p>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{file.file_name}</p>
                          <p className="text-sm text-muted-foreground">{file.description}</p>
                          {file.due_date && (
                            <p className="text-sm text-muted-foreground">
                              Vencimento: {new Date(file.due_date).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {file.amount && (
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300">
                            R$ {parseFloat(file.amount).toFixed(2)}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(file.file_path)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  Recibos de Pagamento e Reembolso
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Comprovantes de pagamento e reembolsos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {receipts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum recibo disponível</p>
                ) : (
                  receipts.map((receipt) => {
                    const isPaymentReceipt = receipt.receipt_type === 'pagamento';
                    return (
                      <div
                        key={receipt.id}
                        className="p-4 bg-muted/50 rounded-lg border border-border"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{receipt.receipt_number}</p>
                                <Badge variant="secondary" className={isPaymentReceipt ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"}>
                                  {isPaymentReceipt ? 'Pagamento' : 'Reembolso'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Emitido em: {new Date(receipt.issue_date).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {receipt.service_description}
                              </p>
                              <p className="text-sm font-semibold text-green-400 mt-1">
                                Valor: R$ {receipt.amount.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Prazo de Pagamento</p>
                              {!isPaymentReceipt ? (
                                <p className="text-sm text-foreground">
                                  {receipt.payment_term ? new Date(receipt.payment_term).toLocaleDateString('pt-BR') : 'Não definido'}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">-</p>
                              )}
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <Badge
                                className={
                                  isPaymentReceipt || receipt.status?.toLowerCase() === 'pago'
                                    ? 'bg-green-500/20 text-green-300'
                                    : receipt.status?.toLowerCase() === 'enviado'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-yellow-500/20 text-yellow-300'
                                }
                              >
                                {isPaymentReceipt || receipt.status?.toLowerCase() === 'pago'
                                  ? 'Pago'
                                  : receipt.status?.toLowerCase() === 'enviado'
                                    ? 'Enviado'
                                    : 'Pendente'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        clientId={clientId}
        aircraftId={aircraftId}
        onSuccess={loadData}
      />

      <ContractUploadDialog
        open={contractUploadDialogOpen}
        onOpenChange={setContractUploadDialogOpen}
        clientId={clientId}
        onSuccess={loadData}
      />

      <FlightDocumentUploadDialog
        open={flightDocumentUploadDialogOpen}
        onOpenChange={setFlightDocumentUploadDialogOpen}
        aircraftId={aircraftId}
        clientId={clientId}
        onSuccess={loadData}
      />

      <Dialog open={openStatusDialog} onOpenChange={setOpenStatusDialog}>
        <DialogContent className="w-full max-w-2xl mx-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg sm:text-xl">Atualizar Status da Conciliação</DialogTitle>
          </DialogHeader>
          {selectedReconciliation && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 font-semibold">DESCRIÇÃO</p>
                  <p className="font-medium text-foreground text-sm">{selectedReconciliation.description}</p>
                </div>

                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 font-semibold">VALOR</p>
                  <p className="font-medium text-green-400 text-sm">
                    R$ {parseFloat(selectedReconciliation.amount as any).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Status Atual</Label>
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <Badge
                    className={
                      selectedReconciliation.status?.toLowerCase() === 'recebido' || selectedReconciliation.status?.toLowerCase() === 'conferido'
                        ? 'bg-green-500/20 text-green-300'
                        : selectedReconciliation.status?.toLowerCase() === 'enviado'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                    }
                  >
                    {selectedReconciliation.status?.toLowerCase() === 'recebido' || selectedReconciliation.status?.toLowerCase() === 'conferido'
                      ? '✓ Pago'
                      : selectedReconciliation.status?.toLowerCase() === 'enviado'
                        ? '↗️ Enviado'
                        : '⏳ Pendente'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-select" className="text-sm sm:text-base">Novo Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger id="status-select" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">⏳ Pendente</SelectItem>
                    <SelectItem value="enviado">↗️ Enviado</SelectItem>
                    <SelectItem value="recebido" disabled={!canUpdateToFinal}>
                      {canUpdateToFinal ? '✓ Pago' : '🔒 Pago (Sem permissão)'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!canUpdateToFinal && newStatus === 'recebido' && (
                  <p className="text-xs sm:text-sm text-amber-600 bg-amber-500/10 p-2 rounded border border-amber-500/30">
                    ⚠️ Apenas administradores podem marcar como pago
                  </p>
                )}
              </div>

              {selectedReconciliation.payment_term && (
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 font-semibold">PRAZO DE PAGAMENTO</p>
                  <p className="font-medium text-foreground text-sm">
                    {new Date(selectedReconciliation.payment_term).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}

              {selectedReconciliation.category && (
                <div className="p-3 bg-muted/50 rounded border border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 font-semibold">CATEGORIA</p>
                  <p className="font-medium text-foreground text-sm">
                    {selectedReconciliation.category.replace(/_/g, ' ')}
                  </p>
                </div>
              )}

              {!canUpdateToFinal && (
                <div className="p-3 bg-blue-500/10 rounded border border-blue-500/30">
                  <p className="text-xs sm:text-sm text-blue-600">
                    ℹ️ Você pode atualizar o status para "Pendente" ou "Enviado". Para marcar como "Pago", aguarde confirmação do administrador.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setOpenStatusDialog(false)}
                  disabled={updatingStatus}
                  className="text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus || newStatus === selectedReconciliation.status}
                  className="text-sm"
                >
                  {updatingStatus ? "Atualizando..." : "Atualizar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
