import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateToBR } from "@/lib/date-utils";
import { DollarSign, FileText, ArrowDownCircle, ArrowUpCircle, Receipt } from "lucide-react";

interface EmployeeStatementTabProps {
  employeeId: string;
  employeeName: string;
}

interface StatementEntry {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo_movimento: string;
  grupo_categoria: string | null;
  status: string | null;
  comprovante_url: string | null;
}

export function EmployeeStatementTab({ employeeId, employeeName }: EmployeeStatementTabProps) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["employee_statement", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          id,
          data,
          descricao,
          valor,
          tipo_movimento,
          grupo_categoria,
          status,
          comprovante_url
        `)
        .eq("colaborador_id", employeeId)
        .order("data", { ascending: false });

      if (error) {
        console.error("Erro ao buscar extrato do colaborador:", error);
        return [];
      }

      return (data || []) as StatementEntry[];
    },
    enabled: !!employeeId,
  });

  // Cálculo do resumo financeiro
  const resumo = {
    totalSalarios: 0,
    totalDecimoTerceiro: 0,
    totalFerias: 0,
    totalAdiantamentos: 0,
    totalBeneficios: 0,
    totalOutros: 0,
    totalGeral: 0,
  };

  entries.forEach((l) => {
    const desc = l.descricao?.toLowerCase() || "";
    const valor = Number(l.valor) || 0;

    if (desc.includes("salário") && !desc.includes("13")) {
      resumo.totalSalarios += valor;
    } else if (desc.includes("13º") || desc.includes("décimo") || desc.includes("decimo")) {
      resumo.totalDecimoTerceiro += valor;
    } else if (desc.includes("férias") || desc.includes("ferias")) {
      resumo.totalFerias += valor;
    } else if (desc.includes("adiantamento")) {
      resumo.totalAdiantamentos += valor;
    } else if (desc.includes("benefício") || desc.includes("beneficio") || desc.includes("vale")) {
      resumo.totalBeneficios += valor;
    } else {
      resumo.totalOutros += valor;
    }

    resumo.totalGeral += valor;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getCategoryBadgeColor = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes("salário") && !d.includes("13")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (d.includes("13º") || d.includes("décimo") || d.includes("decimo")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (d.includes("férias") || d.includes("ferias")) return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    if (d.includes("adiantamento")) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (d.includes("benefício") || d.includes("beneficio") || d.includes("vale")) return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    if (d.includes("viagem") || d.includes("relatório")) return "bg-pink-500/20 text-pink-400 border-pink-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const getCategoryLabel = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes("salário") && !d.includes("13")) return "Salário";
    if (d.includes("13º") || d.includes("décimo") || d.includes("decimo")) return "13º Salário";
    if (d.includes("férias") || d.includes("ferias")) return "Férias";
    if (d.includes("adiantamento")) return "Adiantamento";
    if (d.includes("benefício") || d.includes("beneficio") || d.includes("vale")) return "Benefício";
    if (d.includes("viagem") || d.includes("relatório")) return "Relatório Viagem";
    return "Outros";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Extrato de Pagamentos
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de pagamentos de {employeeName}
        </p>
      </div>

      {/* Resumo Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Salários</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(resumo.totalSalarios)}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">13º Salário</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(resumo.totalDecimoTerceiro)}</p>
          </CardContent>
        </Card>
        <Card className="bg-sky-500/10 border-sky-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Férias</p>
            <p className="text-lg font-bold text-sky-400">{formatCurrency(resumo.totalFerias)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Adiantamentos</p>
            <p className="text-lg font-bold text-orange-400">{formatCurrency(resumo.totalAdiantamentos)}</p>
          </CardContent>
        </Card>
        <Card className="bg-violet-500/10 border-violet-500/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Benefícios</p>
            <p className="text-lg font-bold text-violet-400">{formatCurrency(resumo.totalBeneficios)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(resumo.totalGeral)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de lançamentos */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Histórico de Lançamentos ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum lançamento encontrado para este colaborador.</p>
              <p className="text-sm mt-1">Os lançamentos aparecerão aqui quando forem registrados com o colaborador vinculado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[120px]">Categoria</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="text-right w-[120px]">Valor</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        {formatDateToBR(entry.data)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate" title={entry.descricao}>
                        {entry.descricao}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getCategoryBadgeColor(entry.descricao)}`}
                        >
                          {getCategoryLabel(entry.descricao)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {entry.tipo_movimento === "saida" ? (
                            <ArrowDownCircle className="h-4 w-4 text-red-400" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
                          )}
                          <span className="text-xs text-muted-foreground capitalize">
                            {entry.tipo_movimento || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={entry.tipo_movimento === "saida" ? "text-red-400" : "text-emerald-400"}>
                          {formatCurrency(entry.valor)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            entry.status === "pago" || entry.status === "concluido"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : entry.status === "pendente"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {entry.status || "—"}
                        </Badge>
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
  );
}
