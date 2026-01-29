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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  onSuccess: () => void;
}

const mobileStyles = `
  @media (max-width: 991px) {
    [data-mobile-dialog] {
      background-color: rgba(8, 2, 32, 1) !important;
      border-color: rgba(29, 29, 114, 1) !important;
      border-radius: 28px;
      overflow: hidden;
    }
    [data-mobile-dialog] [data-mobile-header] {
      color: rgba(234, 244, 255, 1);
      border-color: rgba(4, 4, 54, 1) !important;
    }
    [data-mobile-dialog] [data-mobile-title] {
      color: rgba(255, 255, 255, 1);
    }
    [data-mobile-dialog] [data-mobile-label] {
      color: rgba(255, 255, 255, 1);
    }
    [data-mobile-dialog] [data-mobile-input],
    [data-mobile-dialog] [data-mobile-textarea] {
      border-color: rgba(29, 29, 114, 1) !important;
    }
    [data-mobile-dialog] [data-mobile-footer] {
      border-color: rgba(4, 4, 30, 1) !important;
      background-color: rgba(7, 15, 45, 0.1) !important;
    }
    [data-mobile-dialog] [data-mobile-cancel-btn] {
      border-color: rgba(92, 92, 114, 1) !important;
    }
  }
`;

export function AddLicenseDialog({
  open,
  onOpenChange,
  crewMemberId,
  onSuccess,
}: AddLicenseDialogProps) {
  const [licenseType, setLicenseType] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [observations, setObservations] = useState("");
  const [cmaClass, setCmaClass] = useState("");
  const [fsRh, setFsRh] = useState("");
  const [validadeCma, setValidadeCma] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isCMA = licenseType === "CMA";

  const resetForm = () => {
    setLicenseType("");
    setExpiryDate("");
    setObservations("");
    setCmaClass("");
    setFsRh("");
    setValidadeCma("");
  };

  const handleSave = async () => {
    if (!licenseType) {
      toast.error("Informe o tipo de licença");
      return;
    }

    if (!isCMA && !expiryDate) {
      toast.error("Informe a data de validade");
      return;
    }

    if (isCMA && !validadeCma) {
      toast.error("Informe a validade do CMA");
      return;
    }

    setIsLoading(true);
    try {
      // Validate crew member ID
      if (!crewMemberId) {
        toast.error("ID do tripulante não informado");
        return;
      }

      const insertData: any = {
        crew_member_id: crewMemberId,
        license_type: licenseType,
        license_number: "",
        expiry_date: isCMA ? null : expiryDate,
        observacao: observations || null,
      };

      if (isCMA) {
        insertData.CMA = cmaClass || null;
        insertData.FS_RH = fsRh || null;
        insertData.validade_cma = validadeCma || null;
      }

      console.log("[License] Attempting to insert:", insertData);

      const { error } = await (supabase as any)
        .from("crew_licenses")
        .insert(insertData);

      if (error) {
        console.error("[License] Supabase error:", error);
        // Extract error message from various error formats
        const errorMessage =
          error?.message ||
          error?.error_description ||
          error?.details ||
          String(error);

        throw new Error(errorMessage);
      }

      toast.success("Habilitação adicionada com sucesso!");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding license:", error);

      // Extract and display a meaningful error message
      let errorMessage = "Erro ao adicionar habilitação";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes("crew_member_id")) {
          errorMessage = "Tripulante inválido ou não encontrado";
        } else if (errorMessage.includes("unique")) {
          errorMessage = "Esta habilitação já existe para este tripulante";
        } else if (errorMessage.includes("RLS")) {
          errorMessage = "Permissão negada ao adicionar habilitação";
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <style>{mobileStyles}</style>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent data-mobile-dialog className="sm:max-w-[480px] gap-0 p-0 overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50">
          {/* Header com estilo macOS */}
          <DialogHeader data-mobile-header className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <DialogTitle data-mobile-title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Nova Habilitação
            </DialogTitle>
          </DialogHeader>

          {/* Form com padding e espaçamento macOS */}
          <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label 
                htmlFor="license-type" 
                data-mobile-label
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Tipo de Licença *
              </Label>
              <Input
                id="license-type"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                placeholder="Ex: PP, PC, CMA, IFR"
                data-mobile-input
                className="h-10 rounded-lg border-zinc-200 dark:border-zinc-700 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
              />
            </div>

            {!isCMA && (
              <div className="space-y-2">
                <Label 
                  htmlFor="expiry-date"
                  data-mobile-label
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Data de Validade *
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  data-mobile-input
                  className="h-10 rounded-lg border-zinc-200 dark:border-zinc-700 focus-visible:ring-blue-500"
                />
              </div>
            )}

            {isCMA && (
              <>
                <div className="space-y-2">
                  <Label 
                    htmlFor="cma-class"
                    data-mobile-label
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Classe do CMA *
                  </Label>
                  <Select value={cmaClass} onValueChange={setCmaClass}>
                    <SelectTrigger data-mobile-input className="h-10 rounded-lg border-zinc-200 dark:border-zinc-700">
                      <SelectValue placeholder="Selecione a classe" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="primeira">1ª Classe</SelectItem>
                      <SelectItem value="segunda">2ª Classe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="fs-rh"
                    data-mobile-label
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Tipo Sanguíneo (FS/RH)
                  </Label>
                  <Select value={fsRh} onValueChange={setFsRh}>
                    <SelectTrigger data-mobile-input className="h-10 rounded-lg border-zinc-200 dark:border-zinc-700">
                      <SelectValue placeholder="Selecione o tipo sanguíneo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
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
                  <Label 
                    htmlFor="validade-cma"
                    data-mobile-label
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Validade do CMA *
                  </Label>
                  <Input
                    id="validade-cma"
                    type="date"
                    value={validadeCma}
                    onChange={(e) => setValidadeCma(e.target.value)}
                    data-mobile-input
                    className="h-10 rounded-lg border-zinc-200 dark:border-zinc-700"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label 
                htmlFor="observations"
                data-mobile-label
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Observações
              </Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observações adicionais..."
                rows={3}
                data-mobile-textarea
                className="rounded-lg border-zinc-200 dark:border-zinc-700 resize-none"
              />
            </div>
          </div>

          {/* Footer com estilo macOS */}
          <DialogFooter data-mobile-footer className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 gap-3">
            <Button 
              data-mobile-cancel-btn
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-lg h-10 px-4 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              className="rounded-lg h-10 px-4 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isLoading ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
