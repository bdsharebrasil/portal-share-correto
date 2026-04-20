// components/ExportButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { FlightEntry, LogbookMonth } from '../types';
import { exportToPDF } from '../utils/pdf-export';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  entries: FlightEntry[];
  logbookMonth: LogbookMonth | null;
  aircraftRegistration: string;
}

export function ExportButton({
  entries,
  logbookMonth,
  aircraftRegistration,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (!logbookMonth) {
      toast({
        title: 'Erro',
        description: 'Dados do mês não encontrados.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      await exportToPDF(entries, logbookMonth, aircraftRegistration);
      toast({
        title: 'Sucesso',
        description: 'PDF exportado com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao exportar PDF.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={exporting || entries.length === 0}
      variant="outline"
      className="gap-2"
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Exportar PDF
        </>
      )}
    </Button>
  );
}