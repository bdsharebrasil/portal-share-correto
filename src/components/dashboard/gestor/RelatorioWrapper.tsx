import { ReactNode, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { exportElementToPDF, createFilenameWithTimestamp } from '@/utils/exportToPDF';
import { useState } from 'react';
import { toast } from 'sonner';

interface RelatorioWrapperProps {
  id: string;
  title: string;
  children: ReactNode;
  onExport?: (filename: string) => void;
}

export function RelatorioWrapper({ id, title, children, onExport }: RelatorioWrapperProps) {
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const filename = createFilenameWithTimestamp(title.replace(/\s+/g, '_').toLowerCase());
      
      await exportElementToPDF(id, {
        filename,
        title,
        includeTimestamp: true,
        orientation: 'portrait'
      });

      toast.success(`Relatório "${title}" exportado com sucesso!`);
      onExport?.(filename);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar relatório para PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button
          onClick={handleExportPDF}
          disabled={isExporting}
          size="sm"
          className="gap-2"
          variant="outline"
        >
          {isExporting ? (
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
      </div>
      
      <div
        ref={contentRef}
        id={id}
        className="bg-card rounded-lg border border-border p-6 overflow-auto"
      >
        {children}
      </div>
    </div>
  );
}
