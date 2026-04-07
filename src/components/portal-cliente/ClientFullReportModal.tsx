import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Plane, Fuel, DollarSign, Wrench, Calendar, TrendingUp, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientFullReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
  sharePercentage: number;
}

interface ReportData {
  client: {
    name: string;
    nome?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    telefone?: string;
  };
  aeronave?: any;
  aircraft: {
    registration: string;
    manufacturer: string;
    model: string;
    year: string;
    status: string;
    totalHours: number;
  };
  sharePercentage: number;
  financial: {
    totalReceitas: number;
    totalDespesas: number;
    saldo: number;
    pendente: number;
    reembolsoPendente: number;
  };
  flightActivity: {
    totalFlights: number;
    totalHours: number;
    totalLandings: number;
    recentDestinations: string[];
  };
  fuelRecords: {
    totalLitros: number;
    totalGasto: number;
    records: Array<{
      data: string;
      local: string;
      litros: number;
      valor: number;
    }>;
  };
  ctmItems: Array<{
    item: string;
    horasRestantes: number;
    ultimaTroca: string;
  }>;
  rateioData: Array<{
    data: string;
    descricao: string;
    valorTotal: number;
    valorCliente: number;
    percentual: number;
  }>;
  monthlyData: Array<{
    month: string;
    receitas: number;
    despesas: number;
  }>;
}

