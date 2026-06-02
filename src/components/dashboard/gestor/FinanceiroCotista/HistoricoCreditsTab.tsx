import { useState } from "react";
import { useHistoricoCreditosCotista } from "@/hooks/useHistoricoCreditosCotista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownRight,
  ArrowUpLeft,
  DollarSign,
  FileText,
} from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatData = (data: string) => {
  const d = new Date(data);
  return d.toLocaleDateString("pt-BR");
};

interface HistoricoCreditsTabProps {
  clienteId?: string;
  socioId?: string;
  aeronaveId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function HistoricoCreditsTab({
  clienteId,
  socioId,
  aeronaveId,
  dataInicio,
  dataFim,
}: HistoricoCreditsTabProps) {
  const { data: historico, isLoading } = useHistoricoCreditosCotista({
    clienteId,
    socioId,
    aeronaveId,
    dataInicio,
    dataFim,
  });

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (!historico) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Selecione um cotista para visualizar histórico
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Créditos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-5 shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-xl bg-success/10 text-success">
              <ArrowUpLeft className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-semibold mb-1">
            Total de Créditos
          </p>
          <p className="text-2xl font-bold text-success">
            {formatBRL(historico.total_creditos)}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-5 shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-semibold mb-1">
            Total de Débitos
          </p>
          <p className="text-2xl font-bold text-destructive">
            {formatBRL(historico.total_debitos)}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-5 shadow-lg">
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-xl ${historico.saldo_final >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-semibold mb-1">
            Saldo Final
          </p>
          <p className={`text-2xl font-bold ${historico.saldo_final >= 0 ? "text-success" : "text-destructive"}`}>
            {formatBRL(historico.saldo_final)}
          </p>
        </div>
      </div>

      {/* Tabela de Movimentos */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Histórico de Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : historico.movimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma movimentação registrada neste período
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.movimentos.map((mov) => (
                    <TableRow
                      key={mov.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        setExpandedRow(expandedRow === mov.id ? null : mov.id)
                      }
                    >
                      <TableCell className="font-medium text-sm">
                        {formatData(mov.data)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            mov.tipo === "credito"
                              ? "bg-success/20 text-success"
                              : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {mov.tipo === "credito" ? (
                            <ArrowUpLeft className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {mov.tipo === "credito" ? "Crédito" : "Débito"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {mov.descricao}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-semibold ${
                          mov.tipo === "credito"
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        {mov.tipo === "credito" ? "+" : "-"}
                        {formatBRL(mov.valor)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span
                          className={
                            mov.saldo_posterior >= 0
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          {formatBRL(mov.saldo_posterior)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {mov.documento ? (
                          <span className="font-mono bg-muted px-2 py-1 rounded">
                            {mov.documento}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            mov.status === "pago"
                              ? "bg-success/20 text-success"
                              : mov.status === "pendente"
                                ? "bg-yellow-500/20 text-yellow-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {mov.status || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic px-2">
        * Os créditos são gerados quando o cotista realiza pagamento direto.
        Débitos são despesas que o cotista deve (rateadas à ele).
        O saldo é a diferença acumulativa entre créditos e débitos.
      </p>
    </div>
  );
}
