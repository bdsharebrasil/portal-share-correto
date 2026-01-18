import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, TrendingDown, Receipt, History, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  created_at: string;
  user_id: string;
  user_name?: string;
}
interface BenefitCard {
  id: string;
  month: number;
  year: number;
  initial_balance: number;
}
interface BenefitCalculatorRealProps {
  title: string;
  cardType: 'alimentacao' | 'combustivel';
}
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Legacy interface for backward compatibility
interface BenefitCalculatorLegacyProps {
  title: string;
  month: string;
  initialBalance: number;
  onInitialBalanceChange: (balance: number) => void;
}

// Wrapper component for legacy interface
export function BenefitCalculator({
  title,
  month,
  initialBalance,
  onInitialBalanceChange
}: BenefitCalculatorLegacyProps) {
  // Determine card type from title
  const cardType: 'alimentacao' | 'combustivel' = title.toLowerCase().includes('combustível') || title.toLowerCase().includes('combustivel') ? 'combustivel' : 'alimentacao';
  return <BenefitCalculatorReal title={title} cardType={cardType} />;
}
export function BenefitCalculatorReal({
  title,
  cardType
}: BenefitCalculatorRealProps) {
  const [currentCard, setCurrentCard] = useState<BenefitCard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [initialBalance, setInitialBalance] = useState(500);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    description: "",
    amount: "",
    transaction_date: format(new Date(), 'yyyy-MM-dd')
  });
  useEffect(() => {
    loadBenefitCard();
  }, [selectedMonth, selectedYear, cardType]);
  useEffect(() => {
    if (currentCard) {
      loadTransactions();
    }
  }, [currentCard]);
  const loadBenefitCard = async () => {
    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from('benefit_cards' as any).select('*').eq('user_id', user.id as any).eq('card_type', cardType as any).eq('month', selectedMonth as any).eq('year', selectedYear as any).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      toast.error('Erro ao carregar cartão benefício');
      return;
    }
    if (data) {
      setCurrentCard(data as any);
      setInitialBalance(Number((data as any).initial_balance));
    } else {
      // Create new card
      const {
        data: newCard,
        error: createError
      } = await supabase.from('benefit_cards' as any).insert({
        user_id: user.id,
        card_type: cardType,
        month: selectedMonth,
        year: selectedYear,
        initial_balance: 500
      } as any).select().single();
      if (createError) {
        toast.error('Erro ao criar cartão benefício');
        return;
      }
      setCurrentCard(newCard as any);
      setInitialBalance(500);
    }
  };
  const loadTransactions = async () => {
    if (!currentCard) return;
    const {
      data,
      error
    } = await supabase.from('benefit_transactions' as any).select('*').eq('benefit_card_id', currentCard.id as any).order('transaction_date', {
      ascending: false
    });
    if (error) {
      toast.error('Erro ao carregar transações');
      return;
    }

    const transactionsWithNames = (data || []).map((t: any) => ({
      ...t,
      user_name: 'Usuário'
    }));

    setTransactions(transactionsWithNames as any);
  };
  const updateInitialBalance = async () => {
    if (!currentCard) return;
    const {
      error
    } = await supabase.from('benefit_cards' as any).update({
      initial_balance: initialBalance
    } as any).eq('id', currentCard.id as any);
    if (error) {
      toast.error('Erro ao atualizar saldo inicial');
      return;
    }
    toast.success('Saldo inicial atualizado');
    setIsEditingBalance(false);
    loadBenefitCard();
  };
  const addTransaction = async () => {
    if (!currentCard || !newTransaction.description || !newTransaction.amount) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    const {
      error
    } = await supabase.from('benefit_transactions' as any).insert({
      benefit_card_id: currentCard.id,
      user_id: user.id,
      description: newTransaction.description,
      amount: parseFloat(newTransaction.amount),
      transaction_date: newTransaction.transaction_date
    } as any);
    if (error) {
      toast.error('Erro ao adicionar gasto');
      return;
    }
    toast.success('Gasto adicionado');
    setNewTransaction({
      description: "",
      amount: "",
      transaction_date: format(new Date(), 'yyyy-MM-dd')
    });
    loadTransactions();
  };
  const removeTransaction = async (id: string) => {
    const {
      error
    } = await supabase.from('benefit_transactions' as any).delete().eq('id', id as any);
    if (error) {
      toast.error('Erro ao remover gasto');
      return;
    }
    toast.success('Gasto removido');
    loadTransactions();
  };
  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const availableBalance = initialBalance - totalSpent;
  const usagePercentage = initialBalance > 0 ? totalSpent / initialBalance * 100 : 0;
  return <div className="space-y-6">
      {/* Month/Year Selector */}
      <Card className="bg-slate-800 border-slate-700 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label className="text-slate-300 font-medium">Mês</Label>
              <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => <SelectItem key={idx} value={(idx + 1).toString()}>
                      {month}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-slate-300 font-medium">Ano</Label>
              <Input type="number" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-slate-700 border-slate-600 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Principal */}
      <Card className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white shadow-elevated border-0 overflow-hidden dark:from-blue-700 dark:via-blue-600 dark:to-indigo-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-white">{title}</CardTitle>
              <p className="text-white/80 text-sm mt-1">{MONTHS[selectedMonth - 1]} {selectedYear}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-white/80 text-xs uppercase tracking-wide font-medium">Saldo Disponível</p>
            <p className="text-3xl font-bold text-white">
              R$ {availableBalance.toFixed(2).replace('.', ',')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/80">Progresso de uso</span>
              <span className="text-white/90 font-semibold">{usagePercentage.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercentage} className="h-1.5 bg-white/20" />
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Saldo Inicial</p>
                <p className="text-3xl font-bold text-white mt-2">
                  R$ {initialBalance.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <Dialog open={isEditingBalance} onOpenChange={setIsEditingBalance}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Saldo Inicial</DialogTitle>
                    <DialogDescription>
                      Insira o novo valor do saldo inicial
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="initialBalance">Valor (R$)</Label>
                      <Input id="initialBalance" type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)} className="mt-1" />
                    </div>
                    <Button onClick={updateInitialBalance} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 dark:bg-slate-800 border-slate-700 dark:border-slate-600 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Total Gasto</p>
                <p className="text-3xl font-bold text-red-400 mt-2">
                  R$ {totalSpent.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-900/30 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adicionar Gasto e Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adicionar Gasto */}
        <Card className="bg-slate-800 border-slate-700 shadow-sm">
          <CardHeader className="border-b border-slate-700 pb-4">
            <CardTitle className="flex items-center text-white text-lg">
              <Plus className="mr-2 h-5 w-5 text-blue-400" />
              Adicionar Gasto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="transactionDate" className="font-medium text-sm text-slate-300">Data</Label>
              <Input id="transactionDate" type="date" value={newTransaction.transaction_date} onChange={e => setNewTransaction(prev => ({
              ...prev,
              transaction_date: e.target.value
            }))} className="bg-slate-700 border-slate-600 text-white" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseValue" className="font-medium text-sm text-slate-300">Valor Gasto (R$)</Label>
              <Input id="expenseValue" type="number" step="0.01" placeholder="0,00" value={newTransaction.amount} onChange={e => setNewTransaction(prev => ({
              ...prev,
              amount: e.target.value
            }))} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseDescription" className="font-medium text-sm text-slate-300">Descrição</Label>
              <Textarea id="expenseDescription" placeholder="Descreva o gasto..." value={newTransaction.description} onChange={e => setNewTransaction(prev => ({
              ...prev,
              description: e.target.value
            }))} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px] resize-none" />
            </div>

            <Button onClick={addTransaction} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={!newTransaction.description || !newTransaction.amount}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Gasto
            </Button>
          </CardContent>
        </Card>

        {/* Histórico de Gastos */}
        <Card className="bg-slate-800 border-slate-700 shadow-sm">
          <CardHeader className="border-b border-slate-700 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center text-white text-lg">
              <History className="mr-2 h-5 w-5 text-blue-400" />
              Histórico
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-slate-700 border-slate-600 text-slate-200">{transactions.length} gasto(s)</Badge>
          </CardHeader>
          <CardContent className="pt-6">
            {transactions.length === 0 ? <div className="text-center py-12">
                <Receipt className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-300 font-medium">Nenhum gasto registrado</p>
                <p className="text-xs text-slate-400 mt-1">Adicione o primeiro gasto para começar</p>
              </div> : <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {transactions.map((transaction, index) => <div key={transaction.id} className="p-3 rounded-lg bg-slate-700 border border-slate-600 hover:border-blue-500 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-white text-sm">{transaction.description}</p>
                        <p className="text-xs text-slate-400 mt-1">Por: {transaction.user_name}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeTransaction(transaction.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950/50 p-0 h-auto w-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="font-bold text-red-400 text-sm">
                        - R$ {Number(transaction.amount).toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>)}
              </div>}
          </CardContent>
        </Card>
      </div>
    </div>;
}
