import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface OASMaintenanceExpensesTableProps {
  orderId: string;
}

export function OASMaintenanceExpensesTable({ orderId }: OASMaintenanceExpensesTableProps) {
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);

  // Fetch despesas de manutenção vinculadas à OAS
  const { data: despesasManutencao = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["oas-despesas-manutencao", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_manutencao")
        .select("*")
        .eq("service_order_id", orderId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch rateios para cada despesa
  const despesaIds = useMemo(() => despesasManutencao.map((d) => d.id), [despesasManutencao]);

  const { data: allRateios = {}, isLoading: loadingRateios } = useQuery({
    queryKey: ["despesas-rateios", orderId],
    queryFn: async () => {
      if (despesaIds.length === 0) return {};

      const { data, error } = await supabase
        .from("despesas_manutencao_rateio")
        .select("*")
        .in("despesa_manutencao_id", despesaIds);

      if (error) throw error;

      // Organizar rateios por despesa_id
      const organized: Record<string, any[]> = {};
      (data || []).forEach((rateio) => {
        if (!organized[rateio.despesa_manutencao_id]) {
          organized[rateio.despesa_manutencao_id] = [];
        }
        organized[rateio.despesa_manutencao_id].push(rateio);
      });

      return organized;
    },
    enabled: despesaIds.length > 0,
  });

  // Fetch parceiros (sócios) com nomes
  const clientId = useMemo(() => despesasManutencao[0]?.client_id, [despesasManutencao]);

  const { data: partners = {}, isLoading: loadingPartners } = useQuery({
    queryKey: ["partners-info", clientId || ""],
    queryFn: async () => {
      if (!clientId) return {};

      const { data, error } = await supabase
        .from("socios")
        .select("id, nome, cpf")
        .eq("cliente_id", clientId);

      if (error) throw error;

      // Organizar por ID
      const organized: Record<string, any> = {};
      (data || []).forEach((partner) => {
        organized[partner.id] = partner;
      });

      return organized;
    },
    enabled: !!clientId,
  });

  const isLoading = loadingDespesas || loadingRateios || loadingPartners;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (despesasManutencao.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma despesa de manutenção registrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcular totais por sócio
  const totaisPorSocio: Record<string, number> = {};
  despesasManutencao.forEach((despesa) => {
    const rateios = allRateios[despesa.id] || [];
    rateios.forEach((rateio) => {
      if (!totaisPorSocio[rateio.socio_cliente_id_id]) {
        totaisPorSocio[rateio.socio_cliente_id_id] = 0;
      }
      totaisPorSocio[rateio.socio_cliente_id_id] += rateio.valor || 0;
    });
  });

  const totalGeral = Object.values(totaisPorSocio).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      {/* Resumo Total por Sócio */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Resumo por Sócio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(totaisPorSocio).map(([partnerId, total]) => {
              const partner = partners[partnerId];
              return (
                <div key={partnerId} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {partner?.nome || "Sócio desconhecido"}
                  </p>
                  <p className="text-lg font-bold text-blue-400">
                    R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 lg:col-span-3 md:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Total Geral</p>
              <p className="text-xl font-black text-cyan-400">
                R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada de Despesas */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Detalhes de Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Tipo de Rateio</TableHead>
                  <TableHead className="text-xs text-right">Valor Total</TableHead>
                  <TableHead className="text-xs text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesasManutencao.map((despesa) => {
                  const rateios = allRateios[despesa.id] || [];
                  const isExpanded = expandedExpense === despesa.id;

                  return (
                    <div key={despesa.id} className="block">
                      <TableRow
                        className={cn(
                          "hover:bg-white/5 cursor-pointer border-white/10",
                          isExpanded && "bg-white/5"
                        )}
                        onClick={() =>
                          setExpandedExpense(isExpanded ? null : despesa.id)
                        }
                      >
                        <TableCell className="font-medium text-sm">
                          {despesa.descricao}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize bg-white/5 border-white/20"
                          >
                            {despesa.tipo_rateio === "igual" && "Igual"}
                            {despesa.tipo_rateio === "por_uso" && "Por Uso"}
                            {despesa.tipo_rateio === "manual" && "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          R${" "}
                          {(despesa.valor || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground">
                            {rateios.length} sócio{rateios.length !== 1 ? "s" : ""}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details */}
                      {isExpanded && rateios.length > 0 && (
                        <TableRow className="bg-white/5 hover:bg-white/5 border-white/10">
                          <TableCell colSpan={4}>
                            <div className="py-4">
                              <p className="text-xs font-semibold text-muted-foreground mb-3">
                                Rateio por Sócio:
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {rateios.map((rateio) => {
                                  const partner = partners[rateio.socio_cliente_id_id];
                                  return (
                                    <div
                                      key={rateio.id}
                                      className="bg-white/5 border border-white/10 rounded p-3 text-sm"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <p className="font-medium text-white">
                                          {partner?.nome || "Desconhecido"}
                                        </p>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs",
                                            rateio.status_pagamento === "pago"
                                              ? "bg-green-500/20 border-green-500/30 text-green-300"
                                              : rateio.status_pagamento === "parcial"
                                                ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300"
                                                : "bg-gray-500/20 border-gray-500/30 text-gray-300"
                                          )}
                                        >
                                          {rateio.status_pagamento === "pago"
                                            ? "Pago"
                                            : rateio.status_pagamento === "parcial"
                                              ? "Parcial"
                                              : "Pendente"}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {rateio.percentual
                                          ? `${rateio.percentual.toLocaleString("pt-BR", {
                                              minimumFractionDigits: 2,
                                            })}%`
                                          : "-"}
                                      </p>
                                      <p className="text-base font-bold text-cyan-400">
                                        R${" "}
                                        {(rateio.valor || 0).toLocaleString(
                                          "pt-BR",
                                          { minimumFractionDigits: 2 }
                                        )}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </div>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
