import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, Gauge, Fuel, MapPin, DollarSign, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CreateMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  month: number;
  year: number;
  previousMonthData: {
    celula_atual?: number | null;
    celula_prox_revisao?: number | null;
    horimetro_final?: number | null;
    base_aerodrome?: string | null;
    fuel_consumption?: string | null;
    has_daily_rate?: boolean | null;
    daily_rate?: number | null;
  } | null;
  onCreate: (data: any) => Promise<void>;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function CreateMonthDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  month: initialMonth,
  year: initialYear,
  previousMonthData,
  onCreate
}: CreateMonthDialogProps) {
  const [loading, setLoading] = useState(false);
  const [aerodromes, setAerodromes] = useState<{ id: string; designativo: string; name: string }[]>([]);
  
  // Seleção de mês/ano - garantir valores válidos
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth ?? new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear ?? new Date().getFullYear());

  // Form state - inicializa vazio para permitir entrada manual
  const [formData, setFormData] = useState({
    celula_anterior_ttotal: 0,
    celula_prox_revisao_ttotal: 0,
    horimetro_inicio: 0,
    horimetro_final: 0,
    aerodromo_base: "",
    consumo_combustivel: "",
    tem_tarifa_diaria: false,
    tarifa_diaria: 0,
  });

  // Gerar anos (5 anos para trás e 2 para frente)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 4 + i);

  useEffect(() => {
    if (open) {
      fetchAerodromes();
      // Validar e garantir que os valores são válidos
      const validMonth = initialMonth ?? new Date().getMonth() + 1;
      const validYear = initialYear ?? new Date().getFullYear();

      setSelectedMonth(validMonth);
      setSelectedYear(validYear);

      // Se há dados anteriores, usa como sugestão inicial
      if (previousMonthData?.celula_atual) {
        setFormData({
          celula_anterior_ttotal: previousMonthData.celula_atual || 0,
          celula_prox_revisao_ttotal: previousMonthData.celula_prox_revisao || 0,
          horimetro_inicio: previousMonthData.horimetro_final || 0,
          horimetro_final: previousMonthData.horimetro_final || 0,
          aerodromo_base: previousMonthData.base_aerodrome || "",
          consumo_combustivel: previousMonthData.fuel_consumption || "",
          tem_tarifa_diaria: previousMonthData.has_daily_rate || false,
          tarifa_diaria: previousMonthData.daily_rate || 0,
        });
      } else {
        // Caso contrário, inicia vazio
        setFormData({
          celula_anterior_ttotal: 0,
          celula_prox_revisao_ttotal: 0,
          horimetro_inicio: 0,
          horimetro_final: 0,
          aerodromo_base: "",
          consumo_combustivel: "",
          tem_tarifa_diaria: false,
          tarifa_diaria: 0,
        });
      }
    }
  }, [open, previousMonthData, initialMonth, initialYear]);

  const fetchAerodromes = async () => {
    const { data } = await supabase
      .from('aerodromes')
      .select('id, designativo, name')
      .order('designativo');
    if (data) setAerodromes(data);
  };

  const handleSubmit = async () => {
    // Validações
    if (formData.celula_anterior_ttotal <= 0) {
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        aeronave_id: aircraftId,
        ano: selectedYear,
        mes: selectedMonth,
        celula_anterior_ttotal: formData.celula_anterior_ttotal,
        celula_atual_ttotal: formData.celula_anterior_ttotal, // Começa igual à anterior
        celula_prox_revisao_ttotal: formData.celula_prox_revisao_ttotal || null,
        celula_disponivel_ttotal: formData.celula_prox_revisao_ttotal
          ? formData.celula_prox_revisao_ttotal - formData.celula_anterior_ttotal
          : null,
        horimetro_inicio: formData.horimetro_inicio || null,
        horimetro_final: formData.horimetro_final || null,
        aerodromo_base: formData.aerodromo_base || null,
        consumo_combustivel: formData.consumo_combustivel || null,
        tem_tarifa_diaria: formData.tem_tarifa_diaria,
        tarifa_diaria: formData.tem_tarifa_diaria ? formData.tarifa_diaria : null,
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-slate-900 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black flex items-center gap-3">
            <Plane className="w-6 h-6 text-sky-500" />
            Iniciar Novo Diário de Bordo
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure os dados iniciais do diário para <span className="text-white font-semibold">{aircraftRegistration}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SELEÇÃO DE MÊS E ANO */}
          <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl space-y-4">
            <Label className="text-sm font-bold text-sky-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Selecione o Mês de Início
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Mês</Label>
                <Select 
                  value={selectedMonth.toString()} 
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {MONTHS.map((m, idx) => (
                      <SelectItem key={idx} value={(idx + 1).toString()} className="text-white">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Ano</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()} className="text-white">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              O diário começará a partir de <span className="text-sky-400 font-semibold">{MONTHS[selectedMonth - 1]}/{selectedYear}</span>. Não é necessário ter registros de meses anteriores.
            </p>
          </div>

          {/* Célula Anterior */}
          <div className="space-y-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <Label className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Célula Anterior (horas) *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={formData.celula_anterior_ttotal || ""}
              onChange={(e) => setFormData({ ...formData, celula_anterior_ttotal: parseFloat(e.target.value) || 0 })}
              className="bg-slate-900 border-emerald-500/50 text-white text-lg font-semibold focus:ring-emerald-500"
              placeholder="Ex: 3250.50"
            />
            <p className="text-xs text-slate-400">
              {previousMonthData?.celula_atual
                ? `Preenchido automaticamente com o valor de "Célula Atual" do mês anterior: ${previousMonthData.celula_atual.toFixed(2)}h`
                : 'Total de horas de célula da aeronave no início deste mês'}
            </p>
          </div>

          {/* Próxima Revisão */}
          <div className="space-y-2 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
            <Label className="text-sm font-bold text-orange-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Próxima Revisão (horas) *
            </Label>
            <Input
              type="number"
              step="0.01"
              value={formData.celula_prox_revisao_ttotal || ""}
              onChange={(e) => setFormData({ ...formData, celula_prox_revisao_ttotal: parseFloat(e.target.value) || 0 })}
              className="bg-slate-900 border-orange-500/50 text-white text-lg font-semibold focus:ring-orange-500"
              placeholder="Ex: 3500.00"
            />
            <p className="text-xs text-slate-400">
              {previousMonthData?.celula_prox_revisao
                ? `Valor anterior sugerido: ${previousMonthData.celula_prox_revisao.toFixed(2)}h - Altere se necessário`
                : 'Horas de célula previstas para a próxima revisão da aeronave'}
            </p>
          </div>

          {/* Horímetro Início */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Horímetro Início
            </Label>
            <Input
              type="number"
              step="0.1"
              value={formData.horimetro_inicio || ""}
              onChange={(e) => setFormData({ ...formData, horimetro_inicio: parseFloat(e.target.value) || 0 })}
              className="bg-slate-950 border-slate-700 text-white"
              placeholder="0.0"
            />
          </div>

          {/* Base Aeródromo */}
          <div className="space-y-2 p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
            <Label className="text-sm font-bold text-violet-400 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Base Aeródromo
            </Label>
            <Select
              value={formData.aerodromo_base}
              onValueChange={(value) => setFormData({ ...formData, aerodromo_base: value })}
            >
              <SelectTrigger className="bg-slate-900 border-violet-500/50 text-white focus:ring-violet-500">
                <SelectValue placeholder="Selecione o aeródromo base" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                {aerodromes.map((ad) => (
                  <SelectItem key={ad.id} value={ad.designativo} className="text-white">
                    {ad.designativo} - {ad.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              {previousMonthData?.base_aerodrome
                ? `Mantém o valor anterior: ${previousMonthData.base_aerodrome} - Editar se necessário`
                : 'Selecione o aeródromo base da aeronave'}
            </p>
          </div>

          {/* Consumo de Combustível */}
          <div className="space-y-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Label className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Fuel className="w-4 h-4" />
              Consumo de Combustível (L/H)
            </Label>
            <Input
              type="text"
              value={formData.consumo_combustivel}
              onChange={(e) => setFormData({ ...formData, consumo_combustivel: e.target.value })}
              className="bg-slate-900 border-amber-500/50 text-white focus:ring-amber-500"
              placeholder="Ex: 45"
            />
            <p className="text-xs text-slate-400">
              {previousMonthData?.fuel_consumption
                ? `Mantém o valor anterior: ${previousMonthData.fuel_consumption} L/H - Editar se necessário`
                : 'Consumo de combustível médio da aeronave (litros por hora)'}
            </p>
          </div>

          {/* Sistema de Diária */}
          <div className="space-y-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm font-bold text-green-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Esta aeronave possui sistema de diárias?
                </Label>
                <p className="text-xs text-slate-400 mt-1">
                  {previousMonthData?.has_daily_rate !== undefined
                    ? `Valor anterior: ${previousMonthData.has_daily_rate ? 'Ativado' : 'Desativado'} - Alterar se necessário`
                    : 'Ative se deseja calcular diárias para voos fora da base'}
                </p>
              </div>
              <Switch
                checked={formData.tem_tarifa_diaria}
                onCheckedChange={(checked) => setFormData({ ...formData, tem_tarifa_diaria: checked })}
              />
            </div>

            {formData.tem_tarifa_diaria && (
              <div className="space-y-2 pt-2 border-t border-green-500/30">
                <Label className="text-xs text-slate-400">Valor da Diária (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tarifa_diaria || ""}
                  onChange={(e) => setFormData({ ...formData, tarifa_diaria: parseFloat(e.target.value) || 0 })}
                  className="bg-slate-900 border-green-500/50 text-white focus:ring-green-500"
                  placeholder="0.00"
                />
                {previousMonthData?.daily_rate && (
                  <p className="text-xs text-slate-400">
                    Valor anterior: R$ {previousMonthData.daily_rate.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preview das Horas Disponíveis */}
          {formData.celula_anterior_ttotal > 0 && formData.celula_prox_revisao_ttotal > 0 && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-500 uppercase font-bold mb-2">Horas Disponíveis para Voo</p>
              <p className={`text-3xl font-black ${
                (formData.celula_prox_revisao_ttotal - formData.celula_anterior_ttotal) < 0
                  ? 'text-red-400'
                  : (formData.celula_prox_revisao_ttotal - formData.celula_anterior_ttotal) < 50
                    ? 'text-orange-400'
                    : 'text-emerald-400'
              }`}>
                {(formData.celula_prox_revisao_ttotal - formData.celula_anterior_ttotal).toFixed(2)}h
              </p>
              <p className="text-xs text-slate-500 mt-1">
                = Próxima Revisão ({formData.celula_prox_revisao_ttotal.toFixed(2)}) - Célula Anterior ({formData.celula_anterior_ttotal.toFixed(2)})
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || formData.celula_anterior <= 0}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plane className="mr-2 h-4 w-4" />
                Iniciar Diário
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
