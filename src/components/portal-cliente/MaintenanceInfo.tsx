import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Calendar, DollarSign, Gauge, Fuel } from "lucide-react"

interface MaintenanceInfoProps {
  sharePercentage: number
  fuelCost: number
}

export function MaintenanceInfo({ sharePercentage, fuelCost }: MaintenanceInfoProps) {
  const maintenanceData = {
    tireWear: 65,
    tireReplacementCost: 8500,
    nextRevision: "2025-09-15",
    lastMaintenance: "2025-06-20",
    maintenanceType: "100h",
  }

  const clientTireCost = (maintenanceData.tireReplacementCost * sharePercentage) / 100

  return (
    <div className="space-y-8">
      <Card className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-amber-600/30 shadow-lg backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-3">
            <Fuel className="h-6 w-6 text-amber-400" />
            <h4 className="font-semibold text-amber-300 text-lg">Combustível (Custo Individual)</h4>
          </div>
          <p className="text-3xl font-bold text-amber-400 mb-2">
            R$ {fuelCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-base text-amber-300/80 mt-1">Este mês</p>
          <p className="text-sm text-amber-400/60 mt-1">*Custo não compartilhado</p>
        </CardContent>
      </Card>

      <div className="space-y-4 p-6 bg-card-secondary/40 rounded-lg border border-border/50 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-blue-400" />
          <h4 className="font-semibold text-white text-lg">Desgaste dos Pneus</h4>
        </div>
        <Progress value={maintenanceData.tireWear} className="h-4" />
        <div className="flex justify-between text-base text-muted-foreground">
          <span>{maintenanceData.tireWear}% de desgaste</span>
          <span>{100 - maintenanceData.tireWear}% de vida útil restante</span>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-red-900/20 to-red-800/20 border-red-600/30 shadow-lg backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-6 w-6 text-red-400" />
            <h4 className="font-semibold text-red-300 text-lg">Custo da Próxima Troca de Pneus</h4>
          </div>
          <div className="space-y-3">
            <p className="text-base text-red-300/80">
              Custo total: R${" "}
              {maintenanceData.tireReplacementCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xl font-bold text-red-400">
              Sua parte ({sharePercentage}%): R$ {clientTireCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-900/20 to-blue-800/20 rounded-lg border border-blue-600/30 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-400" />
          <div>
            <h4 className="font-semibold text-blue-300 text-lg">Próxima Revisão</h4>
            <p className="text-base text-blue-300/80">
              {new Date(maintenanceData.nextRevision).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-blue-400/50 text-blue-300 bg-blue-900/20 px-4 py-2 text-base">
          {maintenanceData.maintenanceType}
        </Badge>
      </div>

      <div className="text-base text-muted-foreground p-5 bg-card-secondary/40 rounded-lg border border-border/50 backdrop-blur-sm">
        <p>
          <strong className="text-white">Última manutenção:</strong> {new Date(maintenanceData.lastMaintenance).toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  )
}
