import React from 'react';
import { Button } from '@/components/ui/button';

interface RelatorioDREProps {
  onBack: () => void;
}

export function RelatorioDRE({ onBack }: RelatorioDREProps) {
  return (
    <div>
      <h2>Demonstração de Resultado (DRE)</h2>
      <Button onClick={onBack}>Voltar</Button>
      {/* Report content will be implemented here */}
    </div>
  );
}