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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddLicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  onSuccess: () => void;
}

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
      const insertData: any = {
        membro_tripulacao_id: crewMemberId,
        tipo_habilitacao: licenseType,
        numero_habilitacao: "",
        data_validade: isCMA ? null : expiryDate,
        observacao: observations || null,
      };

      if (isCMA) {
        insertData.CMA = cmaClass || null;
        insertData.FS_RH = fsRh || null;
        insertData.validade_cma = validadeCma || null;
      }

      const { error } = await supabase
        .from("habilitacoes_tripulante")
        .insert(insertData);

      if (error) throw error;

      toast.success("Habilitação adicionada com sucesso!");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar habilitação");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          sm:max-w-[480px]
          p-0 gap-0 overflow-hidden
          rounded-2xl
          bg-[#080220]
          border border-[#1d1d72]
          text-white
        "
      >
        {/* HEADER */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#040436]">
          <DialogTitle className="text-lg font-semibold text-white">
            Nova Habilitação
          </DialogTitle>
        </DialogHeader>

        {/* BODY */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-sm text-white">
              Tipo de Licença *
            </Label>
            <Input
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value)}
              className="bg-transparent border-[#1d1d72] text-white"
            />
          </div>

          {!isCMA && (
            <div className="space-y-2">
              <Label className="text-sm text-white">
                Data de Validade *
              </Label>
              <Input
                type="data"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-transparent border-[#1d1d72] text-white"
              />
            </div>
          )}

          {isCMA && (
            <>
              <div className="space-y-2">
                <Label className="text-sm text-white">
                  Classe do CMA *
                </Label>
                <Select value={cmaClass} onValueChange={setCmaClass}>
                  <SelectTrigger className="bg-transparent border-[#1d1d72] text-white">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#080220] border-[#1d1d72] text-white">
                    <SelectItem value="1º classe">1º Classe</SelectItem>
                    <SelectItem value="2º classe">2º Classe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-white">
                  Validade do CMA *
                </Label>
                <Input
                  type="data"
                  value={validadeCma}
                  onChange={(e) => setValidadeCma(e.target.value)}
                  className="bg-transparent border-[#1d1d72] text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-white">
                  Tipo Sanguíneo (FS/RH) *
                </Label>
                <Select value={fsRh} onValueChange={setFsRh}>
                  <SelectTrigger className="bg-transparent border-[#1d1d72] text-white">
                    <SelectValue placeholder="Selecione o tipo sanguíneo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#080220] border-[#1d1d72] text-white">
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
            </>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-white">
              Observações
            </Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="bg-transparent border-[#1d1d72] text-white resize-none"
            />
          </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-6 py-4 border-t border-[#04041e] bg-[#070f2d] gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#5c5c72] text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