export function ClientFullReportModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  aircraftId,
  aircraftRegistration,
  sharePercentage
}: ClientFullReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && clientId && aircraftId) {
      loadReportData();
    }
  }, [open, clientId, aircraftId]);

  const loadReportData = async () => {
    try {
      setLoading(true);

      // Load client details
      const { data: clientData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clientId)
        .single();

      // Load aircraft details
      const { data: aircraftData } = await supabase
        .from('aeronave')
        .select('*')
        .eq('id', aircraftId)
        .single();

      // Load financial data from controle_bancario
      const { data: financialData } = await supabase
        .from('controle_bancario')
        .select('*')
        .eq('cliente_id', clientId)
        .eq('aeronave_id', aircraftId);

      // Load logbook entries
      const { data: logbookData } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .order('entry_date', { ascending: false });

      // Load fuel records
      const { data: fuelData } = await supabase
        .from('abastecimentos')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .eq('id_clientes', clientId)
        .order('data', { ascending: false });

      // Load CTM tracking
      const { data: ctmData } = await (supabase as any)
        .from('ctm_tracking')
        .select('*')
        .eq('aeronave_id', aircraftId);

      // Load rateio data
      const { data: rateioData } = await (supabase as any)
        .from('lancamentos_rateio')
        .select('*')
        .eq('cliente_id', clientId)
        .eq('aircraft_id', aircraftId)
        .order('data_lancamento', { ascending: false });

      // Calculate financial totals
      const receitas = (financialData || [])
        .filter(f => f.tipo_movimento === 'entrada')
        .reduce((sum, f) => sum + (f.valor || 0), 0);

      const despesas = (financialData || [])
        .filter(f => f.tipo_movimento === 'saida')
        .reduce((sum, f) => sum + (f.valor || 0), 0);

      const pendente = (financialData || [])
        .filter(f => f.status !== 'pago' && f.status !== 'confirmado')
        .reduce((sum, f) => sum + (f.valor || 0), 0);

      const reembolsoPendente = (financialData || [])
        .filter(f => f.reembolsavel && !f.reembolso_recebido)
        .reduce((sum, f) => sum + (f.valor || 0), 0);

      // Calculate flight activity
      const totalHours = (logbookData || []).reduce((sum, e) => sum + (e.total_time || 0), 0);
      const totalLandings = (logbookData || []).reduce((sum, e) => sum + (e.pousos || 0), 0);
      const destinations = [...new Set((logbookData || []).map(e => e.arrival_aerodrome).filter(Boolean))].slice(0, 10);

      // Calculate fuel totals
      const totalLitros = (fuelData || []).reduce((sum, f) => sum + (f.litros || 0), 0);
      const totalGasto = (fuelData || []).reduce((sum, f) => sum + (f.valor_total || 0), 0);

      // Calculate monthly data (last 6 months)
      const monthlyData: Array<{ month: string; receitas: number; despesas: number }> = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM/yyyy', { locale: ptBR });

        const monthReceitas = (financialData || [])
          .filter(f => f.tipo_movimento === 'entrada' && f.data?.startsWith(monthKey))
          .reduce((sum, f) => sum + (f.valor || 0), 0);

        const monthDespesas = (financialData || [])
          .filter(f => f.tipo_movimento === 'saida' && f.data?.startsWith(monthKey))
          .reduce((sum, f) => sum + (f.valor || 0), 0);

        monthlyData.push({ month: monthLabel, receitas: monthReceitas, despesas: monthDespesas });
      }

      setReportData({
        client: {
          name: clientData?.razao_social || clientName,
          cnpj: clientData?.cnpj,
          email: clientData?.email,
          phone: clientData?.telefone
        },
        aircraft: {
          registration: aircraftData?.matricula || aircraftRegistration,
          manufacturer: aircraftData?.fabricante || '',
          model: aircraftData?.modelo || '',
          year: aircraftData?.ano || '',
          status: aircraftData?.status || 'Operacional',
          totalHours: (aircraftData as any)?.cell_hours_current || totalHours
        },
        sharePercentage,
        financial: {
          totalReceitas: receitas,
          totalDespesas: despesas,
          saldo: receitas - despesas,
          pendente,
          reembolsoPendente
        },
        flightActivity: {
          totalFlights: logbookData?.length || 0,
          totalHours,
          totalLandings,
          recentDestinations: destinations as string[]
        },
        fuelRecords: {
          totalLitros,
          totalGasto,
          records: (fuelData || []).slice(0, 10).map(f => ({
            data: f.data,
            local: f.local,
            litros: f.litros,
            valor: f.valor_total || 0
          }))
        },
        ctmItems: (ctmData || []).map((c: any) => ({
          item: c.item_name || c.nome_item || '',
          horasRestantes: c.remaining_hours || c.horas_restantes || 0,
          ultimaTroca: c.last_change_date || c.data_ultima_troca || ''
        })),
        rateioData: (rateioData || []).slice(0, 10).map((r: any) => ({
          data: r.data_lancamento,
          descricao: r.descricao,
          valorTotal: r.valor_total || 0,
          valorCliente: r.valor_cliente || 0,
          percentual: r.percentual_cliente || sharePercentage
        })),
        monthlyData
      });

    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Erro ao carregar dados do relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || !reportData) return;

    try {
      setExporting(true);

      // Load html2pdf dynamically
      const loadHtml2Pdf = () => {
        return new Promise<any>((resolve, reject) => {
          if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js';
          script.async = true;
          script.onload = () => resolve((window as any).html2pdf);
          script.onerror = () => reject(new Error('Falha ao carregar html2pdf'));
          document.head.appendChild(script);
        });
      };

      const html2pdf = await loadHtml2Pdf();

      const opt = {
        margin: 10,
        filename: `relatorio-${(reportData.client.nome || reportData.client.name).replace(/\s+/g, '-')}-${reportData.aircraft?.registration || reportData.aeronave?.matricula || ''}-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(reportRef.current).save();
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-0 overflow-hidden">
        <div className="flex flex-row items-center justify-between p-4 pb-3 border-b bg-background sticky top-0 z-10">
          <DialogTitle className="text-xl font-bold">
            Relatório Completo - {clientName}
          </DialogTitle>
          <Button
            onClick={handleExportPDF}
            disabled={loading || exporting}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar PDF
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Gerando relatório...</p>
              </div>
            </div>
          ) : reportData ? (
            <div ref={reportRef} className="p-8 bg-white text-gray-800" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* Header */}
              <div className="text-center mb-8 pb-6 border-b-4 border-emerald-500">
                <img src="/logo.share.png" alt="Share Brasil" className="h-16 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-blue-900 mb-2">RELATÓRIO COMPLETO DO CLIENTE</h1>
                <p className="text-gray-600">Gerado em {format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>

              {/* Client & Aircraft Info */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <span className="text-emerald-500">●</span> Dados do Cliente
                  </h2>
                  <div className="space-y-2 text-sm">
                    <p><strong>Nome:</strong> {reportData.client.nome || reportData.client.name}</p>
                    {reportData.client.cnpj && <p><strong>CNPJ:</strong> {reportData.client.cnpj}</p>}
                    {reportData.client.email && <p><strong>Email:</strong> {reportData.client.email}</p>}
                    {reportData.client.telefone && <p><strong>Telefone:</strong> {reportData.client.telefone}</p>}
                    <p><strong>Percentual de Cota:</strong> <span className="text-emerald-600 font-bold">{reportData.sharePercentage}%</span></p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h2 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Plane className="h-5 w-5 text-emerald-500" /> Dados da Aeronave
                  </h2>
                  <div className="space-y-2 text-sm">
                    <p><strong>Prefixo:</strong> <span className="text-xl font-bold text-blue-900">{reportData.aircraft.registration}</span></p>
                    <p><strong>Modelo:</strong> {reportData.aircraft.manufacturer} {reportData.aircraft.model}</p>
                    <p><strong>Ano:</strong> {reportData.aircraft.year}</p>
                    <p><strong>Status:</strong> {reportData.aircraft.status}</p>
                    <p><strong>Horas Totais da Célula:</strong> <span className="font-bold">{reportData.aircraft.totalHours.toFixed(1)}h</span></p>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" /> Resumo Financeiro
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 text-center bg-green-50">
                    <p className="text-sm text-gray-600 mb-1">Total Receitas</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(reportData.financial.totalReceitas)}</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center bg-red-50">
                    <p className="text-sm text-gray-600 mb-1">Total Despesas</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(reportData.financial.totalDespesas)}</p>
                  </div>
                  <div className={`border rounded-lg p-4 text-center ${reportData.financial.saldo >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <p className="text-sm text-gray-600 mb-1">Saldo</p>
                    <p className={`text-xl font-bold ${reportData.financial.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(reportData.financial.saldo)}
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 text-center bg-yellow-50">
                    <p className="text-sm text-gray-600 mb-1">Pendente</p>
                    <p className="text-xl font-bold text-yellow-600">{formatCurrency(reportData.financial.pendente)}</p>
                  </div>
                </div>
              </div>

              {/* Monthly Chart as Table */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" /> Movimentação Mensal (Últimos 6 Meses)
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Mês</th>
                      <th className="border p-2 text-right">Receitas</th>
                      <th className="border p-2 text-right">Despesas</th>
                      <th className="border p-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyData.map((m, i) => (
                      <tr key={i}>
                        <td className="border p-2">{m.month}</td>
                        <td className="border p-2 text-right text-green-600">{formatCurrency(m.receitas)}</td>
                        <td className="border p-2 text-right text-red-600">{formatCurrency(m.despesas)}</td>
                        <td className={`border p-2 text-right font-bold ${m.receitas - m.despesas >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {formatCurrency(m.receitas - m.despesas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Flight Activity */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" /> Atividade de Voo
                </h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Total de Voos</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.flightActivity.totalFlights}</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Horas Voadas</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.flightActivity.totalHours.toFixed(1)}h</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Total de Pousos</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.flightActivity.totalLandings}</p>
                  </div>
                </div>
                {reportData.flightActivity.recentDestinations.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-gray-600">Destinos recentes:</span>
                    {reportData.flightActivity.recentDestinations.map((d, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 rounded text-sm">{d}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Fuel Records */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-emerald-500" /> Abastecimentos
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Total de Litros</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.fuelRecords.totalLitros.toLocaleString('pt-BR')} L</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Total Gasto</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(reportData.fuelRecords.totalGasto)}</p>
                  </div>
                </div>
                {reportData.fuelRecords.records.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Data</th>
                        <th className="border p-2 text-left">Local</th>
                        <th className="border p-2 text-right">Litros</th>
                        <th className="border p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.fuelRecords.records.map((r, i) => (
                        <tr key={i}>
                          <td className="border p-2">{formatDate(r.data)}</td>
                          <td className="border p-2">{r.local}</td>
                          <td className="border p-2 text-right">{r.litros.toLocaleString('pt-BR')} L</td>
                          <td className="border p-2 text-right">{formatCurrency(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* CTM / Maintenance */}
              {reportData.ctmItems.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-emerald-500" /> Controle de Manutenção (CTM)
                  </h2>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Item</th>
                        <th className="border p-2 text-right">Horas Restantes</th>
                        <th className="border p-2 text-left">Última Troca</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.ctmItems.map((c, i) => (
                        <tr key={i}>
                          <td className="border p-2">{c.item}</td>
                          <td className={`border p-2 text-right font-bold ${c.horasRestantes < 50 ? 'text-red-600' : c.horasRestantes < 100 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {c.horasRestantes.toFixed(1)}h
                          </td>
                          <td className="border p-2">{formatDate(c.ultimaTroca)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Rateio */}
              {reportData.rateioData.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-emerald-500" /> Rateio da Aeronave
                  </h2>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Data</th>
                        <th className="border p-2 text-left">Descrição</th>
                        <th className="border p-2 text-right">Valor Total</th>
                        <th className="border p-2 text-right">%</th>
                        <th className="border p-2 text-right">Valor Cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rateioData.map((r, i) => (
                        <tr key={i}>
                          <td className="border p-2">{formatDate(r.data)}</td>
                          <td className="border p-2">{r.descricao}</td>
                          <td className="border p-2 text-right">{formatCurrency(r.valorTotal)}</td>
                          <td className="border p-2 text-right">{r.percentual}%</td>
                          <td className="border p-2 text-right font-bold">{formatCurrency(r.valorCliente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
                <p>Share Brasil - Gestão de Aeronaves Compartilhadas</p>
                <p>Este relatório foi gerado automaticamente e reflete os dados até a data de emissão.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Erro ao carregar relatório</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
