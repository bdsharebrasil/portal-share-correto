import React from "react";
import { useRelatorioCustosModelo2 } from "@/hooks/useRelatorioCustosModelo2";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { Wallet, Users, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface RelatorioCustosModelo2Props {
  clienteId: string;
  aeronaveId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export const RelatorioCustosModelo2: React.FC<RelatorioCustosModelo2Props> = ({
  clienteId,
  aeronaveId,
  dataInicio,
  dataFim,
}) => {
  const { data, isLoading } = useRelatorioCustosModelo2(clienteId, aeronaveId, dataInicio, dataFim);

  if (isLoading) return <div>Carregando relatório da holding...</div>;
  if (!data) return <div>Nenhum dado encontrado para esta holding.</div>;

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro da Holding */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
              Saldo em Caixa
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.saldo_caixa_holding < 0 ? "text-red-600" : "text-green-600"}`}>
              {formatBRL(data.saldo_caixa_holding)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Conta centralizada DGA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Aportes
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatBRL(data.total_aportes_socios)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Entradas dos sócios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Despesas
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatBRL(data.total_despesas_pagas)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Pagamentos realizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sócios Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.custos_por_socio.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Divisão igualitária (1/{data.custos_por_socio.length})</p>
          </CardContent>
        </Card>
      </div>

      {/* Balanço Individual dos Sócios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Prestação de Contas por Sócio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Sócio</TableHead>
                <TableHead className="text-right">Total Devido (Custo)</TableHead>
                <TableHead className="text-right">Total Aportado</TableHead>
                <TableHead className="text-right">Saldo Individual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.custos_por_socio.map((socio) => (
                <TableRow key={socio.socio_id}>
                  <TableCell className="font-medium">{socio.socio_nome}</TableCell>
                  <TableCell className="text-right text-red-600">{formatBRL(socio.total_devido)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatBRL(socio.total_aportado)}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      socio.saldo < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatBRL(socio.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
            <strong>Nota:</strong> No Modelo 2, as despesas pagas pela conta da Holding são divididas igualmente entre todos os sócios. O saldo individual indica se o sócio precisa realizar novos aportes ou se possui crédito no caixa.
          </div>
        </CardContent>
      </Card>

      {/* Extrato do Caixa da Holding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extrato de Movimentações - Caixa Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.movimentacoes_caixa.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{new Date(mov.data_competencia).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="max-w-[300px] truncate" title={mov.descricao}>
                    {mov.descricao}
                  </TableCell>
                  <TableCell>{mov.categorias_movimentacao?.nome || "Geral"}</TableCell>
                  <TableCell className={`text-right font-mono ${mov.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {mov.tipo === "receita" ? "+" : "-"} {formatBRL(mov.valor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={mov.tipo === "receita" ? "success" : "destructive"} className="text-[10px] uppercase">
                      {mov.tipo === "receita" ? "Aporte" : "Despesa"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.movimentacoes_caixa.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação registrada no caixa desta holding.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
