import { Plane, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormHeaderProps {
  step: 1 | 2;
  inline?: boolean;
}

export function FormHeader({ step, inline }: FormHeaderProps) {
  if (inline) {
    return (
      <div className="flex items-center justify-between mb-6 px-0">
        <div className="flex items-center gap-2 flex-1">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <span className="text-sm font-medium text-muted-foreground">Dados do Voo</span>
        </div>
        <div className="h-px flex-1 mx-4 bg-border" />
        <div className="flex items-center gap-2 flex-1">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            2
          </div>
          <span className="text-sm font-medium text-muted-foreground">Tempos e Extras</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <Plane className="h-5 w-5 text-primary" />
        Novo Trecho de Voo
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <span className="text-sm font-medium">Dados do Voo</span>
          </div>
          <div className="h-px flex-1 mx-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
              step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              2
            </div>
            <span className="text-sm font-medium">Tempos e Extras</span>
          </div>
        </div>
      </div>
    </div>
  );
}
