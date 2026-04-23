// @ts-nocheck
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput, type AutocompleteOption } from "@/components/ui/autocomplete-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plane } from "lucide-react";

interface FlightScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

interface CrewMember {
  id: string;
  nome_completo: string;
}

interface Client {
  id: string;
  razao_social: string;
}

interface Aerodrome {
  id: string;
  name: string;
  designativo: string;
}

export function FlightScheduleDialog({ open, onOpenChange, onSuccess }: FlightScheduleDialogProps) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [aerodromes, setAerodromes] = useState<Aerodrome[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    aeronave_id: "",
    flight_date: "",
    flight_time: "",
    estimated_duration: "",
    client_id: "",
    contact: "",
    passengers: "1",
    flight_type: "particular",
    origin: "",
    destination: "",
    crew_member_id: "",
    status: "pendente",
    observations: "",
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aircraftRes, crewRes, clientsRes, aerodromeRes] = await Promise.all([
        supabase.from('aeronave').select('id, matricula, modelo').eq("status", "ativa"),
        supabase.from("tripulacao").select("id, nome_completo").eq("status", "ativo"),
        supabase.from("clientes").select("id, razao_social"),
        supabase.from('aerodromes').select('id, nome, designativo'),
      ]);

      if (aircraftRes.error) throw aircraftRes.error;
      if (crewRes.error) throw crewRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (aerodromeRes.error) throw aerodromeRes.error;

      setAircraft(aircraftRes.data || []);
      setCrewMembers(crewRes.data || []);
      setClients(clientsRes.data || []);
      setAerodromes(((aerodromeRes.data || []) as Array<{ id: string; nome: string; designativo: string }>).map((a) => ({ ...a, name: a.nome })));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.aeronave_id || !formData.flight_date || !formData.flight_time || 
        !formData.origin || !formData.destination) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("flight_schedules").insert({
        aeronave_id: formData.aeronave_id,
        flight_date: formData.flight_date,
        flight_time: formData.flight_time,
        estimated_duration: formData.estimated_duration || null,
        client_id: formData.cliente_id || null,
        contact: formData.contact || null,
        passengers: parseInt(formData.passengers),
        flight_type: formData.flight_type,
        origin: formData.origin,
        destination: formData.destination,
        crew_member_id: formData.crew_member_id || null,
        status: formData.status,
        observations: formData.observacoes || null,
      });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      resetForm();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error creating schedule:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      aeronave_id: "",
      flight_date: "",
      flight_time: "",
      estimated_duration: "",
      client_id: "",
      contact: "",
      passengers: "1",
      flight_type: "particular",
      origin: "",
      destination: "",
      crew_member_id: "",
      status: "pendente",
      observations: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader className="bg-primary text-primary-foreground -m-6 mb-6 p-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plane className="h-5 w-5" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Flight Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeronave">Aeronave *</Label>
              <Select
                value={formData.aeronave_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, aeronave_id: value }))}
              >
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Selecione a aeronave..." />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((ac) => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.registration} - {ac.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flight_date">Data do Voo *</Label>
              <Input
                id="flight_date"
                type="data"
                className="bg-secondary"
                value={formData.flight_date}
                onChange={(e) => setFormData(prev => ({ ...prev, flight_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="flight_time">Horário *</Label>
              <Input
                id="flight_time"
                type="time"
                className="bg-secondary"
                value={formData.flight_time}
                onChange={(e) => setFormData(prev => ({ ...prev, flight_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_duration">Duração Estimada</Label>
              <Input
                id="estimated_duration"
                placeholder="Ex: 2h 30min"
                className="bg-secondary"
                value={formData.estimated_duration}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
              />
            </div>
          </div>

          {/* Client Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Informações do Cliente</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Nome do Cliente *</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Nome completo do cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contato</Label>
                <Input
                  id="contact"
                  placeholder="Telefone ou email"
                  className="bg-secondary"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passengers">Número de Passageiros *</Label>
                <Input
                  id="passengers"
                  type="number"
                  min="1"
                  className="bg-secondary"
                  value={formData.passengers}
                  onChange={(e) => setFormData(prev => ({ ...prev, passengers: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="flight_type">Tipo de Voo</Label>
                <Select
                  value={formData.flight_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, flight_type: value }))}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">👤 Particular</SelectItem>
                    <SelectItem value="treinamento">📚 Treinamento</SelectItem>
                    <SelectItem value="manutencao">🔧 Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Flight Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Informações do Voo</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin">Origem</Label>
                <AutocompleteInput
                  id="origin"
                  value={formData.origin}
                  onChange={(value) => setFormData(prev => ({ ...prev, origin: value.toUpperCase() }))}
                  options={aerodromes.map(a => ({
                    id: a.id,
                    label: `${a.designativo} - ${a.nome}`
                  }))}
                  placeholder="Busque ou digite o aeroporto..."
                  isLoading={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destino *</Label>
                <AutocompleteInput
                  id="destination"
                  value={formData.destination}
                  onChange={(value) => setFormData(prev => ({ ...prev, destination: value.toUpperCase() }))}
                  options={aerodromes.map(a => ({
                    id: a.id,
                    label: `${a.designativo} - ${a.nome}`
                  }))}
                  placeholder="Busque ou digite o aeroporto..."
                  isLoading={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crew">Tripulação</Label>
                <Select
                  value={formData.crew_member_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, crew_member_id: value }))}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Nome do comandante/tripulação" />
                  </SelectTrigger>
                  <SelectContent>
                    {crewMembers.map((crew) => (
                      <SelectItem key={crew.id} value={crew.id}>
                        {crew.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">🟡 Pendente</SelectItem>
                    <SelectItem value="confirmado">🟢 Confirmado</SelectItem>
                    <SelectItem value="cancelado">🔴 Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais sobre o voo..."
                className="bg-secondary min-h-[80px]"
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="min-w-[120px]">
              {loading ? "Salvando..." : "Salvar Agendamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
