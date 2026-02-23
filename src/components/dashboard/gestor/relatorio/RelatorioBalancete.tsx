import React from 'react';
import { Button } from '@/components/ui/button';

interface RelatorioBalanceteProps {
  onBack: () => void;
}

export function RelatorioBalancete({ onBack }: RelatorioBalanceteProps) {
  return (
    <div>
      <h2>Relatório de Balancete</h2>
      <Button onClick={onBack}>Voltar</Button>
      {/* Report content will be implemented here */}
    </div>
  );
}