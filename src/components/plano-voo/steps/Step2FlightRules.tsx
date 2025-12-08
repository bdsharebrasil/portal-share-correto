import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Settings } from "lucide-react";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step2Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

const FLIGHT_RULES = [
  { value: "I", label: "I - IFR" },
  { value: "V", label: "V - VFR" },
  { value: "Y", label: "Y - IFR primeiro, depois VFR" },
  { value: "Z", label: "Z - VFR primeiro, depois IFR" },
];

const FLIGHT_TYPES = [
  { value: "S", label: "S - Transporte Aéreo Regular" },
  { value: "N", label: "N - Transporte Aéreo Não Regular" },
  { value: "G", label: "G - Aviação Geral" },
  { value: "M", label: "M - Militar" },
  { value: "X", label: "X - Outra categoria" },
];

const WAKE_CATEGORIES = [
  { value: "J", label: "J - Super (A380)" },
  { value: "H", label: "H - Heavy (> 136.000 kg)" },
  { value: "M", label: "M - Medium (7.000 - 136.000 kg)" },
  { value: "L", label: "L - Light (< 7.000 kg)" },
];

export function Step2FlightRules({ formData, updateFormData }: Step2Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Flight Rules Section */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <FileText className="h-5 w-5 text-cyan-400" />
            </div>
            8 - Regras de Voo e Tipo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Regras de Voo *</Label>
              <Select
                value={formData.flightRules}
                onValueChange={(value) => updateFormData({ flightRules: value })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FLIGHT_RULES.map((rule) => (
                    <SelectItem key={rule.value} value={rule.value}>
                      {rule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Voo *</Label>
              <Select
                value={formData.flightType}
                onValueChange={(value) => updateFormData({ flightType: value })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FLIGHT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aircraft Details Section */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Settings className="h-5 w-5 text-blue-400" />
            </div>
            9 - Número de Aeronaves e Categoria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Número de Aeronaves</Label>
              <Input
                value={formData.numberOfAircraft}
                onChange={(e) => updateFormData({ numberOfAircraft: e.target.value })}
                placeholder="1"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Categoria de Esteira</Label>
              <Select
                value={formData.wakeCategory}
                onValueChange={(value) => updateFormData({ wakeCategory: value })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {WAKE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Equipamento</Label>
              <Input
                value={formData.equipment}
                onChange={(e) => updateFormData({ equipment: e.target.value })}
                placeholder="Ex: SDFGHIRY"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Transponder</Label>
              <Input
                value={formData.transponder}
                onChange={(e) => updateFormData({ transponder: e.target.value })}
                placeholder="Ex: LB1"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
