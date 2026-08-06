import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  User,
} from "lucide-react";

interface EmployeeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    salary?: {
       salario_bruto: number;
    } | null;
    thirteenth?: {
      gross_value: number;
      net_value: number;
      first_installment_amount: number;
      second_installment_amount: number;
    } | null;
    firstInstallmentDate?: string | null;
    secondInstallmentDate?: string | null;
    calculatedStatus?: "pending" | "partial_paid" | "paid";
  } | null;
  selectedYear: number;
}

export function EmployeeDetailsDialog({
  open,
  onOpenChange,
  employee,
  selectedYear,
}: EmployeeDetailsDialogProps) {
  if (!employee) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full px-3 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Pago
          </Badge>
        );
      case "partial_paid":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Parcial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border rounded-full px-3 py-1">
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            Pendente
          </Badge>
        );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detalhes do 13º Salário - {selectedYear}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Seção de Perfil */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-6 border-b border-border">
            <Avatar className="h-24 w-24 rounded-xl">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                {getInitials(employee.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {employee.full_name}
                </h3>
                <p className="text-sm text-muted-foreground">{employee.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Status Financeiro:
                </span>
                {getStatusBadge(employee.calculatedStatus)}
              </div>
            </div>
          </div>

          {/* Seção de Salário Base */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Salário Base Registrado
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {employee.salary?. salario_bruto
                      ? formatCurrency(employee.salary.salario_bruto)
                      : "Não registrado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seção de 13º Salário */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Décimo Terceiro Salário - {selectedYear}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1ª Parcela */}
              <Card className="border-border/50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        1ª Parcela (Novembro)
                      </p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        {employee.thirteenth
                          ? formatCurrency(
                              employee.thirteenth.first_installment_amount
                            )
                          : "Não registrado"}
                      </p>
                    </div>

                    <div>
                      {employee.firstInstallmentDate ? (
                        <div className="space-y-2">
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full text-xs w-fit">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Pago
                          </Badge>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(employee.firstInstallmentDate)}
                          </p>
                        </div>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-border rounded-full text-xs w-fit">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2ª Parcela */}
              <Card className="border-border/50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        2ª Parcela (Dezembro)
                      </p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        {employee.thirteenth
                          ? formatCurrency(
                              employee.thirteenth.second_installment_amount
                            )
                          : "Não registrado"}
                      </p>
                    </div>

                    <div>
                      {employee.secondInstallmentDate ? (
                        <div className="space-y-2">
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 rounded-full text-xs w-fit">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Pago
                          </Badge>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(employee.secondInstallmentDate)}
                          </p>
                        </div>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-border rounded-full text-xs w-fit">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumo de Valores */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground font-medium">
                      Valor Bruto
                    </p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {employee.thirteenth
                        ? formatCurrency(employee.thirteenth.gross_value)
                        : "Não registrado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">
                      Valor Líquido
                    </p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {employee.thirteenth
                        ? formatCurrency(employee.thirteenth.net_value)
                        : "Não registrado"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
