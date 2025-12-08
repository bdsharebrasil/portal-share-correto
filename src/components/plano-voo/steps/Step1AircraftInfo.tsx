import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, User, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step1Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
}

interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
}

interface Client {
  id: string;
  company_name: string;
}

export function Step1AircraftInfo({ formData, updateFormData }: Step1Props) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [aircraftRes, crewRes, clientsRes] = await Promise.all([
        supabase.from("aircraft").select("id, registration, model, manufacturer").eq("status", "Ativa"),
        supabase.from("crew_members").select("id, full_name, canac").eq("status", "ativo"),
        supabase.from("clients").select("id, company_name").eq("status", "ativo"),
      ]);

      if (aircraftRes.data) setAircraft(aircraftRes.data);
      if (crewRes.data) setCrewMembers(crewRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleAircraftChange = (aircraftId: string) => {
    const selected = aircraft.find((a) => a.id === aircraftId);
    if (selected) {
      updateFormData({
        aircraftId: selected.id,
        aircraftRegistration: selected.registration,
        aircraftType: selected.model,
      });
    }
  };

  const handlePilotChange = (pilotId: string) => {
    const selected = crewMembers.find((c) => c.id === pilotId);
    if (selected) {
      updateFormData({
        pilotId: selected.id,
        pilotInCommand: selected.full_name,
      });
    }
  };

  const handleClientChange = (clientId: string) => {
    const selected = clients.find((c) => c.id === clientId);
    if (selected) {
      updateFormData({
        clientId: selected.id,
        clientName: selected.company_name,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Aircraft Section */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Plane className="h-5 w-5 text-cyan-400" />
            </div>
            7 - Identificação da Aeronave
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Identificação da Aeronave *</Label>
              <Select value={formData.aircraftId} onValueChange={handleAircraftChange}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.registration} - {a.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Aeronave *</Label>
              <Input
                value={formData.aircraftType}
                onChange={(e) => updateFormData({ aircraftType: e.target.value })}
                placeholder="Ex: C172"
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pilot Section */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            Piloto em Comando
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Piloto em Comando *</Label>
            <Select value={formData.pilotId} onValueChange={handlePilotChange}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Selecione o piloto" />
              </SelectTrigger>
              <SelectContent>
                {crewMembers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} ({c.canac})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client Section */}
      <Card className="bg-slate-800/50 border-slate-700/50 lg:col-span-2">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Building2 className="h-5 w-5 text-purple-400" />
            </div>
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2 max-w-md">
            <Label className="text-slate-300">Cliente</Label>
            <Select value={formData.clientId} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
