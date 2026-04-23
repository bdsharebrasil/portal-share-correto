// @ts-nocheck
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, FileText, Eye, ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Client {
  id: string;
  razao_social: string;
  status?: string | null;
}

interface TravelReport {
  id: string;
  numero_relatorio: string;
  clientes_id: string;
  matricula_aeronave: string;
  nome_tripulante: string;
  nome_tripulante_2?: string;
  rota: string;
  data_inicio: string;
  data_fim: string;
  total_valor: number;
  created_at: string;
  aeronave_id: string;
}

interface TravelReportsFolderProps {
  searchTerm?: string;
}

interface AircraftFolder {
  registration: string;
  matricula: string;
  count: number;
}

export function TravelReportsFolder({ searchTerm = '' }: TravelReportsFolderProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<string | null>(null);
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [aircrafts, setAircrafts] = useState<AircraftFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadClients();
    loadHistory();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('id, razao_social')
      .order('razao_social');

    if (error) {
      toast.error("Erro ao carregar clientes");
      console.error(error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const isActive = (status?: string | null) => {
    const s = String(status ?? '').toLowerCase();
    return s === 'ativa' || s === 'active' || s === '';
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('travel_expense_reports')
        .select('id, numero_relatorio, created_at')
        .not('numero_relatorio', 'is', null)
        .order('created_at', { ascending: false });
      if (!error) setHistory(data || []);
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewHistory = async (item: any) => {
    try {
      const { data } = await supabase.storage.from('travel-reports').createSignedUrl(item.pdf_path, 60 * 60 * 24 * 7);
      const url = data?.signedUrl;
      if (url) window.open(url, '_blank');
    } catch (e) {
      toast.error('Não foi possível abrir o PDF');
    }
  };

  const downloadHistory = async (item: any) => {
    try {
      const { data } = await supabase.storage.from('travel-reports').createSignedUrl(item.pdf_path, 60 * 60 * 24 * 7);
      const url = data?.signedUrl;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(item.numero || 'relatorio').replace(/\\/g, '-').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error('Não foi possível baixar o PDF');
    }
  };

  const loadAircraftsByClient = async (clientId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_expense_reports')
        .select('matricula_aeronave, aeronave_id')
        .eq('clientes_id', clientId)
        .eq('status', 'finalizado')
        .not('matricula_aeronave', 'is', null);

      if (error) {
        toast.error("Erro ao carregar aeronaves");
        console.error(error);
      } else {
        // Agrupar por aeronave e contar relatórios
        const aircraftMap = new Map<string, { registration: string; matricula: string; count: number }>();

        data?.forEach((report) => {
          const key = report.matricula_aeronave || 'Sem Aeronave';
          if (aircraftMap.has(key)) {
            const existing = aircraftMap.get(key)!;
            existing.count += 1;
          } else {
            aircraftMap.set(key, {
              registration: report.aeronave_id || '',
              matricula: key,
              count: 1,
            });
          }
        });

        setAircrafts(Array.from(aircraftMap.values()).sort((a, b) => a.matricula.localeCompare(b.matricula)));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadReportsByClientAndAircraft = async (clientId: string, aircraftMatricula: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('travel_expense_reports')
        .select('*')
        .eq('clientes_id', clientId)
        .eq('matricula_aeronave', aircraftMatricula)
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Erro ao carregar relatórios");
        console.error(error);
      } else {
        setReports(data as any || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setSelectedAircraft(null);
    loadAircraftsByClient(client.id);
  };

  const handleAircraftClick = (aircraft: AircraftFolder) => {
    if (!selectedClient) return;
    setSelectedAircraft(aircraft.matricula);
    loadReportsByClientAndAircraft(selectedClient.id, aircraft.matricula);
  };

  const handleBack = () => {
    if (selectedAircraft) {
      setSelectedAircraft(null);
      setReports([]);
    } else {
      setSelectedClient(null);
      setAircrafts([]);
      setReports([]);
    }
  };

  const handleViewPDF = async (reportId: string) => {
    try {
      toast.info("Gerando relatório...");

      const { data, error } = await supabase.functions.invoke('generate-travel-pdf', {
        body: { reportId }
      });

      if (error) throw error;

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.documento.write(data as string);
        newWindow.documento.close();
      }

      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Erro ao gerar relatório");
    }
  };

  const handleDownloadPDF = async (reportId: string, reportNumber: string) => {
    try {
      toast.info("Preparando download...");

      const { data, error } = await supabase.functions.invoke('generate-travel-pdf', {
        body: { reportId }
      });

      if (error) throw error;

      const blob = new Blob([data as string], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportNumber.replace(/\//g, '-')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Arquivo baixado! Abra no navegador e use Ctrl+P para imprimir como PDF");
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Erro ao baixar arquivo");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  // Visualização de Relatórios (Cliente > Aeronave > Relatórios)
  if (selectedClient && selectedAircraft) {
    return (
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="text-xs text-muted-foreground">{selectedClient.razao_social}</div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {selectedAircraft}
                </CardTitle>
              </div>
            </div>
            <Badge variant="outline">
              {reports.length} {reports.length === 1 ? 'relatório' : 'relatórios'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : reports.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum relatório encontrado para esta aeronave
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent transition-smooth"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground">{report.numero_relatorio}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {report.nome_tripulante} {report.nome_tripulante_2 ? `/ ${report.nome_tripulante_2}` : ''} • {report.rota}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(report.data_inicio)} - {formatDate(report.data_fim)} • {formatCurrency(report.total_valor || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPDF(report.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(report.id, report.numero_relatorio || 'relatorio')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Visualização de Aeronaves (Cliente > Aeronaves)
  if (selectedClient && !selectedAircraft) {
    return (
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                {selectedClient.razao_social}
              </CardTitle>
            </div>
            <Badge variant="outline">
              {aircrafts.length} {aircrafts.length === 1 ? 'aeronave' : 'aeronaves'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : aircrafts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhuma aeronave encontrada para este cliente
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aircrafts.map((aircraft) => (
                <button
                  key={aircraft.matricula}
                  onClick={() => handleAircraftClick(aircraft)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent hover:border-primary transition-smooth text-left group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-smooth">
                    <FolderOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                      {aircraft.matricula}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {aircraft.count} {aircraft.count === 1 ? 'relatório' : 'relatórios'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Filtro por busca
  const filteredClients = searchTerm
    ? clients.filter((c) =>
      c.razao_social.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : clients;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Pastas por Cliente ({filteredClients.length} clientes ativos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente ativo'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent hover:border-primary transition-smooth text-left group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-smooth">
                    <FolderOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                      {client.razao_social}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Clique para ver relatórios
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Histórico de PDFs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum PDF gerado</p>
          ) : (
            <div className="space-y-2">
              {history.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="font-semibold text-foreground">{item.numero}</div>
                    <div className="text-sm text-muted-foreground">{item.cliente_nome} • {new Date(item.criado_em).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewHistory(item)}>
                      <Eye className="h-4 w-4 mr-1" /> Visualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadHistory(item)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
