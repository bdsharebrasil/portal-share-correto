import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Users, Plane, Loader2, AlertCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateRateio } from "@/hooks/useRateio";
import { useAuth } from "@/contexts/AuthContext";

interface NovoRateioDialogProps {
  despesaId: string;
  despesaValor: number;
  despesaDescricao: string;
  aeronaveId?: string | null;
  aeronaveRegistro?: string | null;
  onSuccess?: () => void;
}

interface SocioRateio {
  clientId: string;
  clientName: string;
  percentual: number;
  valorRateado: number;
  incluir: boolean;
}

export function NovoRateioDialog({
  despesaId,
  despesaValor,
  despesaDescricao,
  aeronaveId,
  aeronaveRegistro,
  onSuccess,
}: NovoRateioDialogProps) {
  const [open, setOpen] = useState(false);
  const [socios, setSocios] = useState<SocioRateio[]>([]);
  const [rateioTipo, setRateioTipo] = useState<"proporcional" | "igual" | "manual">("proporcional");
  const { user } = useAuth();
  const createRateio = useCreateRateio();

  // Fetch clients associated with the aircraft
  const { data: clientAircraft } = useQuery({
    queryKey: ["client-aircraft", aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return [];
      
      const { data, error } = await supabase
        .from("client_aircraft")
        .select(`
          id,
          client_id,
          share_percentage,
          clients (
            id,
            company_name
          )
        `)
        .eq("aircraft_id", aeronaveId);

      if (error) throw error;
      return data;
    },
    enabled: !!aeronaveId && open,
  });

  // Initialize socios when clientAircraft loads
  useEffect(() => {
    if (clientAircraft && clientAircraft.length > 0) {
      const newSocios: SocioRateio[] = clientAircraft.map((ca: any) => ({
        clientId: ca.client_id,
        clientName: ca.clients?.company_name || "Cliente sem nome",
        percentual: ca.share_percentage || 0,
        valorRateado: (despesaValor * (ca.share_percentage || 0)) / 100,
        incluir: true,
      }));
      setSocios(newSocios);
    }
  }, [clientAircraft, despesaValor]);

  // Recalculate values when rateio type changes
  useEffect(() => {
    if (socios.length === 0) return;

    const includedSocios = socios.filter(s => s.incluir);
    if (includedSocios.length === 0) return;

    const updatedSocios = socios.map(s => {
      if (!s.incluir) {
        return { ...s, valorRateado: 0 };
      }

      let valorRateado = 0;
      if (rateioTipo === "proporcional") {
        valorRateado = (despesaValor * s.percentual) / 100;
      } else if (rateioTipo === "igual") {
        valorRateado = despesaValor / includedSocios.length;
      }
      // For manual, keep existing values

      return { ...s, valorRateado };
    });

    setSocios(updatedSocios);
  }, [rateioTipo]);

  const totalRateado = useMemo(() => {
    return socios.filter(s => s.incluir).reduce((acc, s) => acc + s.valorRateado, 0);
  }, [socios]);

  const diferenca = useMemo(() => {
    return despesaValor - totalRateado;
  }, [despesaValor, totalRateado]);

  const handleToggleSocio = (index: number) => {
    const updatedSocios = [...socios];
    updatedSocios[index].incluir = !updatedSocios[index].incluir;
    if (!updatedSocios[index].incluir) {
      updatedSocios[index].valorRateado = 0;
    }
    setSocios(updatedSocios);
  };

  const handleManualValueChange = (index: number, value: string) => {
    const numValue = parseFloat(value.replace(",", ".")) || 0;
    const updatedSocios = [...socios];
    updatedSocios[index].valorRateado = numValue;
    setSocios(updatedSocios);
  };

  const handleSubmit = async () => {
    if (!user) return;

    const rateiosToCreate = socios
      .filter(s => s.incluir && s.valorRateado > 0)
      .map(s => ({
        despesa_id: despesaId,
        client_id: s.clientId,
        client_name: s.clientName,
        aeronave_id: aeronaveId || null,
        aeronave_registro: aeronaveRegistro || null,
        percentual: s.percentual,
        valor_rateado: s.valorRateado,
        valor_pago: 0,
        status: "pendente",
        data_pagamento: null,
        recebimento_id: null,
        observacoes: null,
      }));

    await createRateio.mutateAsync(rateiosToCreate);
    setOpen(false);
    onSuccess?.();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Users className="w-4 h-4" />
          Ratear
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Ratear Despesa entre Sócios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Despesa Info */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm">Despesa</p>
                  <p className="text-white font-medium">{despesaDescricao}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Valor Total</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(despesaValor)}</p>
                </div>
              </div>
              {aeronaveRegistro && (
                <Badge variant="outline" className="mt-2 border-blue-600 text-blue-400">
                  <Plane className="w-3 h-3 mr-1" />
                  {aeronaveRegistro}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Rateio Type */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Tipo de Rateio</label>
            <Select value={rateioTipo} onValueChange={(v: any) => setRateioTipo(v)}>
              <SelectTrigger className="bg-gray-800 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proporcional">Proporcional à Participação</SelectItem>
                <SelectItem value="igual">Divisão Igual</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Socios List */}
          {socios.length > 0 ? (
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Sócios da Aeronave</label>
              {socios.map((socio, index) => (
                <Card key={socio.clientId} className={`border ${socio.incluir ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-700 opacity-50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={socio.incluir}
                        onCheckedChange={() => handleToggleSocio(index)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">{socio.clientName}</p>
                        <p className="text-sm text-gray-400">{socio.percentual}% de participação</p>
                      </div>
                      {rateioTipo === "manual" && socio.incluir ? (
                        <Input
                          placeholder="0,00"
                          value={socio.valorRateado.toFixed(2).replace(".", ",")}
                          onChange={(e) => handleManualValueChange(index, e.target.value)}
                          className="w-32 bg-gray-700 border-gray-600 text-right"
                        />
                      ) : (
                        <p className="text-lg font-semibold text-white">
                          {formatCurrency(socio.valorRateado)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-yellow-900/20 border-yellow-700">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <p className="text-yellow-400">
                  {aeronaveId 
                    ? "Nenhum sócio encontrado para esta aeronave. Cadastre os sócios primeiro."
                    : "Selecione uma aeronave na despesa para ver os sócios."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {socios.length > 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Rateado:</span>
                  <span className="text-lg font-semibold text-white">{formatCurrency(totalRateado)}</span>
                </div>
                {Math.abs(diferenca) > 0.01 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-400">Diferença:</span>
                    <span className={`text-lg font-semibold ${diferenca > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {formatCurrency(diferenca)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={createRateio.isPending || socios.filter(s => s.incluir).length === 0}
            >
              {createRateio.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Criar Rateio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
