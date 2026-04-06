import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface LicenseExpiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license: {
    id: string;
    tipo_habilitacao: string;
    data_validade?: string | null;
    validade_cma?: string | null;
    CMA?: string | null;
    FS_RH?: string | null;
    // Backward compatibility
    license_type?: string;
    expiry_date?: string | null;
  } | null;
  isCMA?: boolean;
  onSuccess: () => void;
}

export function LicenseExpiryDialog({
  open,
  onOpenChange,
  license,
  isCMA = false,
  onSuccess,
}: LicenseExpiryDialogProps) {

  const currentDate = isCMA ? license?.validade_cma : license?.data_validade;
  const [expiryDate, setExpiryDate] = useState(currentDate || "");
  const [cmaClass, setCmaClass] = useState(license?.CMA || "");
  const [fsRh, setFsRh] = useState(license?.FS_RH || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!license?.id || !expiryDate) {
      toast.error("Selecione uma data válida");
      return;
    }

    setIsLoading(true);
    try {
      if (!license?.id) {
        toast.error("Habilitação não encontrada");
        return;
      }

      const updateData: any = isCMA
        ? { validade_cma: expiryDate }
        : { data_validade: expiryDate };

      // Add CMA-specific fields if editing CMA
      if (isCMA) {
        updateData.CMA = cmaClass || null;
        updateData.FS_RH = fsRh || null;
      }

      console.log("[License] Attempting to update:", { id: license.id, ...updateData });

      const { error } = await (supabase as any)
        .from("habilitacoes_tripulante")
        .update(updateData)
        .eq("id", license.id);

      if (error) {
        console.error("[License] Supabase error:", error);
        const errorMessage =
          error?.message ||
          error?.error_description ||
          error?.details ||
          String(error);
        throw new Error(errorMessage);
      }

      toast.success("Habilitação atualizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating license:", error);

      let errorMessage = "Erro ao atualizar habilitação";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes("RLS")) {
          errorMessage = "Permissão negada ao atualizar habilitação";
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset date when dialog opens with new license
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && license) {
      const date = isCMA ? license.validade_cma : license.expiry_date;
      setExpiryDate(date || "");
      if (isCMA) {
        setCmaClass(license?.CMA || "");
        setFsRh(license?.FS_RH || "");
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={isCMA ? "sm:max-w-md" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>
            {isCMA ? "Editar CMA" : `Atualizar Validade - ${license?.license_type}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCMA ? (
            <>
              <div className="space-y-2">
                <Label>Classe CMA</Label>
                <Select value={cmaClass} onValueChange={setCmaClass}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1º classe">1º Classe</SelectItem>
                    <SelectItem value="2º classe">2º Classe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo Sanguíneo (FS/RH)</Label>
                <Select value={fsRh} onValueChange={setFsRh}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo sanguíneo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-date">Validade do CMA</Label>
                <Input
                  id="expiry-date"
                  type="data"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full"
                />
              </div>

              {currentDate && (
                <p className="text-sm text-muted-foreground">
                  Data atual: {format(new Date(currentDate + "T00:00:00"), "dd/MM/yyyy")}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="expiry-date">Nova Data de Validade</Label>
                <Input
                  id="expiry-date"
                  type="data"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full"
                />
              </div>

              {currentDate && (
                <p className="text-sm text-muted-foreground">
                  Data atual: {format(new Date(currentDate + "T00:00:00"), "dd/MM/yyyy")}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !expiryDate}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
