import React from 'react';
import { Button } from '@/components/ui/button';

interface RelatorioFluxoCaixaProps {
  onBack: () => void;
}

export function RelatorioFluxoCaixa({ onBack }: RelatorioFluxoCaixaProps) {
  return (
    <div>
      <h2>Relatório de Fluxo de Caixa</h2>
      <Button onClick={onBack}>Voltar</Button>
      {/* Report content will be implemented here */}
    </div>
  );
}