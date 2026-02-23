import React from 'react';
import { Button } from '@/components/ui/button';

interface InadimplenciaProps {
  onBack: () => void;
}

export function Inadimplencia({ onBack }: InadimplenciaProps) {
  return (
    <div>
      <h2>Relatório de Inadimplência</h2>
      <Button onClick={onBack}>Voltar</Button>
      {/* Report content will be implemented here */}
    </div>
  );
}