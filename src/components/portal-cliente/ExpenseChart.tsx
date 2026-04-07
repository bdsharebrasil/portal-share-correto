import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, PieChart } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const expenseData = [
  { category: "Manutenção", amount: 8500, color: "bg-cyan-500", percentage: 47 },
  { category: "Hangar", amount: 4200, color: "bg-emerald-500", percentage: 23 },
  { category: "Seguro", amount: 3800, color: "bg-amber-500", percentage: 21 },
  { category: "Combustível", amount: 1700, color: "bg-orange-500", percentage: 9 },
]

export function ExpenseChart() {
  const [type, setType] = useState<"bar" | "pie">("pie")
  const total = expenseData.reduce((sum, item) => sum + item.amount, 0)

  return (
    <Card className="bg-gradient-to-br from-slate-800/60 to-slate-800/40 shadow-lg border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-700/60 to-slate-700/40 rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-white text-xl">
            {type === "bar" ? <BarChart3 className="h-6 w-6 text-cyan-400" /> : <PieChart className="h-6 w-6 text-cyan-400" />}
            Distribuição de Gastos - Este Mês
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={type === "bar" ? "default" : "outline"}
              onClick={() => setType("bar")}
              className={type === "bar" ? "bg-cyan-600 hover:bg-cyan-500" : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Barras
            </Button>
            <Button 
              size="sm" 
              variant={type === "pie" ? "default" : "outline"}
              onClick={() => setType("pie")}
              className={type === "pie" ? "bg-cyan-600 hover:bg-cyan-500" : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"}
            >
              <PieChart className="h-4 w-4 mr-1" />
              Pizza
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {type === "bar" ? (
          <div className="space-y-6">
            {expenseData.map((item, index) => (
              <div key={index} className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="font-medium text-white">{item.category}</span>
                  <span className="text-white">R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-4">
                  <div className={`h-4 rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }}></div>
                </div>
              </div>
            ))}
            <div className="pt-6 border-t border-slate-600">
              <div className="flex justify-between font-bold text-lg">
                <span className="text-white">Total</span>
                <span className="text-emerald-400">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-center gap-12">
            <div className="relative w-72 h-72">
              <div className="w-full h-full rounded-full border-8 border-cyan-500 relative overflow-hidden bg-slate-800">
                <div
                  className="absolute inset-0 bg-emerald-500 rounded-full"
                  style={{
                    clipPath: "polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)",
                  }}
                ></div>
                <div
                  className="absolute inset-0 bg-amber-500 rounded-full"
                  style={{
                    clipPath: "polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)",
                  }}
                ></div>
                <div
                  className="absolute inset-0 bg-orange-500 rounded-full"
                  style={{
                    clipPath: "polygon(50% 50%, 50% 100%, 0% 100%, 0% 75%)",
                  }}
                ></div>
              </div>
            </div>
            <div className="space-y-4">
              {expenseData.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded ${item.color}`}></div>
                  <span className="text-base text-white min-w-[120px]">{item.categoria}</span>
                  <span className="text-base font-medium text-white">
                    R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-400 text-sm">({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
