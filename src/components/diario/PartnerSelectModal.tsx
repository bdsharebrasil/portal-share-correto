import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Users, X } from 'lucide-react';

interface Partner {
  id?: string;
  name: string;
  cpf?: string;
  index: number;
}

interface PartnerSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  partners: Partner[];
  selectedPartner: string | null;
  onSelectPartner: (partner: Partner) => void;
}

export const PartnerSelectModal: React.FC<PartnerSelectModalProps> = ({
  open,
  onOpenChange,
  clientName,
  partners,
  selectedPartner,
  onSelectPartner,
}) => {
  const handleSelectPartner = (partner: Partner) => {
    onSelectPartner(partner);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <Users size={20} className="text-amber-500" />
            Selecionar Sócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente Info */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">
              Cliente Selecionado
            </p>
            <p className="text-sm font-bold text-amber-400">{clientName}</p>
          </div>

          {/* Partners List */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
              Sócios Disponíveis
            </p>
            {partners.length > 0 ? (
              <div className="grid gap-2">
                {partners.map((partner) => (
                  <button
                    key={partner.index}
                    onClick={() => handleSelectPartner(partner)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedPartner === partner.name
                        ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30'
                        : 'bg-slate-950 border-slate-800 hover:border-amber-500/50 hover:bg-slate-950/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-amber-400 text-sm">{partner.name}</p>
                        {partner.cpf && (
                          <p className="text-xs text-slate-400 font-mono mt-1">
                            CPF: {partner.cpf}
                          </p>
                        )}
                      </div>
                      {selectedPartner === partner.name && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500">Nenhum sócio cadastrado para este cliente</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 hover:bg-slate-800"
            >
              <X size={16} className="mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selectedPartner}
              onClick={() => {
                const partner = partners.find(p => p.name === selectedPartner);
                if (partner) handleSelectPartner(partner);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
