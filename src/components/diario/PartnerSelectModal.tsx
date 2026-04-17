import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Users } from "lucide-react";

interface Partner {
  id: string;
  nome: string;
}

interface PartnerSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  partners: Partner[];
  selectedPartner: string | null;
  onSelectPartner: (partnerName: string) => void;
}

export function PartnerSelectModal({
  open,
  onOpenChange,
  clientName,
  partners,
  selectedPartner,
  onSelectPartner,
}: PartnerSelectModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPartners = partners.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (partner: Partner) => {
    onSelectPartner(partner.nome);
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Selecionar Sócio/Parceiro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {clientName && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Cliente:</p>
              <p className="font-semibold">{clientName}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar parceiro</label>
            <Input
              placeholder="Digite o nome do parceiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredPartners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {partners.length === 0
                  ? "Nenhum parceiro disponível"
                  : "Nenhum resultado encontrado"}
              </p>
            ) : (
              filteredPartners.map((partner) => (
                <Button
                  key={partner.id}
                  onClick={() => handleSelect(partner)}
                  variant={selectedPartner === partner.nome ? "default" : "outline"}
                  className="w-full justify-start"
                >
                  {partner.nome}
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
