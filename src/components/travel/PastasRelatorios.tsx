import { useMemo, useState } from 'react';
import { Folder, FileText, Send, Edit, Eye, Trash2, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AircraftFolderButton } from './AircraftFolderButton';
import { SearchInput } from './SearchInput';

export interface PastaReportItem {
  id?: string;
  report_number: string;
  client: string;
  aircraft_registration: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
}

interface PastasRelatoriosProps {
  reports: PastaReportItem[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string | undefined) => void;
  onSend: (report: PastaReportItem) => void;
}

const statusBadgeColors: Record<PastaReportItem['status'], string> = {
  Rascunho: 'bg-amber-100/80 text-amber-800 ring-amber-200',
  Finalizado: 'bg-blue-100/80 text-blue-800 ring-blue-200',
  Enviado: 'bg-green-100/80 text-green-800 ring-green-200',
};

export function PastasRelatorios({ reports, onView, onEdit, onDelete, onSend }: PastasRelatoriosProps) {
  const [openAircraft, setOpenAircraft] = useState<Record<string, boolean>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Estrutura: cliente -> matrícula -> relatórios
  const tree = useMemo(() => {
    const map = new Map<string, Map<string, PastaReportItem[]>>();
    for (const r of reports) {
      const c = (r.client || 'Sem Cliente').trim();
      const a = (r.aircraft_registration || 'Sem Aeronave').trim().toUpperCase();
      if (!map.has(c)) map.set(c, new Map());
      const aMap = map.get(c)!;
      if (!aMap.has(a)) aMap.set(a, []);
      aMap.get(a)!.push(r);
    }
    return Array.from(map.entries())
      .map(([client, aMap]) => ({
        client,
        numAircraft: aMap.size,
        totalReports: Array.from(aMap.values()).reduce((s, l) => s + l.length, 0),
        aircraft: Array.from(aMap.entries())
          .map(([reg, list]) => ({
            reg,
            reports: [...list].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')),
          }))
          .sort((a, b) => a.reg.localeCompare(b.reg)),
      }))
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [reports]);

  const toggleAircraft = (key: string) => setOpenAircraft(p => ({ ...p, [key]: !p[key] }));

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Folder className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Nenhum relatório encontrado.</p>
      </div>
    );
  }

  // View dedicada por cliente
  if (selectedClient) {
    const clientData = tree.find(t => t.client === selectedClient);
    if (!clientData) return null;

    // Filtrar relatórios baseado na busca
    const filteredAircraft = clientData.aircraft.map(aircraft => ({
      ...aircraft,
      reports: aircraft.reports.filter(report => {
        const searchLower = searchQuery.toLowerCase();
        return (
          report.report_number.toLowerCase().includes(searchLower) ||
          report.aircraft_registration.toLowerCase().includes(searchLower) ||
          report.start_date.includes(searchQuery) ||
          report.total_amount.toString().includes(searchQuery) ||
          report.status.toLowerCase().includes(searchLower)
        );
      }),
    })).filter(aircraft => aircraft.reports.length > 0);

    return (
      <div className="space-y-6">
        {/* Header com botão voltar e busca */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedClient(null);
              setSearchQuery('');
              setClientSearchQuery('');
            }}
            className="gap-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h2 className="text-2xl font-bold text-foreground">{selectedClient}</h2>
          <span className="ml-auto text-sm text-muted-foreground">
            {clientData.numAircraft} {clientData.numAircraft === 1 ? 'aeronave' : 'aeronaves'} · {clientData.totalReports} {clientData.totalReports === 1 ? 'relatório' : 'relatórios'}
          </span>
        </div>

        {/* Filtro de busca */}
        <div className="flex justify-center">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por número, data, valor..."
          />
        </div>

        {/* Pastas por aeronave */}
        {filteredAircraft.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum relatório encontrado</p>
            <p className="text-muted-foreground text-sm">Tente usar outro termo de busca</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAircraft.map(({ reg, reports: list }) => {
              const key = `${selectedClient}::${reg}`;
              const acOpen = !!openAircraft[key];
              return (
                <div key={key} className="space-y-3">
                  {/* Botão de pasta com animação 3D */}
                  <AircraftFolderButton
                    label={reg}
                    count={list.length}
                    isOpen={acOpen}
                    onClick={() => toggleAircraft(key)}
                  />

                  {/* Lista de relatórios da aeronave */}
                  {acOpen && (
                    <div className="space-y-2 ml-4">
                      {list.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/40 hover:border-border/60 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground">{report.report_number}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={cn('inline-block text-xs font-bold px-2 py-0.5 rounded-full ring-1', statusBadgeColors[report.status])}>
                                {report.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(report.start_date), 'dd MMM', { locale: ptBR })} a{' '}
                                {format(parseISO(report.end_date), 'dd MMM yyyy', { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground/80 mt-1 font-mono">
                              R$ {report.total_amount.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {report.status === 'Finalizado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onSend(report)}
                                title="Enviar ao Cliente"
                                className="h-8 w-8 p-0 text-emerald-500 hover:bg-emerald-500/15"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {report.status === 'Rascunho' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onEdit(report.id!)}
                                title="Editar"
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/15"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onView(report.id!)}
                              title="Visualizar"
                              className="h-8 w-8 p-0 text-primary hover:bg-primary/15"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(report.id)}
                              title="Excluir"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/15"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // View principal com grid de pastas de clientes
  const filteredTree = tree.filter(({ client }) =>
    client.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* SearchInput no topo da lista de clientes */}
      <div className="flex justify-center">
        <SearchInput
          value={clientSearchQuery}
          onChange={setClientSearchQuery}
          placeholder="Buscar cliente..."
        />
      </div>

      {/* Grid de pastas */}
      {filteredTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum cliente encontrado</p>
          <p className="text-muted-foreground text-sm">Tente usar outro termo de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredTree.map(({ client, numAircraft, totalReports }) => (
            <button
              key={client}
              onClick={() => setSelectedClient(client)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200"
            >
              {/* Ícone de pasta estilizado */}
              <div className="w-24 h-20 relative group-hover:scale-105 transition-transform duration-200">
                <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 25 L10 15 Q10 8 17 8 L42 8 Q46 8 48 12 L54 22 Q56 25 60 25 Z" fill="#06b6d4" opacity="0.9" />
                  <rect x="6" y="25" width="108" height="68" rx="8" fill="#06b6d4" />
                </svg>
              </div>
              <div className="text-center w-full">
                <p className="text-sm font-semibold text-foreground truncate">{client}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {numAircraft} {numAircraft === 1 ? 'aeronave' : 'aeronaves'} • {totalReports} {totalReports === 1 ? 'relatório' : 'relatórios'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
