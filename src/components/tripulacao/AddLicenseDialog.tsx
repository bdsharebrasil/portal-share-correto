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

const LICENSE_TYPES = [
  "PP",
  "PC",
  "PLA",
  "INVA",
  "MLTE",
  "IFR",
  "CHT",
  "CMA",
  "Outro",
];

export function AddLicenseDialog({
  open,
  onOpenChange,
  crewMemberId,
  onSuccess,
}: AddLicenseDialogProps) {
  const [licenseType, setLicenseType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("ANAC");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [observations, setObservations] = useState("");
  // CMA specific fields
  const [cmaClass, setCmaClass] = useState("");
  const [fsRh, setFsRh] = useState("");
  const [validadeCma, setValidadeCma] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isCMA = licenseType === "CMA";

  const resetForm = () => {
    setLicenseType("");
    setLicenseNumber("");
    setIssuingAuthority("ANAC");
    setIssueDate("");
    setExpiryDate("");
    setObservations("");
    setCmaClass("");
    setFsRh("");
    setValidadeCma("");
  };

  const handleSave = async () => {
    if (!licenseType) {
      toast.error("Selecione o tipo de habilitação");
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
        crew_member_id: crewMemberId,
        license_type: licenseType,
        license_number: licenseNumber || null,
        issuing_authority: issuingAuthority || null,
        issue_date: issueDate || null,
        expiry_date: isCMA ? null : expiryDate,
        observations: observations || null,
      };

      if (isCMA) {
        insertData.CMA = cmaClass || null;
        insertData.FS_RH = fsRh || null;
        insertData.validade_cma = validadeCma || null;
      }

      const { error } = await (supabase as any)
        .from("crew_licenses")
        .insert(insertData);

      if (error) throw error;

      toast.success("Habilitação adicionada com sucesso!");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding license:", error);
      toast.error("Erro ao adicionar habilitação");
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Habilitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="license-type">Tipo de Habilitação *</Label>
            <Select value={licenseType} onValueChange={setLicenseType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isCMA && (
            <>
              <div className="space-y-2">
                <Label htmlFor="license-number">Número da Licença</Label>
                <Input
                  id="license-number"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Ex: 123456"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="issuing-authority">Órgão Emissor</Label>
                <Input
                  id="issuing-authority"
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  placeholder="Ex: ANAC"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue-date">Data de Emissão</Label>
                  <Input
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry-date">Data de Validade *</Label>
                  <Input
                    id="expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {isCMA && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cma-class">Classe do CMA *</Label>
                <Select value={cmaClass} onValueChange={setCmaClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira">1ª Classe</SelectItem>
                    <SelectItem value="segunda">2ª Classe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fs-rh">FS/RH</Label>
                <Input
                  id="fs-rh"
                  value={fsRh}
                  onChange={(e) => setFsRh(e.target.value)}
                  placeholder="Ex: Apto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validade-cma">Validade do CMA *</Label>
                <Input
                  id="validade-cma"
                  type="date"
                  value={validadeCma}
                  onChange={(e) => setValidadeCma(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
