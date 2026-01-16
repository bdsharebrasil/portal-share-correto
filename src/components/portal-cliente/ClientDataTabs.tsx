import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Fuel, Wrench, Plane, Download, Upload, FileCheck, Eye, Send } from "lucide-react";
import { previewPDFForPrint, TravelReport as TravelReportPDF, TravelExpense } from "@/lib/travelReportPDF";
import { FileUploadDialog } from "./FileUploadDialog";
import { ContractUploadDialog } from "./ContractUploadDialog";
import { FinancialHistoryTab } from "./FinancialHistoryTab";
import { EnvioDespesaTab } from "./EnvioDespesaTab";
import { toast } from "sonner";

export interface ClientDataTabsProps {
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
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


export function ClientDataTabs({ clientId, clientName, aircraftId, aircraftRegistration, isAdmin = false }: ClientDataTabsProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [contractUploadDialogOpen, setContractUploadDialogOpen] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [ctmTracking, setCtmTracking] = useState<any[]>([]);
  const [travelReports, setTravelReports] = useState<TravelReport[]>([]);
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

      setFiles(filesData || []);
      setContracts(contractsData || []);
      setLogbookEntries(logbookData || []);
      setFuelRecords(fuelData || []);
      setCtmTracking(ctmData || []);
      setTravelReports(reportsData || []);
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



  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <>
      <Tabs defaultValue="financial-history" className="w-full">
        <TabsList className="flex w-full gap-2 bg-gradient-card border-b border-border overflow-x-auto px-4 py-3 h-auto rounded-none flex-wrap md:flex-nowrap">
          <TabsTrigger value="financial-history">Histórico Financeiro</TabsTrigger>
          <TabsTrigger value="envio-despesa">
            <Send className="h-4 w-4 mr-1" />
            Envio de Despesa
          </TabsTrigger>
          <TabsTrigger value="contracts">Contrato Share</TabsTrigger>
          <TabsTrigger value="logbook">Diário de Bordo</TabsTrigger>
          <TabsTrigger value="fuel">Abastecimento</TabsTrigger>
          <TabsTrigger value="ctm">CTM</TabsTrigger>
          <TabsTrigger value="travel-reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="financial-history" className="space-y-4">
          <FinancialHistoryTab clientId={clientId} aircraftId={aircraftId} />
        </TabsContent>

        <TabsContent value="envio-despesa" className="space-y-4">
          <EnvioDespesaTab 
            clientId={clientId} 
            clientName={clientName} 
            aircraftId={aircraftId} 
            aircraftRegistration={aircraftRegistration} 
          />
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Data</p>
                        <p className="font-medium text-foreground">
                          {(() => {
                            // Handle both ISO timestamps and date-only strings
                            let dateStr = record.data;
                            if (typeof dateStr === 'string') {
                              // If it's a date-only string (YYYY-MM-DD), parse it directly
                              if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                const [year, month, day] = dateStr.split('-').map(Number);
                                return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
                              }
                              // If it's an ISO timestamp, extract the date part
                              const datePart = dateStr.split('T')[0];
                              const [year, month, day] = datePart.split('-').map(Number);
                              return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
                            }
                            return new Date(record.data).toLocaleDateString('pt-BR');
                          })()}
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
                      <div>
                        <p className="text-sm text-muted-foreground">Status Pagamento</p>
                        {record.status_pagamento === "pago" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                            Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                            Em Aberto
                          </span>
                        )}
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

    </>
  );
}
