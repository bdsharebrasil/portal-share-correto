// @ts-nocheck
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Plus, Pencil, Save, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDecimalHoursToHHMM } from "@/lib/utils";

interface LogbookEntry {
  id: string;
  data_registro: string;
  aerodromo_partida: string;
  aerodromo_chegada: string;
  tempo_dep: string | null;
  tempo_pou: string | null;
  tempo_voo: number;
  horas_diurnas: number;
  horas_noturnas: number;
  tempo_total: number;
  tempo_ifr: number;
  pousos_total: number;
  combustivel_adicionado: number | null;
  litros_combustivel: number | null;
  celula: number | null;
  preco_combustivel_litro: number | null;
  sic_name: string | null;
  tarifa_diaria: string | null;
  ocorrencias: string | null;
  natureza_voo: string;
  confirmado: boolean | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
}

interface Aircraft {
  matricula: string;
  model: string;
}

interface LogbookTableProps {
  entries: LogbookEntry[];
  isLoading: boolean;
  aircraft?: Aircraft;
  isReadOnly?: boolean;
  hasDailyRate?: boolean;
  onAddEntry?: (prefilledDate?: Date) => void;
}

export function LogbookTable({
  entries,
  isLoading,
  aircraft,
  isReadOnly = false,
  hasDailyRate = true,
  onAddEntry,
}: LogbookTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LogbookEntry>>({});
  const [isSaving, setIsSaving] = useState(false);

  const currentUserId = user?.id ?? null;
  const canVerify = roles.includes("admin") || roles.includes("piloto_chefe");

  const handleVerifyToggle = async (entryId: string, currentlyVerified: boolean) => {
    if (!canVerify || isReadOnly || !currentUserId) return;

    try {
      const { error } = await supabase
        .from("lancamentos_diario_bordo")
        .update({
          confirmado_por: currentlyVerified ? null : currentUserId,
          confirmado_em: currentlyVerified ? null : new Date().toISOString(),
          confirmado: !currentlyVerified,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast({
        title: currentlyVerified ? "Verificação removida" : "Registro verificado",
        description: currentlyVerified
          ? "A verificação foi removida."
          : "Registro marcado como conferido.",
      });

      queryClient.invalidateQueries({ queryKey: ["logbook-entries"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleStartEdit = (entry: LogbookEntry) => {
    setEditingId(entry.id);
    setEditData({
      data_registro: entry.data_registro,
      aerodromo_partida: entry.aerodromo_partida,
      aerodromo_chegada: entry.aerodromo_chegada,
      tempo_dep: entry.tempo_dep,
      tempo_pou: entry.tempo_pou,
      tempo_voo: entry.tempo_voo,
      horas_noturnas: entry.horas_noturnas,
      tempo_ifr: entry.tempo_ifr,
      pousos_total: entry.pousos_total,
      combustivel_adicionado: entry.combustivel_adicionado,
      litros_combustivel: entry.litros_combustivel,
      celula: entry.celula,
      preco_combustivel_litro: entry.preco_combustivel_litro,
      sic_name: entry.sic_name,
      tarifa_diaria: entry.tarifa_diaria,
      ocorrencias: entry.ocorrencias,
      natureza_voo: entry.natureza_voo,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setIsSaving(true);
    try {
      const tempoVoo = editData.tempo_voo ?? 0;
      const horasNoturnas = editData.horas_noturnas ?? 0;
      const horasDiurnas = Math.max(0, tempoVoo - horasNoturnas);

      const { error } = await supabase
        .from("lancamentos_diario_bordo")
        .update({
          data_registro: editData.data_registro,
          aerodromo_partida: editData.aerodromo_partida?.toUpperCase(),
          aerodromo_chegada: editData.aerodromo_chegada?.toUpperCase(),
          tempo_dep: editData.tempo_dep,
          tempo_pou: editData.tempo_pou,
          tempo_voo: tempoVoo,
          horas_noturnas: horasNoturnas,
          horas_diurnas: horasDiurnas,
          tempo_total: tempoVoo,
          tempo_ifr: editData.tempo_ifr,
          pousos_total: editData.pousos_total,
          combustivel_adicionado: editData.combustivel_adicionado,
          litros_combustivel: editData.litros_combustivel,
          celula: editData.celula,
          preco_combustivel_litro: editData.preco_combustivel_litro,
          sic_name: editData.sic_name,
          tarifa_diaria: editData.tarifa_diaria,
          ocorrencias: editData.ocorrencias,
          natureza_voo: editData.natureza_voo,
        })
        .eq("id", editingId);

      if (error) throw error;

      toast({
        title: "Registro atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      queryClient.invalidateQueries({ queryKey: ["logbook-entries"] });
      setEditingId(null);
      setEditData({});
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditField = (field: keyof LogbookEntry, value: any) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.tempo_total ?? 0), 0);
  const totalLandings = entries.reduce((sum, e) => sum + (e.pousos_total ?? 0), 0);
  const totalFuelAdded = entries.reduce((sum, e) => sum + (e.combustivel_adicionado ?? 0), 0);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Carregando registros...</div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum registro encontrado para este período.
      </div>
    );
  }

  const isEditing = (id: string) => editingId === id;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold w-[80px]">DATA</TableHead>
              <TableHead className="font-bold">DE</TableHead>
              <TableHead className="font-bold">PARA</TableHead>
              <TableHead className="font-bold">AC</TableHead>
              <TableHead className="font-bold">DEP</TableHead>
              <TableHead className="font-bold">POU</TableHead>
              <TableHead className="font-bold">VOO</TableHead>
              <TableHead className="font-bold">NOIT</TableHead>
              <TableHead className="font-bold">TOTAL</TableHead>
              <TableHead className="font-bold">IFR</TableHead>
              <TableHead className="font-bold">POUSO</TableHead>
              <TableHead className="font-bold">ABAST</TableHead>
              <TableHead className="font-bold">FUEL (L)</TableHead>
              <TableHead className="font-bold">CÉLULA</TableHead>
              <TableHead className="font-bold">R$/L</TableHead>
              <TableHead className="font-bold">SIC</TableHead>
              {hasDailyRate && <TableHead className="font-bold">DIÁRIAS</TableHead>}
              <TableHead className="font-bold">OCORRÊNCIAS</TableHead>
              <TableHead className="font-bold">NATUREZA</TableHead>
              <TableHead className="font-bold">CONFERE</TableHead>
              {!isReadOnly && <TableHead className="font-bold w-[80px]">AÇÕES</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <TableRow
                  className={`hover:bg-muted/30 ${isEditing(entry.id) ? "bg-primary/10" : ""}`}
                >
                  {/* DATA */}
                  <TableCell className="font-medium">
                    {isEditing(entry.id) ? (
                      <Input
                        type="date"
                        value={editData.data_registro || ""}
                        onChange={(e) => updateEditField("data_registro", e.target.value)}
                        className="h-7 w-24 text-xs"
                      />
                    ) : (
                      <span>{format(new Date(entry.data_registro), "d/M", { locale: pt })}</span>
                    )}
                  </TableCell>

                  {/* DE */}
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.aerodromo_partida || ""}
                        onChange={(e) =>
                          updateEditField("aerodromo_partida", e.target.value.toUpperCase())
                        }
                        className="h-7 w-16 text-xs uppercase"
                      />
                    ) : (
                      entry.aerodromo_partida
                    )}
                  </TableCell>

                  {/* PARA */}
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.aerodromo_chegada || ""}
                        onChange={(e) =>
                          updateEditField("aerodromo_chegada", e.target.value.toUpperCase())
                        }
                        className="h-7 w-16 text-xs uppercase"
                      />
                    ) : (
                      entry.aerodromo_chegada
                    )}
                  </TableCell>

                  {/* AC (matrícula - read only) */}
                  <TableCell className="uppercase">{aircraft?.matricula || "-"}</TableCell>

                  {/* DEP */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="time"
                        value={editData.tempo_dep || ""}
                        onChange={(e) => updateEditField("tempo_dep", e.target.value)}
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.tempo_dep || "-"
                    )}
                  </TableCell>

                  {/* POU */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="time"
                        value={editData.tempo_pou || ""}
                        onChange={(e) => updateEditField("tempo_pou", e.target.value)}
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.tempo_pou || "-"
                    )}
                  </TableCell>

                  {/* VOO (tempo_voo decimal) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.tempo_voo ?? 0}
                        onChange={(e) =>
                          updateEditField("tempo_voo", parseFloat(e.target.value) || 0)
                        }
                        className="h-7 w-16 text-xs"
                        min={0}
                        step="0.01"
                      />
                    ) : (
                      formatDecimalHoursToHHMM(entry.tempo_voo)
                    )}
                  </TableCell>

                  {/* NOIT (horas_noturnas decimal) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.horas_noturnas ?? 0}
                        onChange={(e) =>
                          updateEditField("horas_noturnas", parseFloat(e.target.value) || 0)
                        }
                        className="h-7 w-16 text-xs"
                        min={0}
                        step="0.01"
                      />
                    ) : (
                      formatDecimalHoursToHHMM(entry.horas_noturnas)
                    )}
                  </TableCell>

                  {/* TOTAL */}
                  <TableCell className="font-medium">
                    {formatDecimalHoursToHHMM(
                      isEditing(entry.id) ? editData.tempo_voo ?? 0 : entry.tempo_total
                    )}
                  </TableCell>

                  {/* IFR */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.tempo_ifr ?? 0}
                        onChange={(e) =>
                          updateEditField("tempo_ifr", parseFloat(e.target.value) || 0)
                        }
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.01"
                      />
                    ) : (
                      entry.tempo_ifr > 0 ? formatDecimalHoursToHHMM(entry.tempo_ifr) : "-"
                    )}
                  </TableCell>

                  {/* POUSO */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.pousos_total ?? 0}
                        onChange={(e) =>
                          updateEditField("pousos_total", parseInt(e.target.value) || 0)
                        }
                        className="h-7 w-12 text-xs"
                        min={0}
                      />
                    ) : (
                      entry.pousos_total
                    )}
                  </TableCell>

                  {/* ABAST (combustivel_adicionado) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.combustivel_adicionado ?? ""}
                        onChange={(e) =>
                          updateEditField(
                            "combustivel_adicionado",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.combustivel_adicionado != null && entry.combustivel_adicionado > 0
                        ? entry.combustivel_adicionado
                        : "-"
                    )}
                  </TableCell>

                  {/* FUEL L (litros_combustivel) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.litros_combustivel ?? ""}
                        onChange={(e) =>
                          updateEditField(
                            "litros_combustivel",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.litros_combustivel || "-"
                    )}
                  </TableCell>

                  {/* CÉLULA */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.celula ?? ""}
                        onChange={(e) =>
                          updateEditField(
                            "celula",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-7 w-14 text-xs"
                        min={0}
                        step="0.1"
                      />
                    ) : (
                      entry.celula || "-"
                    )}
                  </TableCell>

                  {/* R$/L (preco_combustivel_litro) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        type="number"
                        value={editData.preco_combustivel_litro ?? ""}
                        onChange={(e) =>
                          updateEditField(
                            "preco_combustivel_litro",
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        className="h-7 w-16 text-xs"
                        min={0}
                        step="0.01"
                      />
                    ) : (
                      entry.preco_combustivel_litro
                        ? `R$ ${entry.preco_combustivel_litro.toFixed(2).replace(".", ",")}`
                        : "-"
                    )}
                  </TableCell>

                  {/* SIC (sic_name) */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.sic_name ?? ""}
                        onChange={(e) =>
                          updateEditField("sic_name", e.target.value || null)
                        }
                        className="h-7 w-20 text-xs"
                      />
                    ) : (
                      entry.sic_name || "-"
                    )}
                  </TableCell>

                  {/* DIÁRIAS (tarifa_diaria) */}
                  {hasDailyRate && (
                    <TableCell>
                      {isEditing(entry.id) ? (
                        <Input
                          value={editData.tarifa_diaria ?? ""}
                          onChange={(e) =>
                            updateEditField("tarifa_diaria", e.target.value || null)
                          }
                          className="h-7 w-20 text-xs"
                        />
                      ) : (
                        entry.tarifa_diaria || "-"
                      )}
                    </TableCell>
                  )}

                  {/* OCORRÊNCIAS */}
                  <TableCell>
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.ocorrencias ?? ""}
                        onChange={(e) =>
                          updateEditField("ocorrencias", e.target.value || null)
                        }
                        className="h-7 w-24 text-xs"
                      />
                    ) : (
                      entry.ocorrencias || "-"
                    )}
                  </TableCell>

                  {/* NATUREZA (natureza_voo) */}
                  <TableCell className="uppercase">
                    {isEditing(entry.id) ? (
                      <Input
                        value={editData.natureza_voo ?? ""}
                        onChange={(e) =>
                          updateEditField("natureza_voo", e.target.value || null)
                        }
                        className="h-7 w-24 text-xs uppercase"
                      />
                    ) : (
                      entry.natureza_voo || "-"
                    )}
                  </TableCell>

                  {/* CONFERE */}
                  <TableCell>
                    <Checkbox
                      checked={!!entry.confirmado}
                      onCheckedChange={() =>
                        handleVerifyToggle(entry.id, !!entry.confirmado)
                      }
                      disabled={!canVerify || isReadOnly || isEditing(entry.id)}
                    />
                  </TableCell>

                  {/* AÇÕES */}
                  {!isReadOnly && (
                    <TableCell>
                      {isEditing(entry.id) ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                          >
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>

                {/* Botão adicionar após linha */}
                {!isReadOnly && !isEditing(entry.id) && (
                  <TableRow className="bg-muted/20 hover:bg-muted/40">
                    <TableCell colSpan={22} className="py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8 gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const d = new Date(entry.data_registro);
                          d.setMinutes(d.getMinutes() + 1);
                          onAddEntry?.(d);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar registro após{" "}
                        {format(new Date(entry.data_registro), "d/M", { locale: pt })}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}

            {/* Totais */}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell colSpan={8}>TOTAL DO MÊS</TableCell>
              <TableCell>{formatDecimalHoursToHHMM(totalHours)}H</TableCell>
              <TableCell />
              <TableCell>{totalLandings}</TableCell>
              <TableCell>{totalFuelAdded.toFixed(1)}L</TableCell>
              <TableCell colSpan={isReadOnly ? 8 : 9} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}