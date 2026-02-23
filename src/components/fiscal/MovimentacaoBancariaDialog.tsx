import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface MovimentacaoBancariaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovimentacaoBancariaDialog({ open, onOpenChange }: MovimentacaoBancariaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentação Bancária</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Dialog content will be implemented here */}
          <p>Formulário de movimentação bancária</p>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}