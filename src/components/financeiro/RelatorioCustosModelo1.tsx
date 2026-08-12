// @ts-nocheck
import React from "react";
import { useRelatorioCustosModelo1 } from "@/hooks/useRelatorioCustosModelo1";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

interface RelatorioCustosModelo1Props {
  aeronaveId: string;
  dataInicio?: string;
  dataFim?: string;
}

export const RelatorioCustosModelo1: React.FC<RelatorioCustosModelo1Props> = ({
  aeronaveId,
  dataInicio,
  dataFim,
}) => {
  const { data, isLoading } = useRelatorioCustosModelo1(aeronaveId, dataInicio, dataFim);

  if (isLoading) return <div>Carregando relatório...</div>;
  if (!data) return <div>Nenhum dado encontrado para esta aeronave.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Despesas (Rateáveis)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(data.total_despesas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Terceiro Custo (Não Rateável)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatBRL(data.total_terceiro_custo)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aeronave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.aeronave_registro}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balanço por Cotista (Modelo 1)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cotista</TableHead>
                <TableHead className="text-right">Cota (%)</TableHead>
                <TableHead className="text-right">Valor Devido</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.custos_por_cotista.map((custo) => (
                <TableRow key={custo.cliente_id}>
                  <TableCell className="font-medium">{custo.cliente_nome}</TableCell>
                  <TableCell className="text-right">{custo.percentual_rateio}%</TableCell>
                  <TableCell className="text-right">{formatBRL(custo.valor_devido)}</TableCell>
                  <TableCell className="text-right">{formatBRL(custo.valor_pago)}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      custo.saldo < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatBRL(custo.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.despesas_detalhadas.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell>{new Date(mov.data_emissao).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{mov.descricao}</TableCell>
                  <TableCell>{mov.categorias_movimentacao?.nome || "Geral"}</TableCell>
                  <TableCell className="text-right">{formatBRL(mov.valor)}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        mov.status === "pago"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {mov.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
