import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlightExpense, EXPENSE_TYPES, ExpenseCategory } from "@/types/flightCycle";
import { format, addDays } from "date-fns";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (expense: Partial<FlightExpense>) => void;
}

export function AddExpenseDialog({ open, onOpenChange, onAdd }: AddExpenseDialogProps) {
  const [expenseType, setExpenseType] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('variavel');
  const [expectedDate, setExpectedDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    const typeConfig = EXPENSE_TYPES[expenseType as keyof typeof EXPENSE_TYPES];
    
    onAdd({
      expense_type: expenseType || 'outras',
      expense_category: typeConfig?.category || category,
      expense_name: typeConfig?.name || customName || 'Despesa Manual',
      status: 'aguardando',
      expected_date: expectedDate,
      amount: amount ? parseFloat(amount) : null,
      deadline_days: 7,
    });

    // Reset form
    setExpenseType('');
    setCustomName('');
    setCategory('variavel');
    setExpectedDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setAmount('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Despesa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Despesa</Label>
            <Select value={expenseType} onValueChange={setExpenseType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_TYPES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {expenseType === 'outras' && (
            <>
              <div className="space-y-2">
                <Label>Nome da Despesa</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ex: Taxa especial"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imediata">Imediata</SelectItem>
                    <SelectItem value="relatorio_viagem">Relatório de Viagem</SelectItem>
                    <SelectItem value="regulatoria">Regulatória</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Data Esperada</Label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Valor (R$) - Opcional</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!expenseType}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
