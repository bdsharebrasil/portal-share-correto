import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Plus, FileText, Trash2 } from 'lucide-react';
import type { RAS } from '@/types/maintenance';
import { cn } from '@/lib/utils';

interface RASListProps {
  items: RAS[];
  onView: (ras: RAS) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200' },
  em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
};

export function RASList({ items, onView, onNew, onDelete }: RASListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const sortedItems = [...items].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja deletar este RAS?')) {
      setDeleting(id);
      try {
        await onDelete?.(id);
      } finally {
        setDeleting(null);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Relatórios de Acompanhamento (RAS)
        </CardTitle>
        <Button onClick={onNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo RAS
        </Button>
      </CardHeader>
      <CardContent>
        {sortedItems.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhum RAS registrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((ras) => {
              const config = statusConfig[ras.status as keyof typeof statusConfig];
              const date = new Date(ras.data).toLocaleDateString('pt-BR');

              return (
                <div
                  key={ras.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">
                        OS {ras.serviceOrderNumber}
                      </h4>
                      <Badge className={cn('text-xs', config.className)}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ras.maintenanceCenter} - {ras.maintenanceType}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Data: {date}</span>
                      <span>Mecânico: {ras.responsibleMechanic}</span>
                      <span className="font-mono font-medium">
                        Total: R$ {ras.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {ras.photos && ras.photos.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        📸 {ras.photos.length} foto(s) anexada(s)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView(ras)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                        onClick={() => handleDelete(ras.id)}
                        disabled={deleting === ras.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
