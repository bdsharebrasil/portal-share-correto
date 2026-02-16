import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Partner } from '../types';

interface PartnerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Partner[];
  selectedPartner: string | null;
  onSelect: (partnerId: string) => void;
  title?: string;
}

export function PartnerSelectDialog({
  open,
  onOpenChange,
  partners,
  selectedPartner,
  onSelect,
  title = "Selecionar Parceiro"
}: PartnerSelectDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum parceiro encontrado
            </p>
          ) : (
            partners.map((partner) => (
              <button
                key={partner.id}
                onClick={() => {
                  onSelect(partner.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  selectedPartner === partner.id
                    ? "border-primary bg-primary/10"
                    : "border-input hover:border-primary/50 hover:bg-accent"
                )}
              >
                <div className="font-semibold">{partner.name}</div>
                {partner.cpf && (
                  <div className="text-xs text-muted-foreground">
                    CPF: {partner.cpf}
                  </div>
                )}
                {partner.share_percentage && (
                  <div className="text-xs text-muted-foreground">
                    {partner.share_percentage}%
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
