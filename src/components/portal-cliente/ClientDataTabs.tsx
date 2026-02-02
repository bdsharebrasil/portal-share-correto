import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Fuel, Wrench, Plane, Download, Upload, FileCheck, Eye, Send, Trash, CheckCircle2 } from "lucide-react";
import { previewPDFForPrint, TravelReport as TravelReportPDF, TravelExpense } from "@/lib/travelReportPDF";
import { FileUploadDialog } from "./FileUploadDialog";
import { ContractUploadDialog } from "./ContractUploadDialog";
import { FuelPaymentDialog } from "./FuelPaymentDialog";
import { FinancialHistoryTab } from "./FinancialHistoryTab";
import { EnvioDespesaTab } from "./EnvioDespesaTab";
import { toast } from "sonner";

export interface ClientDataTabsProps {
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
  isAdmin?: boolean;
  selectedPartner?: any;
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


export function ClientDataTabs({ clientId, clientName, aircraftId, aircraftRegistration, isAdmin = false, selectedPartner }: ClientDataTabsProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [contractUploadDialogOpen, setContractUploadDialogOpen] = useState(false);
  const [fuelPaymentDialogOpen, setFuelPaymentDialogOpen] = useState(false);
  const [selectedFuelRecord, setSelectedFuelRecord] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [ctmTracking, setCtmTracking] = useState<any[]>([]);
  const [travelReports, setTravelReports] = useState<TravelReport[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<any[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>(clientId);
  const [fornecedoresShare, setFornecedoresShare] = useState<any[]>([]);

  // Carregador de dados principal (carrega dados do cliente ativo)
  useEffect(() => {
    setActiveClientId(clientId);
  }, [clientId]);

  useEffect(() => {
    // Buscar cotistas/partners da aeronave
    const loadPartners = async () => {
      if (!aircraftId) return;
      try {
        const { data } = await supabase
          .from('aircraft_shareholders')
          .select('*, client:client_id(id, company_name)')
          .eq('aircraft_id', aircraftId)
          .order('share_percentage', { ascending: false });

        const partnerList = (data || []).map((p: any) => ({
          client_id: p.client_id,
          company_name: p.client?.company_name || p.client_name || p.partner_name || p.client_id,
          share_percentage: p.share_percentage || 0,
        }));

        // Ensure the primary client is included
        if (!partnerList.find((p: any) => p.client_id === clientId)) {
          partnerList.unshift({ client_id: clientId, company_name: clientName, share_percentage: 100 });
        }

        setPartners(partnerList);
        // default to the provided clientId if present
        setActiveClientId(clientId);
      } catch (error) {
        console.error('Error loading partners:', error);
      }
    };

    loadPartners();
  }, [aircraftId, clientId, clientName]);

  // Load client data when clientId, aircraftId changes
  // selectedPartner can be undefined (waiting for selection), null (consolidado), or an object (specific partner)
  // Load in all cases as long as clientId and aircraftId are present
  useEffect(() => {
    if (clientId && aircraftId) {
      loadData(clientId);
    }
  }, [clientId, aircraftId, selectedPartner]);

  // Buscar fornecedores favoritos categoria 'share'
  useEffect(() => {
    const loadFornecedoresShare = async () => {
      try {
        const { data, error } = await supabase
          .from('fornecedores_favoritos')
          .select('nome_completo')
          .eq('categoria', 'share');
        if (error) throw error;
        setFornecedoresShare(data || []);
      } catch (err) {
        console.error('Erro ao buscar fornecedores favoritos:', err);
      }
    };
    loadFornecedoresShare();
  }, []);

  const loadData = async (forClientId: string) => {
    try {
      setLoading(true);

      // Normalize partner name for filtering (trim spaces) - used for logbook and fuel records
      const normalizedPartnerName = selectedPartner?.name?.trim() || '';

      // Get all client IDs (main client + all partners/cotistas)
      const clientIds = [forClientId];

      // Add partner/cotista IDs if they exist
      if (partners.length > 1) {
        partners.forEach((partner: any) => {
          if (partner.client_id && partner.client_id !== forClientId && !clientIds.includes(partner.client_id)) {
            clientIds.push(partner.client_id);
          }
        });
      }

      // Load files (for bank reconciliation - Notas Fiscais e Boletos)
      let filesData = null;
      try {
        const result = await supabase
          .from('client_portal_files')
          .select('*')
          .eq('client_id', forClientId)
          .order('created_at', { ascending: false });
        filesData = result.data;
        if (result.error) console.warn('Erro ao carregar arquivos:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar arquivos:', err);
      }

      // Load contracts
      let contractsData = null;
      try {
        const result = await supabase
          .from('client_contracts')
          .select('*')
          .eq('client_id', forClientId)
          .order('created_at', { ascending: false });
        contractsData = result.data;
        if (result.error) console.warn('Erro ao carregar contratos:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar contratos:', err);
      }

      // Load logbook entries
      let logbookData = null;
      try {
        console.log('Carregando logbook para cliente:', forClientId, 'Partner selecionado:', selectedPartner?.name);

        const { data: allLogbookData, error } = await supabase
          .from('logbook_entries')
          .select(`
            id,
            entry_date,
            total_time,
            distance_nm,
            fuel_added,
            partner_name,
            departure_aerodrome,
            arrival_aerodrome,
            trecho,
            aircraft:aircraft_id(registration)
          `)
          .eq('aircraft_id', aircraftId)
          .eq('client_id', forClientId)
          .order('entry_date', { ascending: false })
          .limit(100);

        if (error) console.warn('Erro ao carregar logbook:', error);

        // Se um parceiro específico foi selecionado, filtrar pelo partner_name
        // Logbook entries podem ter partner_name em diferentes formatos:
        // - Com espaço no início: " GUAVIRA"
        // - Sem espaço: "GUAVIRA"
        // - Possivelmente com colchetes: "[GUAVIRA]" (menos comum)
        if (selectedPartner && normalizedPartnerName && allLogbookData) {
          logbookData = allLogbookData.filter((entry: any) => {
            if (!entry.partner_name) return false;
            // Normaliza o partner_name removendo espaços e colchetes para comparação
            const entryPartnerName = entry.partner_name
              .replace(/^\[|\]$/g, '') // Remove colchetes
              .trim() // Remove espaços
              .toUpperCase();
            return entryPartnerName === normalizedPartnerName.toUpperCase();
          });
          console.log(`Logbook filtrado para ${normalizedPartnerName}: ${logbookData.length} de ${allLogbookData.length} registros`);
        } else {
          logbookData = allLogbookData;
        }
      } catch (err) {
        console.error('Erro crítico ao carregar logbook:', err);
      }

      // Load aerodromes data
      let aerodromeMap: any = {};
      if (logbookData && logbookData.length > 0) {
        const aerodromeCodes = new Set<string>();
        logbookData.forEach((entry: any) => {
          if (entry.departure_aerodrome) aerodromeCodes.add(entry.departure_aerodrome);
          if (entry.arrival_aerodrome) aerodromeCodes.add(entry.arrival_aerodrome);
        });

        if (aerodromeCodes.size > 0) {
          try {
            const codesArray = Array.from(aerodromeCodes);
            console.log('Buscando aerodromes:', codesArray);

            // Try to fetch aerodromes - use simple code matching
            // @ts-ignore - Supabase type instantiation too deep
            const result = await supabase
              .from('aerodromes')
              .select('code, name')
              .in('code', codesArray);
            const aerodromes = result.data as any[];
            const error = result.error;

            if (error) {
              console.warn('Erro ao buscar aerodromes:', error);
            }

            if (aerodromes && aerodromes.length > 0) {
              aerodromes.forEach((aero: any) => {
                aerodromeMap[aero.code] = { code: aero.code, name: aero.name };
              });
              console.log('Aerodromes carregados:', aerodromeMap);
            } else {
              console.warn('Nenhum aeródromo encontrado, usando fallback');
            }
          } catch (err) {
            console.error('Erro crítico ao buscar aerodromes:', err);
          }

          // Fallback: use the codes as names for any missing aerodromes
          Array.from(aerodromeCodes).forEach((code: string) => {
            if (!aerodromeMap[code]) {
              aerodromeMap[code] = { code, name: code };
            }
          });
        }
      }

      // Enrich logbook data with aerodrome information
      const enrichedLogbookData = (logbookData || []).map((entry: any) => {
        // Use code directly if not found in map, otherwise use map data
        const departure = entry.departure_aerodrome
          ? (aerodromeMap[entry.departure_aerodrome] || { code: entry.departure_aerodrome, name: entry.departure_aerodrome })
          : null;

        const arrival = entry.arrival_aerodrome
          ? (aerodromeMap[entry.arrival_aerodrome] || { code: entry.arrival_aerodrome, name: entry.arrival_aerodrome })
          : null;

        return {
          ...entry,
          departure_aero: departure,
          arrival_aero: arrival
        };
      });

      // Load fuel records - only for the selected client/partner
      let fuelData = null;
      try {
        console.log('Carregando abastecimentos para cliente:', forClientId, 'Partner selecionado:', selectedPartner?.name);

        const { data: allFuelData, error } = await supabase
          .from('abastecimentos')
          .select('*, aeronave:aeronave_id(registration), client:client_id(company_name)')
          .eq('aeronave_id', aircraftId)
          .eq('client_id', forClientId)
          .order('data', { ascending: false })
          .limit(50);

        if (error) console.warn('Erro ao carregar abastecimentos:', error);

        // If a specific partner is selected, filter by partner name
        // Abastecimentos store partner_name in format [NAME]
        if (selectedPartner && normalizedPartnerName && allFuelData) {
          fuelData = allFuelData.filter((record: any) => {
            if (!record.partner_name) return false;
            // Remove colchetes e normaliza para comparação
            const recordPartnerName = record.partner_name
              .replace(/^\[|\]$/g, '')
              .trim()
              .toUpperCase();
            return recordPartnerName === normalizedPartnerName.toUpperCase();
          });
          console.log(`Abastecimentos filtrados para ${normalizedPartnerName}: ${fuelData.length} de ${allFuelData.length} registros`);
        } else {
          fuelData = allFuelData;
        }
      } catch (err) {
        console.error('Erro crítico ao carregar abastecimentos:', err);
      }

      // Load CTM tracking
      let ctmData = null;
      try {
        const result = await supabase
          .from('ctm_tracking')
          .select('*, aircraft:aircraft_id(registration)')
          .eq('aircraft_id', aircraftId)
          .eq('client_id', forClientId)
          .order('created_at', { ascending: false });
        ctmData = result.data;
        if (result.error) console.warn('Erro ao carregar CTM:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar CTM:', err);
      }

      // Load travel reports for specific aircraft
      let reportsData = null;
      try {
        const result = await supabase
          .from('travel_expense_reports')
          .select('*')
          .eq('client_id', forClientId)
          .eq('aircraft_id', aircraftId)
          .order('created_at', { ascending: false })
          .limit(10);
        reportsData = result.data;
        if (result.error) console.warn('Erro ao carregar relatórios de viagem:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar relatórios de viagem:', err);
      }

      // Load bank reconciliations for the client
      let bankReconData = null;
      try {
        const result = await supabase
          .from('bank_reconciliations')
          .select('*')
          .eq('client_id', forClientId)
          .order('date', { ascending: false })
          .limit(100);
        bankReconData = result.data;
        if (result.error) console.warn('Erro ao carregar dados financeiros:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar dados financeiros:', err);
      }

      setFiles(filesData || []);
      setContracts(contractsData || []);
      setLogbookEntries(enrichedLogbookData || []);
      setFuelRecords(fuelData || []);
      setCtmTracking(ctmData || []);
      setTravelReports(reportsData || []);
      setBankReconciliations(bankReconData || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      // Fallback: set empty arrays to prevent UI from breaking
      setFiles([]);
      setContracts([]);
      setLogbookEntries([]);
      setFuelRecords([]);
      setCtmTracking([]);
      setTravelReports([]);

      // Show user-friendly error message
      if (error instanceof Error) {
        toast.error(`Erro ao carregar dados: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao carregar dados do cliente');
      }
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

  return (
    <>
      <Tabs defaultValue="files" className="w-full">
        <TabsList>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="logbook">Diário de Bordo</TabsTrigger>
          <TabsTrigger value="fuel">Abastecimentos</TabsTrigger>
          <TabsTrigger value="ctm">CTM</TabsTrigger>
          <TabsTrigger value="travel-reports">Relatórios de Viagem</TabsTrigger>
          <TabsTrigger value="envio-despesa">Envio de Despesa</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Upload className="h-5 w-5 text-primary" />
                Upload de Arquivos
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Envie seus arquivos para o portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="w-full"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Enviar Arquivos
              </Button>

              {files.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum arquivo enviado ainda</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 bg-muted/50 rounded-lg border border-border flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{file.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Enviado em: {new Date(file.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(file.file_path)}
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                Contratos
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Gerencie os contratos da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setContractUploadDialogOpen(true)}
                className="w-full"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Enviar Contrato
              </Button>

              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum contrato encontrado</p>
              ) : (
                <div className="space-y-2">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="p-4 bg-muted/50 rounded-lg border border-border flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{contract.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Enviado em: {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(contract.file_path)}
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteContract(contract.id, contract.file_path)}
                        >
                          <Trash className="h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
                Histórico de voos da aeronave
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logbookEntries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum registro de voo encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trecho</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tempo de Voo</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distância</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Combustível</th>
                        {partners.length > 1 && (
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sócio</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {logbookEntries.map((entry: any) => (
                        <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 text-foreground">
                            {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="py-4 px-4 text-foreground">
                            {entry.trecho ? (
                              <div>{entry.trecho}</div>
                            ) : entry.departure_aero && entry.arrival_aero ? (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {entry.departure_aero.code} x {entry.arrival_aero.code}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {entry.departure_aero.name} → {entry.arrival_aero.name}
                                </div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-4 px-4 text-foreground font-medium">
                            {entry.total_time ? `${parseFloat(entry.total_time).toFixed(2)}h` : '—'}
                          </td>
                          <td className="py-4 px-4 text-foreground">
                            {entry.distance_nm ? `${parseFloat(entry.distance_nm).toFixed(1)} NM` : '—'}
                          </td>
                          <td className="py-4 px-4 text-foreground">
                            {entry.fuel_added ? `${parseFloat(entry.fuel_added).toFixed(1)}L` : '—'}
                          </td>
                          {partners.length > 1 && (
                            <td className="py-4 px-4 text-foreground">
                              {entry.partner_name ? (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                  {entry.partner_name}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel" className="space-y-4">
          {(() => {
            const pendingFuel = fuelRecords.filter((r: any) => r.status_pagamento === 'pendente');
            const totalPending = pendingFuel.reduce((sum: number, r: any) => sum + (Number(r.valor_total) || 0), 0);

            return (
              <>
                {totalPending > 0 && (
                  <Card className="border-2 border-yellow-500/20 bg-yellow-500/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Saldo Devedor de Combustível</p>
                          <p className="text-3xl font-bold text-yellow-400">
                            R$ {totalPending.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pendingFuel.length} abastecimento{pendingFuel.length !== 1 ? 's' : ''} pendente{pendingFuel.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-yellow-500/20 text-yellow-300 mb-2">Pendente</Badge>
                          <p className="text-xs text-muted-foreground">
                            Pressione "Dar Baixa" para registrar o pagamento
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-gradient-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Fuel className="h-5 w-5 text-primary" />
                      Abastecimentos
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Acompanhe os abastecimentos da aeronave e registre os pagamentos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {fuelRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum registro de abastecimento encontrado</p>
              ) : (
                <div className="space-y-2">
                  {fuelRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground">
                              {record.aeronave?.registration || 'N/A'} - {record.local}
                            </p>
                            {record.partner_name && (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 text-xs">
                                {record.partner_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Data: {new Date(record.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-t border-border/50 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Litros</p>
                          <p className="font-medium text-foreground">{record.litros || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Valor Unitário</p>
                          <p className="font-medium text-foreground">R$ {record.valor_unitario || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                          <p className="font-medium text-green-400">R$ {record.valor_total || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Status</p>
                          <Badge className={
                            record.status_pagamento === 'pago'
                              ? 'bg-green-500/20 text-green-300'
                              : record.status_pagamento === 'pendente'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-gray-500/20 text-gray-300'
                          }>
                            {record.status_pagamento === 'pago' ? 'Pago' : record.status_pagamento === 'pendente' ? 'Pendente' : record.status_pagamento || 'N/A'}
                          </Badge>
                        </div>
                      </div>

                      {record.observacao && (
                        <div className="pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Observações</p>
                          <p className="text-sm text-foreground">{record.observacao}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">Abastecedor: {record.abastecedor || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground ml-auto">Comanda: {record.comanda || 'N/A'}</p>
                      </div>

                      {record.status_pagamento === 'pendente' && (
                        <Button
                          onClick={() => {
                            setSelectedFuelRecord(record);
                            setFuelPaymentDialogOpen(true);
                          }}
                          size="sm"
                          className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Dar Baixa no Pagamento
                        </Button>
                      )}

                      {record.status_pagamento === 'pago' && record.comprovante_url && (
                        <Button
                          onClick={() => window.open(record.comprovante_url, '_blank')}
                          size="sm"
                          variant="outline"
                          className="w-full mt-3 gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Baixar Comprovante
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
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

        <TabsContent value="envio-despesa" className="space-y-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Send className="h-5 w-5 text-primary" />
                Envio de Despesa ao Cliente
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Envie despesas diretamente para o cliente, selecionando um fornecedor favorito.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnvioDespesaTab clientId={clientId} clientName={clientName} aircraftId={aircraftId} aircraftRegistration={aircraftRegistration} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        clientId={clientId}
        aircraftId={aircraftId}
        onSuccess={() => loadData(clientId)}
      />

      <ContractUploadDialog
        open={contractUploadDialogOpen}
        onOpenChange={setContractUploadDialogOpen}
        clientId={clientId}
        onSuccess={() => loadData(clientId)}
      />

      <FuelPaymentDialog
        open={fuelPaymentDialogOpen}
        onOpenChange={setFuelPaymentDialogOpen}
        fuelRecord={selectedFuelRecord}
        onSuccess={() => loadData(clientId)}
      />

      {/* Exemplo de uso do EnvioDespesaTab, ajuste conforme necessário */}
      {/*
      <EnvioDespesaTab
        fornecedores={fornecedoresShare}
        // ...outras props...
      />
      */}
    </>
  );
}
