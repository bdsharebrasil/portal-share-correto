import { useState, useEffect } from "react";
import { ArrowLeft, Plane, MapPin, Calendar, Clock, User, ChevronDown, ChevronUp, Plus, FileText, Edit2, X } from "lucide-react";
import { FlightCycle, FlightExpense, FLIGHT_STATUS_CONFIG, EXPENSE_STATUS_CONFIG, ExpenseStatus } from "@/types/flightCycle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  company_name: string | null;
  proprietario: string | null;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

interface FlightCycleDetailProps {
  cycle: FlightCycle;
  onBack: () => void;
  onUpdateExpenseStatus: (expenseId: string, status: ExpenseStatus, additionalData?: Partial<FlightExpense>) => void;
  onUpdateCycleStatus: (cycleId: string, status: FlightCycle['status']) => void;
  onAddExpense: (cycleId: string, expense: Partial<FlightExpense>) => void;
  onUpdateCycle?: (cycleId: string, updates: Partial<FlightCycle>) => Promise<void>;
}

export function FlightCycleDetail({
  cycle,
  onBack,
  onUpdateExpenseStatus,
  onUpdateCycleStatus,
  onAddExpense,
}: FlightCycleDetailProps) {
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const statusConfig = FLIGHT_STATUS_CONFIG[cycle.status];
  
  const expenses = cycle.expenses || [];
  const completedExpenses = expenses.filter(e => ['paga', 'nao_aplicavel'].includes(e.status)).length;
  const completionPercentage = expenses.length > 0 
    ? Math.round((completedExpenses / expenses.length) * 100) 
    : 0;

  const getExpenseAlertLevel = (expense: FlightExpense): 'none' | 'yellow' | 'red' | 'purple' => {
    if (!expense.expected_date || expense.status === 'paga' || expense.status === 'nao_aplicavel') {
      return 'none';
    }
    
    const expectedDate = parseISO(expense.expected_date);
    const today = new Date();
    const daysUntilDue = differenceInDays(expectedDate, today);
    
    if (daysUntilDue < -30) return 'purple';
    if (isPast(expectedDate)) return 'red';
    if (daysUntilDue <= 7) return 'yellow';
    return 'none';
  };

  const getAlertBorderColor = (level: string) => {
    switch (level) {
      case 'yellow': return 'border-l-amber-400';
      case 'red': return 'border-l-red-400';
      case 'purple': return 'border-l-purple-400';
      default: return 'border-l-transparent';
    }
  };

  // Group expenses by category
  const groupedExpenses = {
    imediata: expenses.filter(e => e.expense_category === 'imediata'),
    regulatoria: expenses.filter(e => e.expense_category === 'regulatoria'),
    variavel: expenses.filter(e => e.expense_category === 'variavel'),
  };

  const categoryLabels = {
    imediata: 'Despesas Imediatas',
    regulatoria: 'Despesas Regulatórias',
    variavel: 'Despesas Variáveis',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista
        </Button>
      </div>

      {/* Flight Info Card */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Plane className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">
                  {cycle.aircraft?.registration || 'N/A'}
                </h2>
                <Badge 
                  variant="outline" 
                  className={cn("border-0", statusConfig.bgColor, statusConfig.color)}
                >
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {cycle.client?.company_name || cycle.client?.proprietario || 'Cliente não definido'}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-4xl font-bold text-foreground">{completionPercentage}%</p>
            <p className="text-sm text-muted-foreground">Conclusão</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="font-mono">{cycle.origin_icao} → {cycle.destination_icao}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(cycle.flight_date), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          {cycle.flight_duration_hours && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{cycle.flight_duration_hours}h de voo</span>
            </div>
          )}
        </div>

        {/* Status Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
          {cycle.status === 'confirmado' && (
            <Button 
              size="sm" 
              onClick={() => onUpdateCycleStatus(cycle.id, 'em_execucao')}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Iniciar Voo
            </Button>
          )}
          {cycle.status === 'em_execucao' && (
            <Button 
              size="sm" 
              onClick={() => onUpdateCycleStatus(cycle.id, 'aguardando_despesas')}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              Concluir Voo
            </Button>
          )}
          {['aguardando_despesas', 'em_cobranca'].includes(cycle.status) && completionPercentage === 100 && (
            <Button 
              size="sm" 
              onClick={() => onUpdateCycleStatus(cycle.id, 'finalizado')}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Finalizar Ciclo
            </Button>
          )}
        </div>
      </div>

      {/* Checklist de Despesas */}
      <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Checklist de Despesas</h3>
          <Button size="sm" variant="outline" onClick={() => setAddExpenseOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Despesa
          </Button>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedExpenses).map(([category, categoryExpenses]) => (
            categoryExpenses.length > 0 && (
              <div key={category} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </h4>
                <div className="space-y-2">
                  {categoryExpenses.map((expense) => {
                    const alertLevel = getExpenseAlertLevel(expense);
                    const expenseStatusConfig = EXPENSE_STATUS_CONFIG[expense.status];
                    const isExpanded = expandedExpense === expense.id;

                    return (
                      <Collapsible 
                        key={expense.id} 
                        open={isExpanded}
                        onOpenChange={() => setExpandedExpense(isExpanded ? null : expense.id)}
                      >
                        <div className={cn(
                          "rounded-lg border bg-background/50 overflow-hidden border-l-4",
                          getAlertBorderColor(alertLevel)
                        )}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted/30">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{expense.expense_name}</p>
                                  {expense.expected_date && (
                                    <p className="text-xs text-muted-foreground">
                                      Prazo: {format(new Date(expense.expected_date), "dd/MM/yyyy")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <Badge 
                                  variant="outline" 
                                  className={cn("border-0", expenseStatusConfig.bgColor, expenseStatusConfig.color)}
                                >
                                  {expenseStatusConfig.icon} {expenseStatusConfig.label}
                                </Badge>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4">
                              {expense.expected_date && (
                                <div>
                                  <label className="text-xs text-muted-foreground">Data Esperada</label>
                                  <p className="text-sm font-medium">{format(new Date(expense.expected_date), "dd/MM/yyyy")}</p>
                                </div>
                              )}
                              
                              <div className="flex items-end gap-4">
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                                  <Select
                                    value={expense.status}
                                    onValueChange={(value) => onUpdateExpenseStatus(expense.id, value as ExpenseStatus)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(EXPENSE_STATUS_CONFIG).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                          {config.icon} {config.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                                  <Input
                                    type="number"
                                    placeholder="0,00"
                                    value={expense.amount || ''}
                                    onChange={(e) => onUpdateExpenseStatus(expense.id, expense.status, { amount: parseFloat(e.target.value) || null })}
                                  />
                                </div>
                                
                                <Button 
                                  size="sm"
                                  onClick={() => onUpdateExpenseStatus(expense.id, expense.status)}
                                >
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            )
          ))}

          {expenses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma despesa cadastrada</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setAddExpenseOpen(true)}
              >
                Adicionar primeira despesa
              </Button>
            </div>
          )}
        </div>
      </div>

      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onAdd={(expense) => onAddExpense(cycle.id, expense)}
      />
    </div>
  );
}
