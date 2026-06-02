import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FlightCycle, CrewMember } from "@/types/flightCycle";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useCrewMembers } from "@/hooks/useCrewMembers";
import { FlightDurationInput } from "./FlightDurationInput";

interface CreateFlightCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (cycle: Partial<FlightCycle>) => Promise<any>;
}

interface Client {
  id: string;
  razao_social: string | null;
  proprietario: string | null;
}

interface Aircraft {
  id: string;
  matricula: string;
  modelo: string;
}

interface ClientPartner {
  id: string;
  nome: string;
}

export function CreateFlightCycleDialog({ open, onOpenChange, onCreate }: CreateFlightCycleDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [partners, setPartners] = useState<ClientPartner[]>([]);
  const [loading, setLoading] = useState(false);
  const { crewMembers, fetchCrewMembers } = useCrewMembers();

  const [formData, setFormData] = useState({
    client_id: '',
    partner_id: '',
    aeronave_id: '',
    origin_icao: '',
    destination_icao: '',
    flight_date: format(new Date(), 'yyyy-MM-dd'),
    return_date: '',
    flight_type: 'ida' as 'ida' | 'ida_volta' | 'pernoite',
    has_overnight: false,
    is_controlled_airport: false,
    has_private_hangar: false,
    flight_duration_hours: '',
    pic_name: '',
    sic_name: '',
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    const loadPartners = async () => {
      if (!formData.client_id) {
        setPartners([]);
        setFormData(prev => ({ ...prev, partner_id: '' }));
        return;
      }

      const { data } = await supabase
        .from('socios')
        .select('id, nome')
        .eq('cliente_id', formData.client_id)
        .order('nome');

      setPartners((data || []) as ClientPartner[]);
      setFormData(prev => ({ ...prev, partner_id: '' }));
    };

    loadPartners();
  }, [formData.client_id]);

  const loadData = async () => {
    const [clientsRes, aircraftRes] = await Promise.all([
      supabase.from('clientes').select('id, razao_social, proprietario').order('razao_social'),
      supabase.from('aeronave').select('id, matricula, modelo').order("matricula"),
    ]);

    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (aircraftRes.data) setAircraft(aircraftRes.data as Aircraft[]);

    // Fetch crew members
    await fetchCrewMembers();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Get partner name if partner is selected
      let partnerName: string | null = null;
      if (formData.partner_id) {
        const partner = partners.find(p => p.id === formData.partner_id);
        partnerName = partner?.nome || null;
      }

      await onCreate({
        client_id: formData.client_id || null,
        partner_id: formData.partner_id || null,
        aeronave_id: formData.aeronave_id || null,
        origin_icao: formData.origin_icao || null,
        destination_icao: formData.destination_icao || null,
        flight_date: formData.flight_date || null,
        flight_type: formData.flight_type,
        partner_name: partnerName,
        flight_duration_hours: formData.flight_duration_hours ? parseFloat(formData.flight_duration_hours) : null,
        return_date: formData.return_date || null,
        status: 'confirmado',
        pic_name: formData.pic_name || null,
        sic_name: formData.sic_name || null,
        has_overnight: formData.has_overnight,
        is_controlled_airport: formData.is_controlled_airport,
        has_private_hangar: formData.has_private_hangar,
      });

      // Reset form
      setFormData({
        client_id: '',
        partner_id: '',
        aeronave_id: '',
        origin_icao: '',
        destination_icao: '',
        flight_date: format(new Date(), 'yyyy-MM-dd'),
        return_date: '',
        flight_type: 'ida',
        has_overnight: false,
        is_controlled_airport: false,
        has_private_hangar: false,
        flight_duration_hours: '',
        pic_name: '',
        sic_name: '',
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Ciclo de Voo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.razao_social || client.proprietario || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aeronave *</Label>
              <Select
                value={formData.aeronave_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, aeronave_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map(ac => (
                    <SelectItem key={ac.id} value={ac.id}>
                      {ac.matricula} - {ac.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {partners.length > 0 && (
            <div className="space-y-2">
              <Label>Partner *</Label>
              <Select
                value={formData.partner_id}
                onValueChange={(v) =>
                  setFormData(prev => ({ ...prev, partner_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origem (ICAO) *</Label>
              <Input
                value={formData.origin_icao}
                onChange={(e) => setFormData(prev => ({ ...prev, origin_icao: e.target.value.toUpperCase() }))}
                placeholder="SBSP"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Destino (ICAO) *</Label>
              <Input
                value={formData.destination_icao}
                onChange={(e) => setFormData(prev => ({ ...prev, destination_icao: e.target.value.toUpperCase() }))}
                placeholder="SBBR"
                maxLength={4}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data do Voo *</Label>
              <Input
                type="data"
                value={formData.flight_date}
                onChange={(e) => setFormData(prev => ({ ...prev, flight_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Retorno</Label>
              <Input
                type="data"
                value={formData.return_date}
                onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Voo</Label>
              <Select
                value={formData.flight_type}
                onValueChange={(v) => setFormData(prev => ({
                  ...prev,
                  flight_type: v as 'ida' | 'ida_volta' | 'pernoite',
                  has_overnight: v === 'pernoite'
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ida">Ida</SelectItem>
                  <SelectItem value="ida_volta">Ida e Volta</SelectItem>
                  <SelectItem value="pernoite">Pernoite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <FlightDurationInput
                value={formData.flight_duration_hours}
                onChange={(value) => setFormData(prev => ({ ...prev, flight_duration_hours: value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PIC (Pilot in Command)</Label>
              <Select
                value={formData.pic_name}
                onValueChange={(v) => setFormData(prev => ({ ...prev, pic_name: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o PIC" />
                </SelectTrigger>
                <SelectContent>
                  {crewMembers.map(member => (
                    <SelectItem key={member.id} value={member.full_name}>
                      <div className="flex items-center gap-2">
                        <span>{member.full_name}</span>
                        <span className="text-xs text-muted-foreground">({member.canac})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>SIC (Second in Command)</Label>
              <Select
                value={formData.sic_name}
                onValueChange={(v) => setFormData(prev => ({ ...prev, sic_name: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o SIC" />
                </SelectTrigger>
                <SelectContent>
                  {crewMembers.map(member => (
                    <SelectItem key={member.id} value={member.full_name}>
                      <div className="flex items-center gap-2">
                        <span>{member.full_name}</span>
                        <span className="text-xs text-muted-foreground">({member.canac})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <Label className="text-muted-foreground">Características do Voo</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="controlled"
                checked={formData.is_controlled_airport}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_controlled_airport: !!checked }))}
              />
              <label htmlFor="controlled" className="text-sm cursor-pointer">
                Aeroporto controlado (Infraero)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="overnight"
                checked={formData.has_overnight}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_overnight: !!checked }))}
              />
              <label htmlFor="overnight" className="text-sm cursor-pointer">
                Voo com pernoite (hospedagem e alimentação)
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="hangar"
                checked={formData.has_private_hangar}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_private_hangar: !!checked }))}
              />
              <label htmlFor="hangar" className="text-sm cursor-pointer">
                Hangar particular disponível
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.client_id || !formData.aeronave_id || !formData.origin_icao || !formData.destination_icao}
          >
            Criar Ciclo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
