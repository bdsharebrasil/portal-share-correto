import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CTMServiceOrder, MAINTENANCE_CATEGORIES, MaintenanceCategory } from "@/types/ctm";
import { format } from "date-fns";
interface NewServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  onServiceOrderCreated?: (order: CTMServiceOrder) => void;
}
const MAINTENANCE_TYPES = ["CORRETIVO", "50HORAS", "100HORAS", "CVA", "HELICE_GOVERNADOR", "OLEO", "PNEU_DIREITO", "PNEU_ESQUERDO", "PNEU_TREM_NARIZ"];
const SERVICE_STATUS = ["PLANEJADA", "INICIADA", "EM_ANDAMENTO", "CONCLUÍDA", "CANCELADA", "SUSPENSA"];

// Helper para obter data de hoje sem problemas de timezone
const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function NewServiceOrderDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  onServiceOrderCreated
}: NewServiceOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    numero: "",
    tipo_manutencao: "CORRETIVO" as MaintenanceCategory,
    os_oficina: "",
    oficina_nome: "",
    oficina_contato: "",
    data_entrada: getTodayString(),
    data_saida: "",
    dias_previstos: "",
    dias_efetivos: "",
    horas_celula: "",
    objetivo: "",
    observacoes: "",
    status: "PLANEJADA",
    total_mao_obra: "",
    total_pecas: ""
  });
  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!formData.numero || !formData.tipo_manutencao) {
      toast.error("Número e tipo de manutenção são obrigatórios");
      return;
    }
    if (!formData.oficina_nome) {
      toast.error("Nome da oficina é obrigatório");
      return;
    }
    setLoading(true);
    try {
      const serviceOrderData = {
        aircraft_id: aircraftId,
        numero: formData.numero,
        tipo_manutencao: formData.tipo_manutencao,
        os_oficina: formData.os_oficina || null,
        oficina_nome: formData.oficina_nome,
        oficina_contato: formData.oficina_contato || null,
        data_entrada: formData.data_entrada,
        data_saida: formData.data_saida || null,
        dias_previstos: formData.dias_previstos ? parseInt(formData.dias_previstos) : null,
        dias_efetivos: formData.dias_efetivos ? parseInt(formData.dias_efetivos) : null,
        horas_celula: formData.horas_celula ? parseFloat(formData.horas_celula) : null,
        objetivo: formData.objetivo || null,
        observacoes: formData.observacoes || null,
        status: formData.status,
        total_mao_obra: formData.total_mao_obra ? parseFloat(formData.total_mao_obra) : null,
        total_pecas: formData.total_pecas ? parseFloat(formData.total_pecas) : null,
        total_geral: formData.total_mao_obra || formData.total_pecas ? parseFloat(formData.total_mao_obra || "0") + parseFloat(formData.total_pecas || "0") : null
      };
      const {
        data,
        error
      } = await supabase.from("ctm_service_orders").insert([serviceOrderData]).select().single();
      if (error) throw error;
      toast.success(`Ordem de Serviço nº ${formData.numero} registrada com sucesso!`);
      onServiceOrderCreated?.(data as unknown as CTMServiceOrder);
      setFormData({
        numero: "",
        tipo_manutencao: "CORRETIVO",
        os_oficina: "",
        oficina_nome: "",
        oficina_contato: "",
        data_entrada: getTodayString(),
        data_saida: "",
        dias_previstos: "",
        dias_efetivos: "",
        horas_celula: "",
        objetivo: "",
        observacoes: "",
        status: "PLANEJADA",
        total_mao_obra: "",
        total_pecas: ""
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao registrar O.S.:", error);
      toast.error(error.message || "Erro ao registrar Ordem de Serviço");
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nova Ordem de Serviço (O.S.)</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação da O.S. */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Identificação da O.S.</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número da O.S. *</Label>
                <Input id="numero" placeholder="Ex: OS-2024-001" value={formData.numero} onChange={e => handleChange("numero", e.target.value)} required />
              </div>
              
            </div>
          </div>

          {/* Aeronave e Tipo de Manutenção */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Aeronave e Tipo de Manutenção</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Aeronave</Label>
                <Input disabled value={aircraftRegistration} />
              </div>
              <div>
                <Label htmlFor="tipo_manutencao">Tipo de Manutenção *</Label>
                <Select value={formData.tipo_manutencao} onValueChange={val => handleChange("tipo_manutencao", val)}>
                  <SelectTrigger id="tipo_manutencao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map(type => <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Oficina */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dados da Oficina</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="oficina_nome">Nome da Oficina *</Label>
                <Input id="oficina_nome" placeholder="Ex: Avionics Brasil" value={formData.oficina_nome} onChange={e => handleChange("oficina_nome", e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="oficina_contato">Contato / Telefone</Label>
                <Input id="oficina_contato" placeholder="Ex: (11) 98765-4321 ou contato@oficina.com" value={formData.oficina_contato} onChange={e => handleChange("oficina_contato", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Datas</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="data_entrada">Data de Entrada *</Label>
                <Input id="data_entrada" type="date" value={formData.data_entrada} onChange={e => handleChange("data_entrada", e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="data_saida">Data de Saída (Prevista)</Label>
                <Input id="data_saida" type="date" value={formData.data_saida} onChange={e => handleChange("data_saida", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={val => handleChange("status", val)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_STATUS.map(status => <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Duração e Horas</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dias_previstos">Dias Previstos</Label>
                <Input id="dias_previstos" type="number" placeholder="Ex: 5" value={formData.dias_previstos} onChange={e => handleChange("dias_previstos", e.target.value)} min="0" step="1" />
              </div>
              <div>
                <Label htmlFor="dias_efetivos">Dias Efetivos</Label>
                <Input id="dias_efetivos" type="number" placeholder="Ex: 4" value={formData.dias_efetivos} onChange={e => handleChange("dias_efetivos", e.target.value)} min="0" step="1" />
              </div>
              <div>
                <Label htmlFor="horas_celula">Horas de Célula</Label>
                <Input id="horas_celula" type="number" placeholder="Ex: 50.5" value={formData.horas_celula} onChange={e => handleChange("horas_celula", e.target.value)} min="0" step="0.5" />
              </div>
            </div>
          </div>

          {/* Objetivo e Observações */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Detalhes</h3>
            <div>
              <Label htmlFor="objetivo">Objetivo da Manutenção</Label>
              <Textarea id="objetivo" placeholder="Descreva o objetivo desta manutenção..." value={formData.objetivo} onChange={e => handleChange("objetivo", e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor="observacoes">Observações Adicionais</Label>
              <Textarea id="observacoes" placeholder="Adicione observações relevantes..." value={formData.observacoes} onChange={e => handleChange("observacoes", e.target.value)} rows={3} />
            </div>
          </div>

          {/* Custos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Custos</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="total_mao_obra">Total Mão de Obra (R$)</Label>
                <Input id="total_mao_obra" type="number" placeholder="0,00" value={formData.total_mao_obra} onChange={e => handleChange("total_mao_obra", e.target.value)} min="0" step="0.01" />
              </div>
              <div>
                <Label htmlFor="total_pecas">Total Peças (R$)</Label>
                <Input id="total_pecas" type="number" placeholder="0,00" value={formData.total_pecas} onChange={e => handleChange("total_pecas", e.target.value)} min="0" step="0.01" />
              </div>
              <div>
                <Label>Total Geral (R$)</Label>
                <Input disabled value={(parseFloat(formData.total_mao_obra || "0") + parseFloat(formData.total_pecas || "0")).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} />
              </div>
            </div>
          </div>

          {/* Botões */}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Ordem de Serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>;
}
