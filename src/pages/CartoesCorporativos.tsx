import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Fuel, UtensilsCrossed, Plus, CreditCard, TrendingDown, Calendar, User, Edit2, Lock } from "lucide-react";
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

      // Subscribe to real-time updates for transactions
      const subscription = supabase
        .channel('benefit_transactions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'benefit_transactions'
          },
          () => {
            // Reload transactions when any change is detected
            loadTransactions();
          }
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
          cardsMap.set(card.card_type, card);
        });
      } else {
        // Create default benefit cards if they don't exist
        const cardTypes: ("combustivel" | "alimentacao")[] = ["combustivel", "alimentacao"];
        for (const cardType of cardTypes) {
          const { data: newCard, error: insertError } = await supabase
            .from("benefit_cards")
            .insert([
              {
                user_id: currentUser.id,
                card_type: cardType,
                month: month,
                year: year,
                initial_balance: cardType === "combustivel" ? 5000.0 : 1500.0,
              },
            ])
            .select()
            .single();

          if (insertError) throw insertError;
          if (newCard) {
            cardsMap.set(cardType, newCard);
          }
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
      const month = parseInt(selectedMonth);
      const year = parseInt(selectedYear);

      // Get all benefit cards for the selected month/year to find their IDs
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

      // Get transactions for these cards
      const { data, error } = await supabase
        .from("benefit_transactions")
        .select("*")
        .in("benefit_card_id", cardIds)
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      // Fetch user data for each transaction
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
    return getTransactionsForCard(cardType).reduce((sum, t) => sum + t.amount, 0);
  };

  const updateCardBalances = () => {
    const balances: CardBalance[] = [];

    const cardConfigs = [
      {
        type: "combustivel" as const,
        icon: <Fuel className="h-8 w-8" />,
        color: "from-blue-500 to-blue-600",
        bgColor: "blue",
      },
      {
        type: "alimentacao" as const,
        icon: <UtensilsCrossed className="h-8 w-8" />,
        color: "from-orange-500 to-orange-600",
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
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Cartões Corporativos
          </h1>
          <p className="text-muted-foreground">Gerencie seus cartões de combustível e alimentação</p>
        </div>

        {/* Month/Year Selection */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-semibold text-foreground">Mês</label>
              {!canEditSettings && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30">
                  <Lock className="h-3 w-3" />
                  Somente Admin/Gestor
                </div>
              )}
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!canEditSettings}>
              <SelectTrigger className={`bg-slate-800/40 border-slate-700/50 ${!canEditSettings ? 'opacity-60 cursor-not-allowed' : ''}`}>
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

          <div className="flex-1 max-w-xs">
            <label className="text-sm font-semibold text-foreground mb-2 block">Ano</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-slate-800/40 border-slate-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
                  const year = String(new Date().getFullYear() - 2 + i);
                  return (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Card Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cardBalances.map((card) => (
            <div
              key={card.type}
              className={`relative h-40 rounded-2xl bg-gradient-to-br ${card.color} p-6 text-white shadow-lg overflow-hidden group transition-transform hover:scale-105`}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 right-4">
                  {card.type === "combustivel" ? (
                    <Fuel className="h-16 w-16 text-white/20" />
                  ) : (
                    <UtensilsCrossed className="h-16 w-16 text-white/20" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between">
                {/* Top */}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider opacity-80">
                    {card.type === "combustivel" ? "Combustível" : "Alimentação"}
                  </p>
                  <h2 className="text-3xl font-bold mt-3">
                    R$ {card.balance.toFixed(2)}
                  </h2>
                </div>

                {/* Bottom - Just show spent amount */}
                <div className="flex justify-between items-end">
                  <div className="text-xs opacity-75">
                    <p>Gasto: R$ {card.spent.toFixed(2)}</p>
                  </div>
                  {canEditSettings && (
                    <button
                      onClick={() => openEditBalanceDialog(card.type)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/20 rounded-lg"
                      title="Editar saldo"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Expense Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" size="lg">
              <Plus className="h-5 w-5" />
              Registrar Novo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Gasto com Cartão</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Card Type */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Cartão</label>
                <div className="flex gap-2">
                  {["combustivel", "alimentacao"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, category: type })}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        formData.category === type
                          ? "border-primary bg-primary/10"
                          : "border-slate-700/50 hover:border-slate-600"
                      }`}
                    >
                      {type === "combustivel" ? "Combustível" : "Alimentação"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Valor *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  step="0.01"
                  min="0"
                  className="bg-slate-800/40 border-slate-700/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Descrição *</label>
                <Input
                  placeholder="Ex: Abastecimento avião N-123"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-800/40 border-slate-700/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddExpense}
                  disabled={loading}
                >
                  {loading ? "Registrando..." : "Registrar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expense History */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-primary" />
            Histórico de Gastos
          </h2>

          {/* Tab Selection */}
          <div className="flex gap-2">
            {["combustivel", "alimentacao"].map((type) => {
              const config = cardBalances.find((c) => c.type === type as any);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedCardType(type as "combustivel" | "alimentacao")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    selectedCardType === type
                      ? "bg-primary/30 text-primary border border-primary/50"
                      : "bg-slate-800/40 text-muted-foreground border border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  {type === "combustivel" ? (
                    <>
                      <Fuel className="inline h-4 w-4 mr-2" />
                      Combustível
                    </>
                  ) : (
                    <>
                      <UtensilsCrossed className="inline h-4 w-4 mr-2" />
                      Alimentação
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {getTotalSpent(selectedCardType).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Lançamentos</p>
                  <p className="text-2xl font-bold text-foreground">
                    {getTransactionsForCard(selectedCardType).length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {getTransactionsForCard(selectedCardType).length > 0
                      ? (getTotalSpent(selectedCardType) / getTransactionsForCard(selectedCardType).length).toFixed(2)
                      : "0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : getTransactionsForCard(selectedCardType).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum gasto registrado para este cartão</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50">
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Registrado Por</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTransactionsForCard(selectedCardType).map((tx) => (
                        <TableRow key={tx.id} className="border-slate-700/50">
                          <TableCell className="text-foreground whitespace-nowrap font-semibold">
                            {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {tx.description}
                          </TableCell>
                          <TableCell className="text-foreground text-sm flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {tx.user_name}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            -R$ {tx.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
