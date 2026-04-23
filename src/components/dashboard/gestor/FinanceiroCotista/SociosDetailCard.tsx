import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Users, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  BarChart3,
  FileText,
  Loader2,
  Edit2,
  Trash2,
  Eye
} from "lucide-react";
import { useSocioAccounts, useSocioTransactions } from "@/hooks/useFinanceiroSocios";
import type { PartnerAccount, PartnerTransaction } from "@/hooks/useFinanceiroSocios";

interface SociosDetailCardProps {
  clienteId: string;
  clienteNome: string;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatDate = (date: string | null) => {
  if (!date) return "—";
  try {
    return new Date(date.includes("T") ? date : date + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
};

// Função para calcular resumo por sócio
function calculateSummaryBySocio(transactions: PartnerTransaction[], socios: PartnerAccount[]) {
  const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
  
  return socios.map((socio) => {
    const normalizedCpf = normalizeCpf(socio.partner_cpf || socio.socio_cpf || "");
    const socioTransactions = transactions.filter((t) => normalizeCpf(t.partner_cpf) === normalizedCpf);
    
    const entradas = socioTransactions
      .filter((t) => t.transaction_type === "deposit" || t.amount > 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    
    const saidas = socioTransactions
      .filter((t) => t.transaction_type !== "deposit" && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    
    return {
      socio,
      entradas,
      saidas,
      saldo: socio.saldo_atual || 0,
    };
  });
}

export function SociosDetailCard({ clienteId, clienteNome }: SociosDetailCardProps) {
  const [socioSelecionado, setSocioSelecionado] = useState<PartnerAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  const { data: socios = [], isLoading } = useSocioAccounts(clienteId);
  const { data: transactions = [] } = useSocioTransactions(clienteId);

  const summaryBySocio = useMemo(
    () => calculateSummaryBySocio(transactions, socios),
    [transactions, socios]
  );

  const saltoTotal = socios.reduce((acc, s) => acc + (s.saldo_atual || 0), 0);
  const entradasTotal = summaryBySocio.reduce((acc, s) => acc + s.entradas, 0);
  const saidasTotal = summaryBySocio.reduce((acc, s) => acc + s.saidas, 0);

  if (isLoading) {
    return (
      <Card className="border-border bg-gradient-to-br from-background to-background/80 backdrop-blur-sm">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Carregando sócios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (socios.length === 0) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum sócio cadastrado para este cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: Resumo por Sócio */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Resumo por Sócio
        </h2>
        
        <div className="space-y-4">
          {/* Card principal do cliente */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Conta Bancária</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">Entradas</span>
                      <p className="text-lg font-bold text-emerald-500">{formatBRL(entradasTotal)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Saídas</span>
                      <p className="text-lg font-bold text-red-500">{formatBRL(saidasTotal)}</p>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">Saldo</span>
                      <p className={`text-xl font-bold ${saltoTotal >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {formatBRL(saltoTotal)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cards individuais dos sócios */}
                {summaryBySocio.map((summary, idx) => (
                  <div key={summary.socio.id} className={`p-4 rounded-lg border ${
                    idx % 2 === 0 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-blue-500/5 border-blue-500/20"
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold truncate">
                      {summary.socio.partner_name || summary.socio.socio_nome}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Entradas</span>
                        <p className="font-bold text-emerald-500">{formatBRL(summary.entradas)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Saídas</span>
                        <p className="font-bold text-red-500">{formatBRL(summary.saidas)}</p>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Saldo</span>
                        <p className={`font-bold ${summary.saldo >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {formatBRL(summary.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cards em Grid para cada sócio (visão alternativa) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryBySocio.map((summary) => (
              <button
                key={summary.socio.id}
                onClick={() => {
                  setSocioSelecionado(summary.socio);
                  setModalOpen(true);
                }}
                className="text-left p-4 rounded-lg bg-card border border-border hover:bg-card/80 hover:border-primary/50 transition-all group space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {summary.socio.partner_name || summary.socio.socio_nome}
                    </h4>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {summary.socio.partner_cpf || summary.socio.socio_cpf}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all" />
                </div>
                
                <div className="flex items-end justify-between pt-2 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                    <p className={`text-sm font-bold ${
                      summary.saldo >= 0 
                        ? "text-emerald-500" 
                        : "text-red-500"
                    }`}>
                      {formatBRL(summary.saldo)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: Detalhamento de Transações */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Detalhamento de Transações
          <Badge variant="outline" className="ml-auto">
            {transactions.length} registros
          </Badge>
        </h2>

        {transactions.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma transação registrada.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/50">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50 hover:bg-transparent">
                    <TableHead className="w-12">AÇÃO</TableHead>
                    <TableHead>DATA</TableHead>
                    <TableHead>DESCRIÇÃO</TableHead>
                    <TableHead>SÓCIO</TableHead>
                    <TableHead>TIPO</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>MÉTODO PG.</TableHead>
                    <TableHead>PRAZO</TableHead>
                    <TableHead>BANCO</TableHead>
                    <TableHead>DOC</TableHead>
                    <TableHead>OBS</TableHead>
                    <TableHead className="text-right">VALOR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction, idx) => (
                    <TableRow 
                      key={idx}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="w-12">
                        <div className="flex gap-1">
                          <button className="p-1 hover:bg-muted rounded transition-colors" title="Editar">
                            <Edit2 className="h-4 w-4 text-blue-500" />
                          </button>
                          <button className="p-1 hover:bg-muted rounded transition-colors" title="Deletar">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(transaction.payment_date || transaction.created_at)}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {transaction.description || transaction.tipo || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {transaction.partner_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {transaction.transaction_type || transaction.tipo || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(transaction.reference_type)}`}
                        >
                          {transaction.reference_type || transaction.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.notes ? (
                          <span className="text-xs p-1 bg-muted rounded">{transaction.notes}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">—</TableCell>
                      <TableCell className="text-sm">—</TableCell>
                      <TableCell className="text-sm">—</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={transaction.amount >= 0 ? "text-emerald-500" : "text-red-500"}>
                          {transaction.amount >= 0 ? "+" : ""}{formatBRL(transaction.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalhes do Sócio */}
      {socioSelecionado && (
        <SocioDetailModal 
          open={modalOpen}
          onOpenChange={setModalOpen}
          socio={socioSelecionado}
          transactions={transactions}
        />
      )}
    </div>
  );
}

function getStatusColor(status: string | null | undefined): string {
  if (!status) return "";
  const statusLower = status.toLowerCase();
  if (statusLower.includes("pago") || statusLower.includes("recebi")) return "bg-emerald-500/20 text-emerald-600";
  if (statusLower.includes("pendente")) return "bg-yellow-500/20 text-yellow-600";
  if (statusLower.includes("cancelado")) return "bg-red-500/20 text-red-600";
  return "";
}

interface SocioDetailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  socio: PartnerAccount;
  transactions: PartnerTransaction[];
}

function SocioDetailModal({ 
  open, 
  onOpenChange, 
  socio,
  transactions 
}: SocioDetailModalProps) {
  const normalizeCpf = (cpf: string) => cpf?.replace(/\D/g, "") || "";
  const normalizedCpf = normalizeCpf(socio.partner_cpf || socio.socio_cpf || "");
  const socioTransactions = transactions.filter((t) => normalizeCpf(t.partner_cpf) === normalizedCpf);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {socio.partner_name || socio.socio_nome}
          </DialogTitle>
          <DialogDescription>
            CPF: {socio.partner_cpf || socio.socio_cpf}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="transacoes">Transações</TabsTrigger>
          </TabsList>

          {/* Aba Resumo */}
          <TabsContent value="resumo" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Informações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-semibold">{socio.partner_name || socio.socio_nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="font-mono">{socio.partner_cpf || socio.socio_cpf}</p>
                  </div>
                  {socio.nome_banco && (
                    <div>
                      <p className="text-xs text-muted-foreground">Banco</p>
                      <p className="font-semibold">{socio.nome_banco}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Saldo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="text-xs text-muted-foreground mb-1">Saldo Atual</p>
                    <p className={`text-2xl font-bold ${
                      (socio.saldo_atual || 0) >= 0 
                        ? "text-emerald-500" 
                        : "text-red-500"
                    }`}>
                      {formatBRL(socio.saldo_atual || 0)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-xs text-muted-foreground">Depositado</p>
                      <p className="font-bold text-emerald-500">{formatBRL(socio.total_depositado || 0)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-muted-foreground">Gasto</p>
                      <p className="font-bold text-red-500">{formatBRL(socio.total_gasto || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba Transações */}
          <TabsContent value="transacoes" className="space-y-4 mt-4">
            <Card className="bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Histórico de Transações ({socioTransactions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {socioTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma transação registrada
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {socioTransactions.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {t.description || t.tipo}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(t.created_at)}
                          </p>
                        </div>
                        <p className={`text-sm font-bold ml-2 ${
                          t.amount >= 0 ? "text-emerald-500" : "text-red-500"
                        }`}>
                          {t.amount >= 0 ? "+" : ""}{formatBRL(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
