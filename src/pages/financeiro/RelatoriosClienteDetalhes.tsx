import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Trash2, Search, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { downloadPDF, previewPDFForPrint } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import { calculateReportTotals } from '@/lib/travelReportUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TravelReport = {
  matricula_aeronave: string;
  observacoes: string;
  id?: string;
  numero_relatorio: string;
  clientes_id: string;
  client: string;
  aeronave_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_id2: string;
  crew_member_name2: string;
  rota: string;
  data_inicio: string;
  data_fim: string;
  dias_count: number;
  observations: string;
  expenses: any[];
  total_amount: number;
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1: number;
  total_crew2: number;
  total_client: number;
  total_sharebrasil: number;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
  pdf_url?: string;
  created_at?: string;
  updated_at?: string;
};

export default function RelatoriosClienteDetalhes() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = (location.state as any) || {};
  const [clientName, setClientName] = useState<string>('');
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [searchNumber, setSearchNumber] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<string>(navigationState.clientPartner || '');

  useEffect(() => {
    if (clientId) {
      loadReports();
    }
  }, [clientId]);

  const loadReports = async () => {
    if (!clientId) return;

    try {
      setLoading(true);

      // Get client name first
      const { data: clientData } = await supabase
        .from('clientes')
        .select('razao_social')
        .eq('id', clientId)
        .single();

      if (clientData) {
        setClientName(clientData.razao_social);
      }

      // Get reports for this client
      const { data, error } = await supabase
        .from('travel_expense_reports')
        .select(`
          *,
          clientes_id_rel:clientes_id(razao_social),
          partner_id_rel:socios_id(nome)
        `)
        .eq('clientes_id', clientId)
        .in('status', ['Finalizado', 'Enviado'])
        .order('data_inicio', { ascending: false });

      if (error) {
        toast.error('❌ Erro ao carregar relatórios');
        return;
      }

      const reportsWithDefaults = (data || []).map((r: any) => {
        const expenses = (() => {
          try {
            if (typeof r.despesas === 'string') {
              return JSON.parse(r.despesas);
            }
            return r.despesas || [];
          } catch {
            return [];
          }
        })();

        const clientName = r.socios_id && r.partner_id_rel?.nome
          ? r.partner_id_rel.nome
          : r.clientes_id_rel?.razao_social || '';

        return {
          ...r,
          client: clientName,
          expenses: expenses,
          status: r.status,
          total_amount: r.total_valor ?? 0,
          total_fuel: r.total_combustivel ?? 0,
          total_lodging: r.total_hospedagem ?? 0,
          total_food: r.total_alimentacao ?? 0,
          total_transport: r.total_transporte ?? 0,
          total_other: r.total_outros ?? 0,
          total_crew: r.total_tripulacao ?? 0,
          total_crew1: r.total_trip ?? 0,
          total_crew2: r.total_trip2 ?? 0,
          total_client: r.total_clientes ?? 0,
          total_sharebrasil: r.total_sharebrasil ?? 0,
          crew_member_name: r.nome_tripulante || '',
          crew_member_name2: r.nome_tripulante_2 || '',
          crew_member_id: r.tripulacao_id || '',
          crew_member_id2: r.tripulante_id2 || '',
          aircraft_registration: r.matricula_aeronave || '',
          observations: r.observacoes || '',
        };
      });

      setReports(reportsWithDefaults as TravelReport[]);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('❌ Erro ao carregar relatórios.');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Filter by partner if one is selected
      if (selectedPartner && report.client !== selectedPartner) {
        return false;
      }

      // Filter by report number
      if (searchNumber && !report.numero_relatorio.toLowerCase().includes(searchNumber.toLowerCase())) {
        return false;
      }

      // Filter by month and year
      if (selectedMonth || selectedYear) {
        const reportDate = parseISO(report.data_inicio);
        const reportMonth = (reportDate.getMonth() + 1).toString();
        const reportYear = reportDate.getFullYear().toString();

        if (selectedMonth && reportMonth !== selectedMonth) {
          return false;
        }

        if (selectedYear && reportYear !== selectedYear) {
          return false;
        }
      }

      return true;
    });
  }, [reports, searchNumber, selectedMonth, selectedYear, selectedPartner]);

  const partners = useMemo(() => {
    const partnerSet = new Set<string>();
    reports.forEach(report => {
      if (report.client) {
        partnerSet.add(report.client);
      }
    });
    return Array.from(partnerSet).sort();
  }, [reports]);

  const months = useMemo(() => {
    const monthSet = new Set<string>();
    reports.forEach(report => {
      const month = (parseISO(report.data_inicio).getMonth() + 1).toString();
      monthSet.add(month);
    });
    return Array.from(monthSet).sort();
  }, [reports]);

  const years = useMemo(() => {
    const yearSet = new Set<string>();
    reports.forEach(report => {
      const year = parseISO(report.data_inicio).getFullYear().toString();
      yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [reports]);

  const handleViewPDF = async (reportId: string) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      const correctedTotals = calculateReportTotals(report.expenses || []);
      const pdfReport: PDFTravelReport = {
        numero: report.numero_relatorio,
        cliente_nome: report.client,
        aeronave: report.aircraft_registration || report.matricula_aeronave || '',
        tripulante: report.crew_member_name,
        tripulante2: report.crew_member_name2,
        trecho: report.rota,
        destino: report.rota,
        data_inicio: report.data_inicio,
        data_fim: report.data_fim,
        observacoes: report.observacoes || report.observations || '',
        despesas: (report.expenses || []).map(e => ({
          categoria: e.category || e.categoria || 'Outros',
          descricao: e.description || e.descricao || 'N/A',
          valor: parseFloat(String(e.amount || e.valor || 0)),
          pago_por: e.paid_by || e.pago_por || 'N/A',
          data: (e.expense_date || e.data || '') as string,
          comprovante_url: e.receipt_url || e.comprovante_url || ''
        })) as TravelExpense[],
        total_combustivel: report.total_fuel || correctedTotals.total_fuel,
        total_hospedagem: report.total_lodging || correctedTotals.total_lodging,
        total_alimentacao: report.total_food || correctedTotals.total_food,
        total_transporte: report.total_transport || correctedTotals.total_transport,
        total_outros: report.total_other || correctedTotals.total_other,
        total_tripulante: report.total_crew || correctedTotals.total_crew,
        total_tripulante1: report.total_crew1 || correctedTotals.total_crew1,
        total_tripulante2: report.total_crew2 || correctedTotals.total_crew2,
        total_cliente: report.total_client || correctedTotals.total_client,
        total_sharebrasil: report.total_sharebrasil || correctedTotals.total_sharebrasil,
        valor_total: report.total_amount || correctedTotals.total_amount
      };

      let userName = 'Usuário';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.full_name) {
          userName = user.user_metadata.full_name;
        } else if (user?.email) {
          userName = user.email.split('@')[0];
        } else if (user?.id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (profile?.full_name) userName = profile.full_name;
        }
      } catch (error) {
        console.warn('Erro ao buscar nome do usuário:', error);
      }

      await previewPDFForPrint(pdfReport, userName);
    } catch (error) {
      console.error('Erro ao visualizar PDF:', error);
      toast.error('Erro ao visualizar relatório');
    }
  };

  const handleDelete = async (reportId?: string) => {
    if (!reportId || !window.confirm('⚠ Tem certeza que deseja excluir este relatório?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('travel_expense_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast.success('✓ Relatório excluído com sucesso!');
      loadReports();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast.error('❌ Erro ao excluir o relatório.');
    }
  };

  const statusBadgeColors: Record<TravelReport['status'], string> = {
    'Rascunho': 'bg-amber-100/80 text-amber-800 ring-amber-200',
    'Finalizado': 'bg-blue-100/80 text-blue-800 ring-blue-200',
    'Enviado': 'bg-green-100/80 text-green-800 ring-green-200',
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/financeiro/relatorio-viagem')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{clientName}</h1>
            <p className="text-muted-foreground">Relatórios de viagem do cliente</p>
          </div>
        </div>

        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-bold text-foreground mb-4">Filtros</CardTitle>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              {/* Search by report number */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Buscar por número
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ex: REL-GAS-001/26"
                    value={searchNumber}
                    onChange={(e) => setSearchNumber(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filter by partner (if multiple partners) */}
              {partners.length > 1 && (
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Cotista/Parceiro
                  </label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os cotas" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map(partner => (
                        <SelectItem key={partner} value={partner}>
                          {partner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filter by month */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Mês
                </label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month} value={month}>
                        {new Date(2024, parseInt(month) - 1).toLocaleString('pt-BR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter by year */}
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Ano
                </label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear filters button */}
              <Button
                variant="outline"
                onClick={() => {
                  setSearchNumber('');
                  setSelectedMonth('');
                  setSelectedYear(new Date().getFullYear().toString());
                  setSelectedPartner('');
                }}
                className="w-full md:w-auto"
              >
                Limpar Filtros
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-md rounded-xl border-border/50">
          <CardHeader className="p-6">
            <CardTitle className="text-xl font-bold text-foreground">
              Relatórios ({filteredReports.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg">Carregando...</div>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-center text-muted-foreground font-medium">Nenhum relatório encontrado</p>
                <p className="text-center text-muted-foreground text-sm">Ajuste os filtros e tente novamente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map(report => (
                  <div
                    key={report.id}
                    className={cn(
                      "flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-border group border-l-4"
                    )}
                    style={{
                      borderLeftColor: report.status === 'Enviado' ? '#10b981' : '#3b82f6'
                    }}
                  >
                    <div className="mb-3 sm:mb-0 min-w-[240px] flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground text-base">{report.numero_relatorio}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("inline-block text-xs font-bold px-3 py-1 rounded-full ring-1", statusBadgeColors[report.status])}>
                              {report.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {report.matricula_aeronave}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {format(parseISO(report.data_inicio), "dd MMM", { locale: ptBR })} a {format(parseISO(report.data_fim), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground/70 font-medium">Total</p>
                        <p className="font-bold text-lg text-green-600 font-mono">
                          R$ {report.total_amount.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="flex gap-1 ml-auto sm:ml-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPDF(report.id!)}
                          title="Visualizar Relatório"
                          className="rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                          title="Excluir Relatório"
                          className="rounded-lg transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
