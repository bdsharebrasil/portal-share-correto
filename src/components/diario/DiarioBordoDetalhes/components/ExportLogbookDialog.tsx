import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Loader2, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { downloadLogbookPDF } from '@/lib/logbookPdfExport';
import { toast } from 'sonner';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface ExportLogbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  aircraftModel?: string;
  clientName?: string;
  availableMonths: Array<{ month: number; year: number }>;
  entries: any[];
  currentMonth: number;
  currentYear: number;
  crewMembers?: any[];
  clients?: any[];
  clientPartners?: Record<string, any>;
}

export const ExportLogbookDialog: React.FC<ExportLogbookDialogProps> = ({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  aircraftModel,
  clientName,
  availableMonths,
  entries,
  currentMonth,
  currentYear,
  crewMembers = [],
  clients = [],
  clientPartners = {}
}) => {
  const [selectedMonths, setSelectedMonths] = useState<Array<{ month: number; year: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    details?: string;
    months: Array<{ month: number; year: number }>;
    timestamp: string;
  } | null>(null);
  const [successState, setSuccessState] = useState<{
    months: Array<{ month: number; year: number }>;
    entriesCount: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      const currentMonthData = availableMonths.find(
        m => m.month === currentMonth && m.year === currentYear
      );
      if (currentMonthData) {
        setSelectedMonths([currentMonthData]);
      } else if (availableMonths.length > 0) {
        setSelectedMonths([availableMonths[0]]);
      }
    }
  }, [open, currentMonth, currentYear, availableMonths]);

  const toggleMonth = (month: number, year: number) => {
    setSelectedMonths(prev => {
      const exists = prev.some(m => m.month === month && m.year === year);
      if (exists) {
        return prev.filter(m => !(m.month === month && m.year === year));
      } else {
        return [...prev, { month, year }];
      }
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths([...availableMonths]);
  };

  const clearSelection = () => {
    setSelectedMonths([]);
  };

  // Enrich entries with crew member names, client names, and partner names
  const enrichEntries = (rawEntries: any[]) => {
    const crewMap = new Map<string, string>();
    crewMembers.forEach((c: any) => {
      crewMap.set(c.id, c.full_name || c.name || '');
    });

    const clientMap = new Map<string, string>();
    clients.forEach((c: any) => {
      clientMap.set(c.id, c.company_name || c.name || '');
    });

    return rawEntries.map(entry => {
      // Resolve partner name from client_partner_id
      let resolvedPartnerName = entry.partner_name || '';
      if (entry.client_partner_id && clientPartners[entry.client_partner_id]) {
        resolvedPartnerName = clientPartners[entry.client_partner_id].partner_name || resolvedPartnerName;
      }

      // Determine which client to use: loan recipient if is_loan, otherwise original client
      let displayVooPara = '';

      if (entry.is_loan && entry.loan_recipient_client_id) {
        // Resolve loan recipient client name
        const loanRecipientName = clientMap.get(entry.loan_recipient_client_id) || entry.loan_recipient_client_name || '';
        const clientName = clientMap.get(entry.client_id) || entry.client_company_name || '';

        if (loanRecipientName && clientName) {
          // Show format: "OWNER → RECIPIENT"
          const ownerAbbr = clientName.split(' ')[0];
          const recipientAbbr = loanRecipientName.split(' ')[0];
          displayVooPara = `${ownerAbbr} → ${recipientAbbr}`;
        } else {
          displayVooPara = loanRecipientName || clientName;
        }
      } else {
        // Regular flight: show client and partner if applicable
        const clientName = clientMap.get(entry.client_id) || entry.client_company_name || '';
        displayVooPara = clientName;
        if (resolvedPartnerName && clientName) {
          // Abbreviate client name (first word) + partner first name
          const clientAbbr = clientName.split(' ')[0];
          const partnerFirst = resolvedPartnerName.split(' ')[0];
          displayVooPara = `${clientAbbr} - ${partnerFirst}`;
        }
      }

      return {
        ...entry,
        pic_name: crewMap.get(entry.pic_canac) || entry.pic_name || '',
        client_company_name: displayVooPara || '',
        partner_name: resolvedPartnerName,
        loan_recipient_client_name: entry.is_loan ? (clientMap.get(entry.loan_recipient_client_id) || entry.loan_recipient_client_name || '') : '',
      };
    });
  };

  const formatMonthList = (months: Array<{ month: number; year: number }>) =>
    months
      .slice()
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      .map((m) => `${MONTHS[m.month - 1]}/${m.year}`)
      .join(', ');

  const handleExport = async () => {
    setErrorState(null);
    setSuccessState(null);

    if (selectedMonths.length === 0) {
      toast.error('Selecione pelo menos um mês para exportar');
      return;
    }

    const sortedMonths = [...selectedMonths].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    setIsLoading(true);

    // Validações detalhadas com feedback visual
    try {
      if (!aircraftRegistration) {
        throw new Error('Matrícula da aeronave não informada.');
      }

      const enrichedEntries = enrichEntries(entries);

      // Filtrar entradas que pertencem aos meses selecionados
      const monthsSet = new Set(
        sortedMonths.map((m) => `${m.year}-${m.month}`)
      );
      const matchingEntries = enrichedEntries.filter((e: any) => {
        if (!e.entry_date) return false;
        const d = new Date(e.entry_date);
        return monthsSet.has(`${d.getFullYear()}-${d.getMonth() + 1}`);
      });

      if (matchingEntries.length === 0) {
        throw new Error(
          `Nenhum lançamento de voo encontrado para os meses selecionados (${formatMonthList(
            sortedMonths
          )}). Verifique se há registros nesses períodos.`
        );
      }

      await downloadLogbookPDF({
        months: sortedMonths,
        aircraftRegistration,
        aircraftModel,
        clientName: clientName || 'Não especificado',
        entries: enrichedEntries,
        logoUrl: '/logo.share.png',
      });

      setSuccessState({
        months: sortedMonths,
        entriesCount: matchingEntries.length,
      });
      toast.success(
        `PDF gerado com sucesso (${matchingEntries.length} voo${
          matchingEntries.length !== 1 ? 's' : ''
        })`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Erro ao exportar PDF:', err);
      setErrorState({
        message: err.message || 'Falha desconhecida ao gerar o PDF.',
        details: err.stack,
        months: sortedMonths,
        timestamp: new Date().toLocaleString('pt-BR'),
      });
      toast.error('Erro ao gerar PDF — veja os detalhes no diálogo');
    } finally {
      setIsLoading(false);
    }
  };

  const copyErrorToClipboard = async () => {
    if (!errorState) return;
    const text = [
      `Erro ao gerar PDF do Diário de Bordo`,
      `Data: ${errorState.timestamp}`,
      `Aeronave: ${aircraftRegistration}`,
      `Meses: ${formatMonthList(errorState.months)}`,
      `Mensagem: ${errorState.message}`,
      errorState.details ? `\nStack:\n${errorState.details}` : '',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Detalhes do erro copiados');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  // Agrupar meses por ano
  const monthsByYear = availableMonths.reduce((acc, m) => {
    if (!acc[m.year]) {
      acc[m.year] = [];
    }
    acc[m.year].push(m.month);
    return acc;
  }, {} as Record<number, number[]>);

  const yearsInOrder = Object.keys(monthsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Exportar Diário de Bordo em PDF</DialogTitle>
          <DialogDescription>
            Selecione o mês ou os meses que deseja exportar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-slate-100 rounded-lg">
            <p className="text-sm font-semibold text-slate-900">{aircraftRegistration}</p>
            {aircraftModel && (
              <p className="text-xs text-slate-600">{aircraftModel}</p>
            )}
          </div>

          <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
            {yearsInOrder.map(year => (
              <div key={year} className="mb-4">
                <h4 className="font-semibold text-sm text-slate-700 mb-2">{year}</h4>
                <div className="space-y-2 pl-2">
                  {monthsByYear[year]
                    .sort((a, b) => b - a)
                    .map(month => {
                      const isSelected = selectedMonths.some(
                        m => m.month === month && m.year === year
                      );
                      return (
                        <div
                          key={`${year}-${month}`}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`month-${year}-${month}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleMonth(month, year)}
                          />
                          <Label
                            htmlFor={`month-${year}-${month}`}
                            className="text-sm cursor-pointer"
                          >
                            {MONTHS[month - 1]}
                          </Label>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllMonths}
              className="text-xs"
            >
              Selecionar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="text-xs"
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="p-2 bg-muted rounded text-xs text-foreground">
            {selectedMonths.length === 0 ? (
              <p>Nenhum mês selecionado</p>
            ) : (
              <p>
                {selectedMonths.length} mês(es) selecionado(s):{' '}
                {formatMonthList(selectedMonths)}
              </p>
            )}
          </div>

          {/* Painel de erro detalhado */}
          {errorState && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">
                    Falha ao gerar o PDF
                  </p>
                  <p className="text-xs text-foreground/80 mt-1 break-words">
                    {errorState.message}
                  </p>
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    <p><span className="font-semibold">Aeronave:</span> {aircraftRegistration || '—'}</p>
                    <p><span className="font-semibold">Meses tentados:</span> {formatMonthList(errorState.months)}</p>
                    <p><span className="font-semibold">Quando:</span> {errorState.timestamp}</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={copyErrorToClipboard}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar detalhes
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setErrorState(null)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Painel de sucesso */}
          {successState && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    PDF gerado com sucesso
                  </p>
                  <p className="text-xs text-foreground/80 mt-1">
                    {successState.entriesCount} voo{successState.entriesCount !== 1 ? 's' : ''} • {formatMonthList(successState.months)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isLoading || selectedMonths.length === 0}
            className="bg-sky-500 hover:bg-sky-600"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
