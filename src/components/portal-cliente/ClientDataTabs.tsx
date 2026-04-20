// @ts-nocheck
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Fuel, Wrench, Plane, Download, Upload, FileCheck, Eye, Send, Trash, CheckCircle2, DollarSign } from "lucide-react";
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
  selectedAbastecimentoId?: string;
}

interface TravelReportReconciliation {
  id: string;
  descricao: string;
  valor: string | number;
  status: string;
  data: string;
  prazo_pagamento?: string;
  referencia_id?: string;
  documento?: string;
  nome_socio?: string;
  pdf_url?: string | null;
}

export function ClientDataTabs({ clientId, clientName, aircraftId, aircraftRegistration, isAdmin = false, selectedPartner, selectedAbastecimentoId }: ClientDataTabsProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [contractUploadDialogOpen, setContractUploadDialogOpen] = useState(false);
  const [fuelPaymentDialogOpen, setFuelPaymentDialogOpen] = useState(false);
  const [selectedFuelRecord, setSelectedFuelRecord] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [ctmTracking, setCtmTracking] = useState<any[]>([]);
  const [travelReports, setTravelReports] = useState<TravelReportReconciliation[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<any[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>(clientId);
  const [fornecedoresShare, setFornecedoresShare] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>(selectedAbastecimentoId ? 'fuel' : 'financeiro');

  useEffect(() => {
    setActiveClientId(clientId);
  }, [clientId]);

  // Mudar para aba de abastecimentos se selectedAbastecimentoId for definido
  useEffect(() => {
    if (selectedAbastecimentoId) {
      setActiveTab('fuel');
    }
  }, [selectedAbastecimentoId]);

  useEffect(() => {
    const loadPartners = async () => {
      if (!aircraftId) return;
      try {
        // ✅ FIX 1: order por quota_hours (campo correto da tabela aircraft_shareholders)
        const { data } = await supabase
          .from('aircraft_shareholders')
          .select('*, client:client_id(id, razao_social)')
          .eq('aircraft_id', aircraftId)
          .order('quota_hours', { ascending: false });

        // ✅ FIX 2: mapear quota_hours no lugar de percentual_sociedade (que não existe na tabela)
        const partnerList = (data || []).map((p: any) => ({
          client_id: p.cliente_id,
          company_name: p.client?.razao_social || p.client_name || p.nome_socio || p.cliente_id,
          percentual_sociedade: p.quota_hours || 0,
        }));

        if (!partnerList.find((p: any) => p.cliente_id === clientId)) {
          partnerList.unshift({ client_id: clientId, company_name: clientName, percentual_sociedade: 100 });
        }

        setPartners(partnerList);
        setActiveClientId(clientId);
      } catch (error) {
        console.error('Error loading partners:', error);
      }
    };

    loadPartners();
  }, [aircraftId, clientId, clientName]);

  useEffect(() => {
    if (clientId && aircraftId) {
      loadData(clientId);
    }
  }, [clientId, aircraftId, selectedPartner]);

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

      const normalizedPartnerName = selectedPartner?.nome?.trim() || '';
      const clientIds = [forClientId];

      if (partners.length > 1) {
        partners.forEach((partner: any) => {
          if (partner.cliente_id && partner.cliente_id !== forClientId && !clientIds.includes(partner.cliente_id)) {
            clientIds.push(partner.cliente_id);
          }
        });
      }

      // Load files
      let filesData = null;
      try {
        const result = await (supabase as any)
          .from('arquivos_portal_cliente')
          .select('*')
          .eq('cliente_id', forClientId)
          .order('criado_em', { ascending: false });
        filesData = result.data;
        if (result.error) console.warn('Erro ao carregar arquivos:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar arquivos:', err);
      }

      // Load contracts
      let contractsData = null;
      try {
        const result = await (supabase as any)
          .from('contratos_cliente')
          .select('*')
          .eq('cliente_id', forClientId)
          .order('criado_em', { ascending: false });
        contractsData = result.data;
        if (result.error) console.warn('Erro ao carregar contratos:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar contratos:', err);
      }

      // Load logbook entries
      // ✅ FIX: partner_name não existe na tabela — removido do select.
      // O filtro por sócio usa socios_cliente_id (FK existente no schema).
      let logbookData = null;
      try {
        let query = supabase
          .from('lancamentos_diario_bordo')
          .select(`
            id,
            data_registro,
            tempo_total,
            distance_nm,
            fuel_added,
            departure_aerodrome,
            arrival_aerodrome,
            trecho,
            socios_cliente_id
          `)
          .eq('aeronave_id', aircraftId)
          .eq('clientes_id', forClientId)
          .order('data_registro', { ascending: false })
          .limit(100);

        // Se sócio selecionado tiver id, filtra por socios_cliente_id
        if (selectedPartner?.id) {
          query = query.eq('socios_cliente_id', selectedPartner.id);
        }

        const { data: allLogbookData, error } = await query;

        if (error) console.warn('Erro ao carregar logbook:', error);
        logbookData = allLogbookData || [];
      } catch (err) {
        console.error('Erro crítico ao carregar logbook:', err);
      }

      // Load aerodromes
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
            // ✅ FIX: coluna correta é 'designativo', não 'code'
            const result = await supabase
              .from('aerodromes')
              .select('designativo, name')
              .in('designativo', codesArray);
            const aerodromes = result.data as any[];
            if (aerodromes && aerodromes.length > 0) {
              aerodromes.forEach((aero: any) => {
                aerodromeMap[aero.designativo] = { code: aero.designativo, name: aero.nome };
              });
            }
          } catch (err) {
            console.error('Erro crítico ao buscar aerodromes:', err);
          }

          // Fallback: aeródromos não encontrados usam o próprio código como nome
          Array.from(aerodromeCodes).forEach((code: string) => {
            if (!aerodromeMap[code]) {
              aerodromeMap[code] = { code, name: code };
            }
          });
        }
      }

      const enrichedLogbookData = (logbookData || []).map((entry: any) => {
        const departure = entry.departure_aerodrome
          ? (aerodromeMap[entry.departure_aerodrome] || { code: entry.departure_aerodrome, name: entry.departure_aerodrome })
          : null;
        const arrival = entry.arrival_aerodrome
          ? (aerodromeMap[entry.arrival_aerodrome] || { code: entry.arrival_aerodrome, name: entry.arrival_aerodrome })
          : null;
        return { ...entry, departure_aero: departure, arrival_aero: arrival };
      });

      // Load fuel records
      let fuelData = null;
      try {
        const { data: allFuelData, error } = await supabase
          .from('abastecimentos')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .eq('clientes_id', forClientId)
          .order('data', { ascending: false })
          .limit(50);

        if (error) console.warn('Erro ao carregar abastecimentos:', error);

        if (selectedPartner && normalizedPartnerName && allFuelData) {
          fuelData = allFuelData.filter((record: any) => {
            if (!record.nome_socio) return false;
            const recordPartnerName = record.nome_socio
              .replace(/^\[|\]$/g, '')
              .trim()
              .toUpperCase();
            return recordPartnerName === normalizedPartnerName.toUpperCase();
          });
        } else {
          fuelData = allFuelData;
        }
      } catch (err) {
        console.error('Erro crítico ao carregar abastecimentos:', err);
      }

      // Load CTM tracking
      let ctmData = null;
      try {
        const result = await (supabase as any)
          .from('ctm_tracking')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .eq('cliente_id', forClientId)
          .order('created_at', { ascending: false });
        ctmData = result.data;
        if (result.error) console.warn('Erro ao carregar CTM:', result.error);
      } catch (err) {
        console.error('Erro crítico ao carregar CTM:', err);
      }

      // Carregar Relatórios de Viagem via bank_reconciliations
      let reportsData: TravelReportReconciliation[] = [];
      try {
        const { data: reconData, error } = await supabase
          .from('conciliacoes_bancarias')
          .select('id, descricao, valor, status, data, prazo_pagamento, referencia_id, documento, nome_socio')
          .eq('clientes_id', forClientId)
          .eq('aeronave_id', aircraftId)
          .eq('categoria', 'RELATORIO DE DESPESA DE VIAGENS')
          .order('data', { ascending: false })
          .limit(20);

        if (error) console.warn('Erro ao carregar relatórios de viagem:', error);

        if (reconData && reconData.length > 0) {
          const referenceIds = reconData
            .map((r: any) => r.referencia_id)
            .filter(Boolean) as string[];

          let pdfMap: Record<string, string | null> = {};

          if (referenceIds.length > 0) {
            const { data: pdfData, error: pdfError } = await supabase
              .from('travel_expense_reports')
              .select('id, url_pdf')
              .in('id', referenceIds);

            if (pdfError) console.warn('Erro ao buscar url_pdf dos relatórios:', pdfError);

            (pdfData || []).forEach((row: any) => {
              pdfMap[row.id] = row.url_pdf || null;
            });
          }

          reportsData = reconData.map((r: any) => ({
            ...r,
            pdf_url: r.referencia_id ? (pdfMap[r.referencia_id] ?? null) : null,
          }));
        }
      } catch (err) {
        console.error('Erro crítico ao carregar relatórios de viagem:', err);
      }

      // Load bank reconciliations (filtrando por aeronave_id para mostrar apenas dados do avião selecionado)
      let bankReconData = null;
      try {
        const result = await supabase
          .from('conciliacoes_bancarias')
          .select('*')
          .eq('clientes_id', forClientId)
          .eq('aeronave_id', aircraftId)
          .order('data', { ascending: false })
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
      setTravelReports(reportsData);
      setBankReconciliations(bankReconData || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      setFiles([]);
      setContracts([]);
      setLogbookEntries([]);
      setFuelRecords([]);
      setCtmTracking([]);
      setTravelReports([]);
      setBankReconciliations([]);

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
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await (supabase as any)
        .from('contratos_cliente')
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="logbook">Diário de Bordo</TabsTrigger>
          <TabsTrigger value="fuel">Abastecimentos</TabsTrigger>
          <TabsTrigger value="ctm">CTM</TabsTrigger>
          <TabsTrigger value="travel-reports">Relatórios de Viagem</TabsTrigger>
          <TabsTrigger value="envio-despesa">Envio de Despesa</TabsTrigger>
        </TabsList>

        {/* ── Financeiro ──────────────────────────────────────────────────────── */}
        <TabsContent value="financeiro" className="space-y-4">
          {/* Card com informações do avião selecionado */}
          {aircraftRegistration && (
            <Card className="border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <Plane className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-0.5">Dados financeiros da aeronave:</p>
                    <p className="text-lg font-semibold text-blue-400">
                      {aircraftRegistration}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção de Movimentações */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <DollarSign className="h-5 w-5 text-primary" />
                Movimentações Financeiras
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Transações e despesas lançadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankReconciliations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma movimentação encontrada para esta aeronave</p>
              ) : (
                <div className="space-y-3">
                  {bankReconciliations.map((record: any) => {
                    const statusColorMap: any = {
                      'enviado': 'bg-blue-500/10 border-blue-500/30 text-blue-300',
                      'pendente': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
                      'pago': 'bg-green-500/10 border-green-500/30 text-green-300',
                      'recebido': 'bg-green-500/10 border-green-500/30 text-green-300',
                      'cancelado': 'bg-red-500/10 border-red-500/30 text-red-300',
                    };
                    const statusColor = statusColorMap[record.status?.toLowerCase()] || 'bg-gray-500/10 border-gray-500/30 text-gray-300';

                    const categoryEmoji: any = {
                      'ADM SHARE': '📋',
                      'COMBUSTÍVEL': '⛽',
                      'MANUTENÇÃO': '🔧',
                      'HOTEL': '🏨',
                      'ALIMENTAÇÃO': '🍽️',
                      'TRANSPORTE': '🚗',
                    };
                    const emoji = Object.keys(categoryEmoji).find(key => record.categoria?.includes(key))
                      ? categoryEmoji[Object.keys(categoryEmoji).find(key => record.categoria?.includes(key))!]
                      : '💳';

                    return (
                      <div
                        key={record.id}
                        className="p-4 rounded-lg border border-border/50 bg-gradient-to-r from-slate-900/40 to-slate-800/40 hover:border-border hover:bg-slate-900/60 transition-all duration-300 backdrop-blur-sm"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 border border-primary/30 flex items-center justify-center text-xl">
                            {emoji}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground truncate">
                                {record.descricao}
                              </h3>
                              <Badge className={`shrink-0 border ${statusColor} capitalize text-xs`}>
                                {record.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                                <p className="text-foreground font-medium">
                                  {(() => {
                                    if (!record.data) return '';
                                    try {
                                      const [year, month, day] = record.data.split('T')[0].split('-');
                                      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString('pt-BR');
                                    } catch {
                                      return record.data;
                                    }
                                  })()}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Categoria</p>
                                <p className="text-foreground font-medium text-sm">
                                  {record.categoria || '—'}
                                </p>
                              </div>

                              {record.prazo_pagamento && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-0.5">Prazo Pagamento</p>
                                  <p className="text-foreground font-medium">
                                    {(() => {
                                      if (!record.prazo_pagamento) return '';
                                      try {
                                        const [year, month, day] = record.prazo_pagamento.split('T')[0].split('-');
                                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString('pt-BR');
                                      } catch {
                                        return record.prazo_pagamento;
                                      }
                                    })()}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground mb-1">Valor</p>
                            <p className="text-lg font-bold text-emerald-400">
                              R$ {Number(record.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção de Recibos de Reembolso */}
          <FinancialHistoryTab
            clientId={clientId}
            aircraftId={aircraftId}
          />
        </TabsContent>

        {/* ── Contratos ───────────────────────────────────────────────────────── */}
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
              <Button onClick={() => setContractUploadDialogOpen(true)} className="w-full" size="lg">
                <Upload className="h-4 w-4 mr-2" />
                Enviar Contrato
              </Button>

              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum contrato encontrado</p>
              ) : (
                <div className="space-y-2">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="p-4 bg-muted/50 rounded-lg border border-border flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{contract.nome_arquivo}</p>
                        <p className="text-sm text-muted-foreground">
                          Enviado em: {new Date(contract.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => downloadFile(contract.caminho_arquivo)}>
                          <Download className="h-4 w-4" /> Baixar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteContract(contract.id, contract.caminho_arquivo)}>
                          <Trash className="h-4 w-4" /> Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Diário de Bordo ─────────────────────────────────────────────────── */}
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
                                  {entry.departure_aero.nome} → {entry.arrival_aero.nome}
                                </div>
                              </div>
                            ) : '—'}
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
                              {/* partner_name não existe na tabela — exibe indicador se voo tem sócio vinculado */}
                              {entry.socio_cliente_id_id ? (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                  Sócio
                                </span>
                              ) : '—'}
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

        {/* ── Abastecimentos ──────────────────────────────────────────────────── */}
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
                          <div key={record.id} className={`p-4 rounded-lg border ${selectedAbastecimentoId === record.id ? 'bg-blue-500/20 border-blue-500 border-l-4 border-l-blue-500' : 'bg-muted/50 border-border'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-foreground">
                                    {record.aeronave?.registration || 'N/A'} - {record.local}
                                  </p>
                                  {record.nome_socio && (
                                    <Badge variant="outline" className="bg-blue-500/20 text-blue-300 text-xs">
                                      {record.nome_socio}
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
                                  {record.status_pagamento === 'pago' ? 'Pago'
                                    : record.status_pagamento === 'pendente' ? 'Pendente'
                                    : record.status_pagamento || 'N/A'}
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

        {/* ── CTM ─────────────────────────────────────────────────────────────── */}
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
                  <div key={item.id} className="p-4 bg-muted/50 rounded-lg border border-border">
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

        {/* ── Relatórios de Viagem ─────────────────────────────────────────────── */}
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
                  const isPago =
                    report.status?.toLowerCase() === 'pago' ||
                    report.status?.toLowerCase() === 'recebido' ||
                    report.status?.toLowerCase() === 'conferido';

                  const isEnviado = report.status?.toLowerCase() === 'enviado';

                  return (
                    <div key={report.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-foreground">
                                {report.documento || report.descricao}
                              </p>
                              <Badge
                                variant="outline"
                                className={
                                  isPago
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-yellow-500/20 text-yellow-300'
                                }
                              >
                                {isPago ? 'Conferido' : 'Pendente'}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Emitido em:{' '}
                              {report.data
                                ? (() => {
                                    try {
                                      const [y, m, d] = report.data.split('T')[0].split('-');
                                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('pt-BR');
                                    } catch {
                                      return report.data;
                                    }
                                  })()
                                : '—'}
                            </p>

                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {report.descricao}
                            </p>

                            <p className="text-sm font-semibold text-green-400 mt-1">
                              Valor: R$ {Number(report.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>

                          {report.pdf_url ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(report.pdf_url!, '_blank')}
                              className="gap-2 shrink-0"
                            >
                              <Eye className="h-4 w-4" />
                              Ver PDF
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="gap-2 shrink-0 opacity-50">
                              <Eye className="h-4 w-4" />
                              PDF indisponível
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Prazo de Pagamento</p>
                            <p className="text-sm text-foreground">
                              {report.prazo_pagamento
                                ? (() => {
                                    try {
                                      const [y, m, d] = report.prazo_pagamento.split('T')[0].split('-');
                                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('pt-BR');
                                    } catch {
                                      return report.prazo_pagamento;
                                    }
                                  })()
                                : 'Não definido'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Status</p>
                            <Badge
                              className={
                                isPago
                                  ? 'bg-green-500/20 text-green-300'
                                  : isEnviado
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-yellow-500/20 text-yellow-300'
                              }
                            >
                              {isPago ? 'Conferido' : isEnviado ? 'Enviado' : 'Pendente'}
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

        {/* ── Envio de Despesa ────────────────────────────────────────────────── */}
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
              <EnvioDespesaTab
                clientId={clientId}
                clientName={clientName}
                aircraftId={aircraftId}
                aircraftRegistration={aircraftRegistration}
              />
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
    </>
  );
}
