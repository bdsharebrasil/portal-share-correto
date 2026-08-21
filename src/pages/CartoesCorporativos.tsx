// @ts-nocheck
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Fuel, UtensilsCrossed, Plus, CreditCard, TrendingDown, User, Edit2, Lock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BenefitTransaction {
  id: string;
  benefit_card_id: string;
  description: string;
  amount: number;
  transaction_date: string;
  created_at: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
}

interface BenefitCard {
  id: string;
  card_type: "combustivel" | "alimentacao";
  month: number;
  year: number;
  initial_balance: number;
}

interface CardBalance {
  type: "combustivel" | "alimentacao";
  balance: number;
  spent: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  cardId?: string;
}

export default function CartoesCorporativos() {
  const { isAdmin, isGestorMaster, isFinanceiroMaster } = useUserRole();
  const canEditSettings = isAdmin || isGestorMaster || isFinanceiroMaster;

  const [transactions, setTransactions] = useState<BenefitTransaction[]>([]);
  const [benefitCards, setBenefitCards] = useState<Map<string, BenefitCard>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<"combustivel" | "alimentacao">("combustivel");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBalanceDialogOpen, setEditBalanceDialogOpen] = useState(false);
  const [editingCardType, setEditingCardType] = useState<"combustivel" | "alimentacao" | null>(null);
  const [editingBalance, setEditingBalance] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cardBalances, setCardBalances] = useState<CardBalance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "combustivel",
  });

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadBenefitCards();
      loadTransactions();

      const subscription = supabase
        .channel('benefit_transactions_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'benefit_transactions' },
          () => loadTransactions()
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [currentUser, selectedMonth, selectedYear]);

  const getCurrentUser = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const loadBenefitCards = async () => {
    if (!currentUser) return;

    try {
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      const { data: existingCards, error } = await supabase
        .from("benefit_cards")
        .select("*")
        .eq("user_id", currentUser.id)
        .eq("month", month)
        .eq("year", year);

      if (error) throw error;

      const cardsMap = new Map<string, BenefitCard>();

      if (existingCards && existingCards.length > 0) {
        existingCards.forEach((card) => {
          cardsMap.set(card.card_type, card as BenefitCard);
        });
      } else {
        const cardTypes: ("combustivel" | "alimentacao")[] = ["combustivel", "alimentacao"];
        for (const cardType of cardTypes) {
          const { data: newCard, error: insertError } = await supabase
            .from("benefit_cards")
            .insert([{
                user_id: currentUser.id,
                card_type: cardType,
                month: month,
                year: year,
                initial_balance: 0,
            }])
            .select()
            .single();

          if (insertError) throw insertError;
          if (newCard) cardsMap.set(cardType, newCard as BenefitCard);
        }
      }

      setBenefitCards(cardsMap);
    } catch (error) {
      console.error("Error loading benefit cards:", error);
      toast.error("Erro ao carregar cartões");
    }
  };

  const loadTransactions = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      const { data: cardsData, error: cardsError } = await supabase
        .from("benefit_cards")
        .select("id, card_type")
        .eq("month", month)
        .eq("year", year);

      if (cardsError) throw cardsError;

      if (!cardsData || cardsData.length === 0) {
        setTransactions([]);
        return;
      }

      const cardIds = cardsData.map(c => c.id);

      const { data, error } = await supabase
        .from("benefit_transactions")
        .select("*")
        .in("benefit_card_id", cardIds)
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      if (data) {
        const enrichedTransactions = await Promise.all(
          data.map(async (tx) => {
            try {
              const { data: userData } = await supabase.auth.admin.getUserById(tx.user_id);
              return {
                ...tx,
                user_name: userData?.user?.user_metadata?.full_name || "Desconhecido",
                user_email: userData?.user?.email || "—",
              };
            } catch {
              return {
                ...tx,
                user_name: "Desconhecido",
                user_email: "—",
              };
            }
          })
        );
        setTransactions(enrichedTransactions);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Erro ao carregar histórico de gastos");
    } finally {
      setLoading(false);
    }
  };

  const getTransactionsForCard = (cardType: "combustivel" | "alimentacao") => {
    const card = benefitCards.get(cardType);
    if (!card) return [];
    return transactions.filter((t) => {
      const cardTx = Array.from(benefitCards.values()).find((c) => c.id === t.benefit_card_id);
      return cardTx?.card_type === cardType;
    });
  };

  const getTotalSpent = (cardType: "combustivel" | "alimentacao") => {
    return getTransactionsForCard(cardType).reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  const updateCardBalances = () => {
    const balances: CardBalance[] = [];
    const cardConfigs = [
      {
        type: "combustivel" as const,
        icon: <Fuel className="h-6 w-6" />,
        color: "from-blue-600 to-indigo-700",
        bgColor: "blue",
      },
      {
        type: "alimentacao" as const,
        icon: <UtensilsCrossed className="h-6 w-6" />,
        color: "from-orange-500 to-rose-600",
        bgColor: "orange",
      },
    ];

    cardConfigs.forEach((config) => {
      const card = benefitCards.get(config.type);
      const spent = getTotalSpent(config.type);
      const balance = (card?.initial_balance || 0) - spent;

      balances.push({
        type: config.type,
        balance: Math.max(0, balance),
        spent,
        icon: config.icon,
        color: config.color,
        bgColor: config.bgColor,
        cardId: card?.id,
      });
    });

    setCardBalances(balances);
  };

  useEffect(() => {
    updateCardBalances();
  }, [benefitCards, transactions]);

  const handleAddExpense = async () => {
    if (!formData.amount || !formData.description) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const card = benefitCards.get(formData.category as "combustivel" | "alimentacao");
    if (!card) {
      toast.error("Cartão não encontrado para este período");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("benefit_transactions").insert([
        {
          benefit_card_id: card.id,
          user_id: currentUser.id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          transaction_date: format(new Date(), "yyyy-MM-dd"),
        },
      ]);

      if (error) throw error;

      toast.success("Gasto registrado com sucesso");
      setFormData({ amount: "", description: "", category: "combustivel" });
      setDialogOpen(false);
      loadTransactions();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error("Erro ao registrar gasto");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBalance = async () => {
    if (!editingCardType || !editingBalance) {
      toast.error("Preencha o novo saldo");
      return;
    }

    const card = benefitCards.get(editingCardType);
    if (!card) {
      toast.error("Cartão não encontrado");
      return;
    }

    try {
      setLoading(true);
      const newBalance = parseFloat(editingBalance);

      const { error } = await supabase
        .from("benefit_cards")
        .update({ initial_balance: newBalance })
        .eq("id", card.id);

      if (error) throw error;

      toast.success("Saldo atualizado com sucesso");
      setEditBalanceDialogOpen(false);
      setEditingBalance("");
      setEditingCardType(null);
      loadBenefitCards();
    } catch (error) {
      console.error("Error updating balance:", error);
      toast.error("Erro ao atualizar saldo");
    } finally {
      setLoading(false);
    }
  };

  const openEditBalanceDialog = (cardType: "combustivel" | "alimentacao") => {
    const card = benefitCards.get(cardType);
    if (card) {
      setEditingCardType(cardType);
      setEditingBalance(card.initial_balance.toString());
      setEditBalanceDialogOpen(true);
    }
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-6xl mx-auto">
        
        {/* Header & Controls - Layout Moderno em Linha */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-card/40 p-6 rounded-2xl border border-border/60 backdrop-blur-md shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
              <CreditCard className="h-7 w-7 text-primary" />
              Cartões Corporativos
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie saldos e gastos de combustível e alimentação</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Mês</label>
                {!canEditSettings && <Lock className="h-3 w-3 text-yellow-500/70 ml-auto" title="Somente Admin" />}
              </div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!canEditSettings}>
                <SelectTrigger className="h-9 bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = String(i + 1).padStart(2, "0");
                    return (
                      <SelectItem key={month} value={month}>
                        {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="w-24">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = String(new Date().getFullYear() - 2 + i);
                    return <SelectItem key={year} value={year}>{year}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Minimal Cards Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cardBalances.map((card) => (
            <div
              key={card.type}
              className={`relative h-28 rounded-xl bg-gradient-to-r ${card.color} p-5 text-white shadow-md overflow-hidden group transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
            >
              {/* Background pattern subtil */}
              <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-6">
                {card.type === "combustivel" ? (
                  <Fuel className="h-32 w-32" />
                ) : (
                  <UtensilsCrossed className="h-32 w-32" />
                )}
              </div>

              {/* Content */}
              <div className="relative z-10 flex h-full items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-90">
                    {card.icon}
                    <p className="text-xs font-semibold uppercase tracking-wider">
                      {card.type === "combustivel" ? "Combustível" : "Alimentação"}
                    </p>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    R$ {card.balance.toFixed(2)}
                  </h2>
                </div>

                <div className="text-right flex flex-col items-end justify-between h-full">
                  {canEditSettings && (
                    <button
                      onClick={() => openEditBalanceDialog(card.type)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white/10 hover:bg-white/25 rounded-md backdrop-blur-sm"
                      title="Editar saldo"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="mt-auto">
                    <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Total Gasto</p>
                    <p className="text-sm font-medium">R$ {card.spent.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Section */}
        <div className="bg-card/30 border border-border/60 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Lançamentos do Mês
            </h2>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Registrar Gasto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Registrar Gasto com Cartão</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 pt-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Selecione o Cartão</label>
                    <div className="flex gap-2">
                      {["combustivel", "alimentacao"].map((type) => (
                        <button
                          key={type}
                          onClick={() => setFormData({ ...formData, category: type })}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            formData.category === type
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background/50 text-muted-foreground hover:border-border"
                          }`}
                        >
                          {type === "combustivel" ? <Fuel className="h-4 w-4"/> : <UtensilsCrossed className="h-4 w-4"/>}
                          {type === "combustivel" ? "Combustível" : "Alimentação"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      step="0.01"
                      min="0"
                      className="bg-background/50 border-border h-10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição *</label>
                    <Input
                      placeholder="Ex: Abastecimento veículo N-123"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-background/50 border-border h-10"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 border-border bg-transparent" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={handleAddExpense} disabled={loading}>
                      {loading ? "Registrando..." : "Confirmar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Modern Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-background/40 rounded-xl w-fit border border-border/50">
            {["combustivel", "alimentacao"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedCardType(type as "combustivel" | "alimentacao")}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCardType === type
                    ? "bg-card-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                {type === "combustivel" ? <Fuel className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                {type === "combustivel" ? "Combustível" : "Alimentação"}
              </button>
            ))}
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-background/40 p-4 rounded-xl border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Gasto no Período</p>
              <p className="text-xl font-bold text-foreground">R$ {getTotalSpent(selectedCardType).toFixed(2)}</p>
            </div>
            <div className="bg-background/40 p-4 rounded-xl border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Transações</p>
              <p className="text-xl font-bold text-foreground">{getTransactionsForCard(selectedCardType).length}</p>
            </div>
            <div className="bg-background/40 p-4 rounded-xl border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ticket Médio</p>
              <p className="text-xl font-bold text-foreground">
                R$ {getTransactionsForCard(selectedCardType).length > 0
                  ? (getTotalSpent(selectedCardType) / getTransactionsForCard(selectedCardType).length).toFixed(2)
                  : "0.00"}
              </p>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-background/40 rounded-xl border border-border/50 overflow-hidden">
            {loading ? (
              <div className="text-center py-10 text-sm text-muted-foreground animate-pulse">Carregando transações...</div>
            ) : getTransactionsForCard(selectedCardType).length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">Nenhum gasto registrado neste período.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-card/50 hover:bg-card/50">
                    <TableRow className="border-border/50">
                      <TableHead className="w-[120px] text-xs font-medium">Data</TableHead>
                      <TableHead className="text-xs font-medium">Descrição</TableHead>
                      <TableHead className="text-xs font-medium">Responsável</TableHead>
                      <TableHead className="text-right text-xs font-medium">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTransactionsForCard(selectedCardType).map((tx) => (
                      <TableRow key={tx.id} className="border-border/50 hover:bg-card-secondary/20 transition-colors">
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(tx.transaction_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-foreground font-medium text-sm">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 opacity-70" />
                            {tx.user_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-rose-400">
                          -R$ {tx.amount?.toFixed(2) || "0.00"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}