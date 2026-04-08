import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Loader2 } from 'lucide-react';
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
  availableMonths = [],
  entries = [],
  currentMonth = new Date().getMonth() + 1,
  currentYear = new Date().getFullYear(),
  crewMembers = [],
  clients = [],
  clientPartners = {}
}) => {
  const [selectedMonths, setSelectedMonths] = useState<Array<{ month: number; year: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const safeAvailableMonths = Array.isArray(availableMonths) ? availableMonths : [];
      const currentMonthData = safeAvailableMonths.find(
        m => m.month === currentMonth && m.year === currentYear
      );
      if (currentMonthData) {
        setSelectedMonths([currentMonthData]);
      } else if (safeAvailableMonths.length > 0) {
        setSelectedMonths([safeAvailableMonths[0]]);
      } else {
        setSelectedMonths([]);
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
    const safeAvailableMonths = Array.isArray(availableMonths) ? availableMonths : [];
    setSelectedMonths([...safeAvailableMonths]);
  };

  const clearSelection = () => {
    setSelectedMonths([]);
  };

  // Enrich entries with crew member names, client names, and partner names
  const enrichEntries = (rawEntries: any[]) => {
    const crewMap = new Map<string, string>();
    crewMembers.forEach((c: any) => {
      crewMap.set(c.id, c.full_name || c.nome || '');
    });

    const clientMap = new Map<string, string>();
    clients.forEach((c: any) => {
      clientMap.set(c.id, c.razao_social || c.nome || '');
    });

    return rawEntries.map(entry => {
      // Resolve partner name from client_partner_id
      let resolvedPartnerName = entry.nome_socio || '';
      if (entry.socio_cliente_id_id && clientPartners[entry.socio_cliente_id_id]) {
        resolvedPartnerName = clientPartners[entry.socio_cliente_id_id].nome_socio || resolvedPartnerName;
      }

      // Determine which client to use: loan recipient if is_loan, otherwise original client
      let displayVooPara = '';

      if (entry.is_loan && entry.loan_recipient_client_id) {
        // Resolve loan recipient client name
        const loanRecipientName = clientMap.get(entry.loan_recipient_client_id) || entry.loan_recipient_client_name || '';
        const clientName = clientMap.get(entry.cliente_id) || entry.client_company_name || '';

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
        const clientName = clientMap.get(entry.cliente_id) || entry.client_company_name || '';
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

  const handleExport = async () => {
    if (selectedMonths.length === 0) {
      toast.error('Selecione pelo menos um mês para exportar');
      return;
    }

    setIsLoading(true);
    try {
      const sortedMonths = [...selectedMonths].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const enrichedEntries = enrichEntries(entries);

      await downloadLogbookPDF({
        months: sortedMonths,
        aeronaveRegistration: aircraftRegistration,
        aeronaveModel: aircraftModel,
        clientName: clientName || 'Não especificado',
        entries: enrichedEntries,
        logoUrl: '/logo.share.png'
      });

      toast.success('PDF exportado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsLoading(false);
    }
  };

  // Agrupar meses por ano - garantir que availableMonths é um array válido
  const safeAvailableMonths = Array.isArray(availableMonths) ? availableMonths : [];

  const monthsByYear = safeAvailableMonths.reduce((acc, m) => {
    if (!acc[m.year]) {
      acc[m.year] = [];
    }
    if (m.month) {
      acc[m.year].push(m.month);
    }
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
          <div className="p-3 bg-slate-90 rounded-lg">
            <p className="text-sm font-semibold text-slate-150">{aircraftRegistration}</p>
            {aircraftModel && (
              <p className="text-xs text-slate-300">{aircraftModel}</p>
            )}
          </div>

          <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
            {yearsInOrder.map(year => (
              <div key={year} className="mb-4">
                <h4 className="font-semibold text-sm text-slate-400 mb-2">{year}</h4>
                <div className="space-y-2 pl-2">
                  {(monthsByYear[year] || [])
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

          <div className="p-2 bg-blue-60 rounded text-xs text-blue-600">
            {selectedMonths.length === 0 ? (
              <p>Nenhum mês selecionado</p>
            ) : (
              <p>
                {selectedMonths.length} mês(es) selecionado(s):
                {' '}
                {selectedMonths
                  .sort((a, b) => {
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                  })
                  .map(m => `${MONTHS[m.month - 1]}/${m.year}`)
                  .join(', ')}
              </p>
            )}
          </div>
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
