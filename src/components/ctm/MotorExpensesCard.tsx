import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus, Trash2 } from 'lucide-react';
import type { MotorExpense } from '@/types/maintenance';
import { cn } from '@/lib/utils';

interface MotorExpensesCardProps {
  items: MotorExpense[];
  onNew?: () => void;
  onDelete?: (id: string) => void;
}

const typeConfig = {
  overhaul: { label: 'Overhaul', color: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  repair: { label: 'Reparo', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  maintenance: { label: 'Manutenção', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  inspection: { label: 'Inspeção', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
};

const motorSideConfig = {
  LH: 'Motor Esquerdo (LH)',
  RH: 'Motor Direito (RH)',
  both: 'Ambos os Motores',
};

export function MotorExpensesCard({ items, onNew, onDelete }: MotorExpensesCardProps) {
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
  const sortedItems = [...items].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja deletar este gasto?')) {
      await onDelete?.(id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Gastos de Motor
        </CardTitle>
        {onNew && (
          <Button onClick={onNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Summary */}
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Investido em Motores</p>
          <p className="text-3xl font-bold">
            R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Items List */}
        {sortedItems.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhum gasto de motor registrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((expense) => {
              const typeConfig_item = typeConfig[expense.type as keyof typeof typeConfig];
              const motorSideLabel = motorSideConfig[expense.motorSide as keyof typeof motorSideConfig];
              const date = new Date(expense.date).toLocaleDateString('pt-BR');

              return (
                <div
                  key={expense.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{motorSideLabel}</h4>
                      <Badge className={cn('text-xs', typeConfig_item.color)}>
                        {typeConfig_item.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {expense.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Data: {date}</span>
                      {expense.motorHours && (
                        <span>Horas: {expense.motorHours}h</span>
                      )}
                      {expense.supplier && (
                        <span>Fornecedor: {expense.supplier}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {expense.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                        onClick={() => handleDelete(expense.id)}
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
