import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Plus, Save, FileText, User, Plane, Shield } from "lucide-react";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step5Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

const CHECKLIST_CATEGORIES = [
  {
    id: "documentacao",
    title: "Documentação",
    icon: FileText,
    color: "bg-cyan-500/20 text-cyan-400",
    items: [
      { id: "cht_aeronave", label: "Verificar CHT (Certificado de Habilitação Técnica) da aeronave" },
      { id: "civ", label: "Verificar CIV (Certificado de Identificação da Aeronave)" },
      { id: "seguro", label: "Verificar seguro obrigatório da aeronave" },
      { id: "cht_piloto", label: "Verificar CHT do piloto" },
      { id: "cma", label: "Verificar CMA (Certificado Médico Aeronáutico)" },
      { id: "ca", label: "Verificar CA (Certificado de Aeronavegabilidade)" },
      { id: "reva", label: "Verificar REVA (Registro de Propriedade)" },
    ],
  },
  {
    id: "piloto",
    title: "Piloto",
    icon: User,
    color: "bg-blue-500/20 text-blue-400",
    items: [
      { id: "canac_valido", label: "CANAC válido" },
      { id: "habilitacao_tipo", label: "Habilitação para o tipo de aeronave" },
      { id: "cheque_recente", label: "Cheque de proficiência em dia" },
      { id: "horas_descanso", label: "Horas de descanso cumpridas" },
      { id: "passaporte", label: "Passaporte/documentos (voos internacionais)" },
    ],
  },
  {
    id: "aeronave",
    title: "Aeronave",
    icon: Plane,
    color: "bg-purple-500/20 text-purple-400",
    items: [
      { id: "inspecao_prevoo", label: "Inspeção pré-voo realizada" },
      { id: "combustivel", label: "Combustível verificado e suficiente" },
      { id: "oleo", label: "Nível de óleo verificado" },
      { id: "pneus", label: "Condição dos pneus verificada" },
      { id: "luzes", label: "Luzes de navegação funcionando" },
      { id: "transponder", label: "Transponder testado" },
      { id: "radio", label: "Comunicação rádio testada" },
    ],
  },
  {
    id: "operacional",
    title: "Operacional",
    icon: Shield,
    color: "bg-amber-500/20 text-amber-400",
    items: [
      { id: "notam", label: "NOTAM consultados" },
      { id: "metar_taf", label: "METAR/TAF verificados" },
      { id: "peso_balanceamento", label: "Peso e balanceamento calculados" },
      { id: "plano_arquivo", label: "Plano de voo arquivado" },
      { id: "briefing_passageiros", label: "Briefing de passageiros (se aplicável)" },
      { id: "kit_emergencia", label: "Kit de emergência verificado" },
      { id: "carta_navegacao", label: "Cartas de navegação atualizadas" },
    ],
  },
];

export function Step5Checklist({ formData, updateFormData }: Step5Props) {
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>(
    formData.checklistItems || {}
  );

  const toggleItem = (itemId: string) => {
    const newItems = { ...checklistItems, [itemId]: !checklistItems[itemId] };
    setChecklistItems(newItems);
    updateFormData({ checklistItems: newItems });
  };

  const totalItems = CHECKLIST_CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0);
  const checkedItems = Object.values(checklistItems).filter(Boolean).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  const markAllInCategory = (categoryId: string) => {
    const category = CHECKLIST_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    const newItems = { ...checklistItems };
    category.items.forEach((item) => {
      newItems[item.id] = true;
    });
    setChecklistItems(newItems);
    updateFormData({ checklistItems: newItems });
  };

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-cyan-500/20">
                <ClipboardCheck className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Checklist Pré-Voo</h2>
                <p className="text-cyan-300/70 text-sm">Progresso: {Math.round(progress)}%</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-cyan-400">{checkedItems}</span>
              <span className="text-slate-400"> de {totalItems} itens</span>
            </div>
          </div>
          <Progress value={progress} className="h-3 bg-slate-700" />
        </CardContent>
      </Card>

      {/* Checklist Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CHECKLIST_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const categoryChecked = category.items.filter((item) => checklistItems[item.id]).length;

          return (
            <Card key={category.id} className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="border-b border-slate-700/50">
                <CardTitle className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {category.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">
                      {categoryChecked}/{category.items.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllInCategory(category.id)}
                      className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                    >
                      Marcar todos
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        checklistItems[item.id]
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : "bg-slate-900/30 hover:bg-slate-900/50 border border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={checklistItems[item.id] || false}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="mt-0.5 border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                      <span
                        className={`text-sm ${
                          checklistItems[item.id] ? "text-emerald-300 line-through" : "text-slate-300"
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion Alert */}
      {progress === 100 && (
        <Card className="bg-emerald-900/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <ClipboardCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-400">Checklist Completo!</p>
                <p className="text-sm text-emerald-300/80">
                  Todos os itens foram verificados. Você pode prosseguir para o resumo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
