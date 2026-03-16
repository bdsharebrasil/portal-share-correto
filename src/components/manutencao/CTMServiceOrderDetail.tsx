import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Wrench, FileText, Calendar, DollarSign,
  Trash2, Edit, Download, Printer, AlertCircle, Users, PieChart, Clock, Check
} from "lucide-react";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OASData {
  id: string;
  aircraft_id: string;
  numero: string;
  data_entrada: string;
  data_saida: string | null;
  horas_celula: number;
  tipo_manutencao: string;
  objetivo: string;
  dias_previstos: number;
  dias_efetivos: number | null;
  oficina_nome: string;
  oficina_contato: string;
  total_mao_obra: number;
  total_pecas: number;
  total_geral: number;
  status: string;
  created_at: string;
  approval_status?: string;
  submitted_for_approval_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

interface ServicoOAS {
  id: string;
  service_order_id: string;
  descricao: string;
  fornecedor: string;
  periodo: string;
  valor: number;
  nota_fiscal: string;
  modelo?: string;
  modo_pagamento?: string;
  dados_pagamento?: string;
  quantidade?: number;
  valor_unitario?: number;
}

interface PecaOAS {
  id: string;
  service_order_id: string;
  descricao: string;
  fornecedor: string;
  valor_total: number;
  nota_fiscal: string;
}

interface LogbookEntry {
  entry_date: string;
  total_time: number;
  client_id: string;
  client_name: string;
}

interface HorasVooPorSocio {
  client_id: string;
  client_name: string;
  horas_por_mes: { mes: string; horas: number }[];
  total_horas: number;
  percentual: number;
}

interface CTMServiceOrderDetailProps {
  serviceOrderId: string;
  aircraftRegistration: string;
  onBack: () => void;
}

export function CTMServiceOrderDetail({
  serviceOrderId,
  aircraftRegistration,
  onBack,
}: CTMServiceOrderDetailProps) {
  const [oas, setOas] = useState<OASData | null>(null);
  const [servicos, setServicos] = useState<ServicoOAS[]>([]);
  const [pecas, setPecas] = useState<PecaOAS[]>([]);
  const [logbookEntries, setLogbookEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingServico, setEditingServico] = useState<ServicoOAS | null>(null);
  const [editingPeca, setEditingPeca] = useState<PecaOAS | null>(null);
  const [showServicoDialog, setShowServicoDialog] = useState(false);
  const [showPecaDialog, setShowPecaDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadOASData();
  }, [serviceOrderId]);

  const loadOASData = async () => {
    try {
      setLoading(true);

      // Load OAS main data
      const { data: oasData, error: oasError } = await supabase
        .from("ctm_service_orders")
        .select("*")
        .eq("id", serviceOrderId)
        .single();

      if (oasError) throw oasError;
      setOas(oasData);

      // Load servicos
      const { data: servicosData, error: servicosError } = await supabase
        .from("ctm_services")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at");

      if (!servicosError) setServicos(servicosData || []);

      // Load pecas
      const { data: pecasData, error: pecasError } = await supabase
        .from("ctm_parts")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at");

      if (!pecasError) setPecas(pecasData || []);

      // Load logbook entries for the period - only if we have dates
      if (oasData?.data_entrada && oasData?.aircraft_id) {
        const dataFim = oasData.data_saida || new Date().toISOString().split('T')[0];
        
        const { data: logbookData, error: logbookError } = await supabase
          .from("logbook_entries")
          .select(`
            entry_date,
            total_time,
            client_id,
            clients!inner(company_name)
          `)
          .eq("aircraft_id", oasData.aircraft_id)
          .gte("entry_date", oasData.data_entrada)
          .lte("entry_date", dataFim)
          .order("entry_date");

        if (!logbookError && logbookData) {
          const entries = logbookData.map((entry: any) => ({
            entry_date: entry.entry_date,
            total_time: entry.total_time || 0,
            client_id: entry.client_id,
            client_name: entry.clients?.company_name || 'Desconhecido'
          }));
          setLogbookEntries(entries);
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar OAS:", error);
      toast.error("Erro ao carregar OAS");
    } finally {
      setLoading(false);
    }
  };

  // Calculate hours per partner dynamically from logbook entries
  const horasVooPorSocio = useMemo<HorasVooPorSocio[]>(() => {
    if (!oas?.data_entrada || logbookEntries.length === 0) return [];

    const dataInicio = parseISO(oas.data_entrada);
    const dataFim = oas.data_saida ? parseISO(oas.data_saida) : new Date();

    // Get all months in the period
    const meses = eachMonthOfInterval({ start: dataInicio, end: dataFim });

    // Group entries by client
    const clientsMap = new Map<string, { name: string; entries: LogbookEntry[] }>();
    
    logbookEntries.forEach(entry => {
      if (!clientsMap.has(entry.client_id)) {
        clientsMap.set(entry.client_id, { name: entry.client_name, entries: [] });
      }
      clientsMap.get(entry.client_id)?.entries.push(entry);
    });

    // Calculate hours per month per client
    const result: HorasVooPorSocio[] = [];
    let totalGeralHoras = 0;

    clientsMap.forEach((clientData, clientId) => {
      const horasPorMes: { mes: string; horas: number }[] = [];
      let totalClienteHoras = 0;

      meses.forEach((mes, index) => {
        const inicioMes = index === 0 ? dataInicio : startOfMonth(mes);
        const fimMes = index === meses.length - 1 ? dataFim : endOfMonth(mes);

        const horasMes = clientData.entries
          .filter(entry => {
            const entryDate = parseISO(entry.entry_date);
            return isWithinInterval(entryDate, { start: inicioMes, end: fimMes });
          })
          .reduce((sum, entry) => sum + (entry.total_time || 0), 0);

        // Format month label
        let mesLabel: string;
        if (index === 0 && meses.length > 1) {
          mesLabel = `${format(inicioMes, "dd/MM/yyyy")} até ${format(endOfMonth(mes), "dd/MM/yyyy")}`;
        } else if (index === meses.length - 1 && meses.length > 1) {
          mesLabel = `${format(startOfMonth(mes), "dd/MM/yyyy")} até ${format(fimMes, "dd/MM/yyyy")}`;
        } else if (meses.length === 1) {
          mesLabel = `${format(inicioMes, "dd/MM/yyyy")} até ${format(fimMes, "dd/MM/yyyy")}`;
        } else {
          mesLabel = format(mes, "MMMM/yyyy", { locale: ptBR });
        }

        horasPorMes.push({ mes: mesLabel, horas: horasMes });
        totalClienteHoras += horasMes;
      });

      totalGeralHoras += totalClienteHoras;
      
      result.push({
        client_id: clientId,
        client_name: clientData.name,
        horas_por_mes: horasPorMes,
        total_horas: totalClienteHoras,
        percentual: 0 // Will be calculated after
      });
    });

    // Calculate percentages
    result.forEach(item => {
      item.percentual = totalGeralHoras > 0 ? (item.total_horas / totalGeralHoras) * 100 : 0;
    });

    return result;
  }, [oas, logbookEntries]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido":
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600">Concluído</Badge>;
      case "em_andamento":
      case "ongoing":
        return <Badge className="bg-blue-500/10 text-blue-600">Em Andamento</Badge>;
      case "pendente":
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600">Pendente</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-600">{status}</Badge>;
    }
  };

  const handleDeleteServico = async (id: string) => {
    if (!confirm("Deseja remover este serviço?")) return;
    try {
      await supabase.from("ctm_services").delete().eq("id", id);
      setServicos(servicos.filter(s => s.id !== id));
      toast.success("Serviço removido");
    } catch (error) {
      toast.error("Erro ao remover serviço");
    }
  };

  const handleDeletePeca = async (id: string) => {
    if (!confirm("Deseja remover esta peça?")) return;
    try {
      await supabase.from("ctm_parts").delete().eq("id", id);
      setPecas(pecas.filter(p => p.id !== id));
      toast.success("Peça removida");
    } catch (error) {
      toast.error("Erro ao remover peça");
    }
  };

  const handleSaveChanges = async () => {
    if (!oas) return;
    try {
      setIsSubmitting(true);

      // Atualizar OAS
      const { error: oasError } = await supabase
        .from("ctm_service_orders")
        .update({
          approval_status: 'draft',
          total_geral: totalGeral,
          updated_at: new Date().toISOString()
        })
        .eq("id", serviceOrderId);

      if (oasError) throw oasError;

      toast.success("Alterações salvas com sucesso");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar alterações");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!oas) return;
    if (servicos.length === 0 && pecas.length === 0) {
      toast.error("Adicione pelo menos um serviço ou peça antes de enviar para aprovação");
      return;
    }

    try {
      setIsSubmitting(true);

      // Atualizar status de aprovação
      const { error: updateError } = await supabase
        .from("ctm_service_orders")
        .update({
          approval_status: 'pending_approval',
          submitted_for_approval_at: new Date().toISOString(),
          total_geral: totalGeral
        })
        .eq("id", serviceOrderId);

      if (updateError) throw updateError;

      // Criar registro de aprovação
      const { error: approvalError } = await supabase
        .from("ctm_service_order_approvals")
        .insert({
          service_order_id: serviceOrderId,
          status: 'pending',
          submitted_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (approvalError) throw approvalError;

      setOas({ ...oas, approval_status: 'pending_approval' });
      toast.success("Orçamento enviado para aprovação");
    } catch (error) {
      console.error("Erro ao enviar para aprovação:", error);
      toast.error("Erro ao enviar para aprovação");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">Carregando OAS...</span>
      </div>
    );
  }

  if (!oas) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">OAS não encontrada</span>
      </div>
    );
  }

  const totalServicos = servicos.reduce((sum, s) => sum + s.valor, 0);
  const totalPecas = pecas.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const totalGeral = totalServicos + totalPecas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ordem de Serviço</h1>
            <p className="text-muted-foreground">OAS Nº {oas.numero}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {getStatusBadge(oas.approval_status === 'pending_approval' ? 'pendente' : oas.status)}
          {oas.approval_status === 'approved' && (
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
              ✓ Aprovado
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={handleSaveChanges}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <Button
            variant={oas.approval_status === 'pending_approval' ? "outline" : "default"}
            size="sm"
            disabled={isSubmitting || oas.approval_status === 'pending_approval'}
            onClick={handleSubmitForApproval}
            className="gap-2"
          >
            {oas.approval_status === 'pending_approval' ? (
              <>
                <Clock className="h-4 w-4" />
                Aguardando Aprovação
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Enviar para Aprovação
              </>
            )}
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Main OAS Info Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-border">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">AERONAVE</p>
              <p className="text-lg font-bold text-foreground">{aircraftRegistration}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">HORAS DE CÉLULA</p>
              <p className="text-lg font-bold text-foreground">{oas.horas_celula?.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">TIPO DE MANUTENÇÃO</p>
              <p className="text-lg font-bold text-foreground">{oas.tipo_manutencao}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">PERÍODO</p>
              <p className="text-lg font-bold text-foreground">{oas.dias_previstos}H</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/30 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">DATA DE ENTRADA</p>
              <p className="font-semibold text-foreground">
                {format(new Date(oas.data_entrada), "dd/MM/yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DATA DE SAÍDA</p>
              <p className="font-semibold text-foreground">
                {oas.data_saida ? format(new Date(oas.data_saida), "dd/MM/yyyy") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DIAS PREVISTOS</p>
              <p className="font-semibold text-foreground">{oas.dias_previstos}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">DIAS EFETIVOS</p>
              <p className="font-semibold text-foreground">{oas.dias_efetivos || "—"}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/30 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">OFICINA</p>
              <p className="font-semibold text-foreground">{oas.oficina_nome}</p>
              {oas.oficina_contato && (
                <p className="text-sm text-muted-foreground">{oas.oficina_contato}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">OBJETIVO</p>
              <p className="font-semibold text-foreground">{oas.objetivo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horas de Voo por Sócio - Calculadas Dinamicamente do Diário de Bordo */}
      {horasVooPorSocio.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Horas Voadas por Sócio no Período
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Período: {oas?.data_entrada ? format(parseISO(oas.data_entrada), "dd/MM/yyyy") : '-'} até {oas?.data_saida ? format(parseISO(oas.data_saida), "dd/MM/yyyy") : 'Hoje'}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Table with hours per month per partner */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">PERÍODO</th>
                    {horasVooPorSocio.map(socio => (
                      <th key={socio.client_id} className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                        {socio.client_name.split(' ')[0].toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horasVooPorSocio[0]?.horas_por_mes.map((_, mesIndex) => (
                    <tr key={mesIndex} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground font-medium">
                        {horasVooPorSocio[0].horas_por_mes[mesIndex].mes}
                      </td>
                      {horasVooPorSocio.map(socio => (
                        <td key={socio.client_id} className="px-4 py-3 text-sm text-right text-foreground">
                          {socio.horas_por_mes[mesIndex].horas.toFixed(2)}h
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-border bg-background/50 font-semibold">
                    <td className="px-4 py-3 text-sm text-foreground">TOTAIS</td>
                    {horasVooPorSocio.map(socio => (
                      <td key={socio.client_id} className="px-4 py-3 text-sm text-right text-foreground">
                        {socio.total_horas.toFixed(2)}h
                      </td>
                    ))}
                  </tr>
                  {/* Percentage Row */}
                  <tr className="bg-primary/5 font-bold">
                    <td className="px-4 py-3 text-sm text-foreground">PERCENTUAL PARA RATEIO</td>
                    {horasVooPorSocio.map(socio => (
                      <td key={socio.client_id} className="px-4 py-3 text-sm text-right text-primary">
                        {socio.percentual.toFixed(2)}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Horas Voadas</p>
                <p className="text-2xl font-bold text-foreground">
                  {horasVooPorSocio.reduce((sum, s) => sum + s.total_horas, 0).toFixed(2)}h
                </p>
              </div>
              {horasVooPorSocio.map(socio => (
                <div key={socio.client_id} className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    {socio.client_name.split(' ')[0]}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {socio.percentual.toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{socio.total_horas.toFixed(2)}h</p>
                </div>
              ))}
            </div>

            {/* Rateio Preview if there's a total cost */}
            {(totalServicos + totalPecas) > 0 && (
              <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Prévia do Rateio de Custos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {horasVooPorSocio.map(socio => {
                    const valorRateio = ((totalServicos + totalPecas) * socio.percentual) / 100;
                    return (
                      <div key={socio.client_id} className="text-center p-3 rounded bg-background/50">
                        <p className="text-xs text-muted-foreground mb-1">{socio.client_name.split(' ')[0]}</p>
                        <p className="text-lg font-bold text-primary">
                          R$ {valorRateio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">({socio.percentual.toFixed(2)}%)</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message when no flight hours in period */}
      {horasVooPorSocio.length === 0 && oas?.data_entrada && (
        <Card className="border-border border-dashed">
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma hora de voo registrada no período</p>
            <p className="text-sm text-muted-foreground mt-1">
              {oas?.data_entrada ? format(parseISO(oas.data_entrada), "dd/MM/yyyy") : ''} 
              {' - '} 
              {oas?.data_saida ? format(parseISO(oas.data_saida), "dd/MM/yyyy") : 'Hoje'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Serviços */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Serviços Executados
          </CardTitle>
          <Button onClick={() => {
            setEditingServico(null);
            setShowServicoDialog(true);
          }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </CardHeader>
        <CardContent>
          {servicos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">MODELO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">FORNECEDOR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">PERÍODO</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">VALOR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">MODO PAG.</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">NF</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((servico) => (
                    <tr key={servico.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground">{servico.descricao}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{servico.modelo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{servico.fornecedor}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">{servico.periodo}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground font-medium">
                        R$ {servico.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground text-xs">{servico.modo_pagamento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground">{servico.nota_fiscal || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteServico(servico.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background/50 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-sm text-foreground">SUBTOTAL SERVIÇOS</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      R$ {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum serviço adicionado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peças */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Peças Aplicadas
          </CardTitle>
          <Button onClick={() => {
            setEditingPeca(null);
            setShowPecaDialog(true);
          }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Peça
          </Button>
        </CardHeader>
        <CardContent>
          {pecas.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">DESCRIÇÃO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">MODELO</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">FORNECEDOR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">QTD</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">VALOR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">MODO PAG.</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">NF</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((peca) => (
                    <tr key={peca.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="px-4 py-3 text-sm text-foreground">{peca.descricao}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{peca.modelo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{peca.fornecedor}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">{peca.quantidade || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right text-foreground font-medium">
                        R$ {(peca.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground text-xs">{peca.modo_pagamento || '-'}</td>
                      <td className="px-4 py-3 text-sm text-foreground text-muted-foreground">{peca.nota_fiscal || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePeca(peca.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background/50 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-sm text-foreground">SUBTOTAL PEÇAS</td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma peça adicionada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Serviços</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-border"></div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Peças</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-l border-border"></div>
            <div className="space-y-2 text-right">
              <p className="text-sm text-muted-foreground">TOTAL GERAL</p>
              <p className="text-3xl font-bold text-primary">
                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Novo Serviço */}
      <Dialog open={showServicoDialog} onOpenChange={setShowServicoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingServico ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                placeholder="Descrição do serviço"
                defaultValue={editingServico?.descricao || ''}
              />
            </div>
            <div>
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                placeholder="ex: 25140/22A703"
                defaultValue={editingServico?.modelo || ''}
              />
            </div>
            <div>
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                placeholder="1"
                defaultValue={editingServico?.quantidade || 1}
              />
            </div>
            <div>
              <Label htmlFor="valor_unitario">Valor Unitário (R$)</Label>
              <Input
                id="valor_unitario"
                type="number"
                placeholder="0,00"
                defaultValue={editingServico?.valor_unitario || editingServico?.valor || 0}
              />
            </div>
            <div>
              <Label htmlFor="valor_total">Valor Total (R$)</Label>
              <Input
                id="valor_total"
                type="number"
                placeholder="0,00"
                defaultValue={editingServico?.valor || 0}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                placeholder="Nome do fornecedor"
                defaultValue={editingServico?.fornecedor || ''}
              />
            </div>
            <div>
              <Label htmlFor="modo_pagamento">Modo de Pagamento</Label>
              <Input
                id="modo_pagamento"
                placeholder="ex: Boleto, Transferência, Cartão"
                defaultValue={editingServico?.modo_pagamento || ''}
              />
            </div>
            <div>
              <Label htmlFor="nota_fiscal">Nota Fiscal</Label>
              <Input
                id="nota_fiscal"
                placeholder="ex: NF-000123"
                defaultValue={editingServico?.nota_fiscal || ''}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="dados_pagamento">Dados para Pagamento</Label>
              <Textarea
                id="dados_pagamento"
                placeholder="Banco: XXX | Agência: 0000-0 | Conta: 00000-0"
                defaultValue={editingServico?.dados_pagamento || ''}
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowServicoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowServicoDialog(false)}>
              Salvar Serviço
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Nova Peça */}
      <Dialog open={showPecaDialog} onOpenChange={setShowPecaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPeca ? 'Editar Peça' : 'Nova Peça'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="descricao_peca">Descrição *</Label>
              <Input
                id="descricao_peca"
                placeholder="Descrição da peça"
                defaultValue={editingPeca?.descricao || ''}
              />
            </div>
            <div>
              <Label htmlFor="modelo_peca">Modelo (P/N)</Label>
              <Input
                id="modelo_peca"
                placeholder="ex: 32005-007"
                defaultValue={editingPeca?.modelo || ''}
              />
            </div>
            <div>
              <Label htmlFor="serial_number">Número de Série (N/S)</Label>
              <Input
                id="serial_number"
                placeholder="ex: 318551"
                defaultValue={editingPeca?.serial_number || ''}
              />
            </div>
            <div>
              <Label htmlFor="quantidade_peca">Quantidade</Label>
              <Input
                id="quantidade_peca"
                type="number"
                placeholder="1"
                defaultValue={editingPeca?.quantidade || 1}
              />
            </div>
            <div>
              <Label htmlFor="valor_unitario_peca">Valor Unitário (R$)</Label>
              <Input
                id="valor_unitario_peca"
                type="number"
                placeholder="0,00"
                defaultValue={editingPeca?.valor_unitario || 0}
              />
            </div>
            <div>
              <Label htmlFor="valor_total_peca">Valor Total (R$)</Label>
              <Input
                id="valor_total_peca"
                type="number"
                placeholder="0,00"
                defaultValue={editingPeca?.valor_total || 0}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="fornecedor_peca">Fornecedor</Label>
              <Input
                id="fornecedor_peca"
                placeholder="Nome do fornecedor"
                defaultValue={editingPeca?.fornecedor || ''}
              />
            </div>
            <div>
              <Label htmlFor="modo_pagamento_peca">Modo de Pagamento</Label>
              <Input
                id="modo_pagamento_peca"
                placeholder="ex: Boleto, Transferência, Cartão"
                defaultValue={editingPeca?.modo_pagamento || ''}
              />
            </div>
            <div>
              <Label htmlFor="nota_fiscal_peca">Nota Fiscal</Label>
              <Input
                id="nota_fiscal_peca"
                placeholder="ex: NF-000123"
                defaultValue={editingPeca?.nota_fiscal || ''}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="dados_pagamento_peca">Dados para Pagamento</Label>
              <Textarea
                id="dados_pagamento_peca"
                placeholder="Banco: XXX | Agência: 0000-0 | Conta: 00000-0"
                defaultValue={editingPeca?.dados_pagamento || ''}
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <Button variant="outline" onClick={() => setShowPecaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowPecaDialog(false)}>
              Salvar Peça
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
