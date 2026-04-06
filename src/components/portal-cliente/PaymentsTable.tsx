import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileText, Upload } from "lucide-react"

const payments = [
  {
    id: 1,
    date: "2025-07-15",
    amount: 18200.0,
    status: "pending",
    description: "Manutenção + Hangar + Seguro",
    dueDate: "2025-08-15",
    hasInvoice: true,
    hasBoleto: true,
  },
  {
    id: 2,
    date: "2025-06-15",
    amount: 15800.0,
    status: "paid",
    description: "Manutenção + Hangar + Seguro",
    dueDate: "2025-07-15",
    hasInvoice: true,
    hasBoleto: true,
    paidDate: "2025-07-10",
  },
  {
    id: 3,
    date: "2025-05-15",
    amount: 16500.0,
    status: "paid",
    description: "Manutenção + Hangar + Seguro + Revisão",
    dueDate: "2025-06-15",
    hasInvoice: true,
    hasBoleto: true,
    paidDate: "2025-06-12",
  },
]

export function PaymentsTable() {
  return (
    <Card className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 shadow-lg border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-700/60 to-slate-700/40 rounded-t-lg">
        <CardTitle className="flex items-center gap-3 text-white text-xl">
          <FileText className="h-6 w-6 text-cyan-400" />
          Histórico de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-300 text-base font-semibold">Data</TableHead>
              <TableHead className="text-slate-300 text-base font-semibold">Descrição</TableHead>
              <TableHead className="text-slate-300 text-base font-semibold">Valor</TableHead>
              <TableHead className="text-slate-300 text-base font-semibold">Vencimento</TableHead>
              <TableHead className="text-slate-300 text-base font-semibold">Status</TableHead>
              <TableHead className="text-slate-300 text-base font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id} className="hover:bg-slate-700/30 border-slate-700">
                <TableCell className="text-white text-base">{new Date(payment.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-white text-base">{payment.descricao}</TableCell>
                <TableCell className="font-semibold text-emerald-400 text-lg">
                  R$ {payment.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-white text-base">{new Date(payment.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={payment.situacao === "paid" ? "default" : "secondary"} 
                         className={payment.situacao === "paid" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                    {payment.situacao === "paid" ? "Pago" : "Pendente"}
                  </Badge>
                  {payment.paidDate && (
                    <p className="text-sm text-slate-400 mt-1">
                      Pago em {new Date(payment.paidDate).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {payment.hasInvoice && (
                      <Button size="sm" variant="outline" className="hover:bg-slate-600/50 bg-slate-700/50 border-slate-600 text-white">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {payment.hasBoleto && payment.situacao === "pending" && (
                      <Button size="sm" variant="outline" className="hover:bg-slate-600/50 bg-slate-700/50 border-slate-600 text-white">
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {payment.situacao === "pending" && (
                      <Button size="sm" variant="outline" className="hover:bg-slate-600/50 bg-slate-700/50 border-slate-600 text-white">
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
